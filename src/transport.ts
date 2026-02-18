import net from 'net'
import tls from 'tls'
// @ts-ignore -- no type declarations available
import pp from 'path-parse'
import process from 'process'
import {Lock} from './lock'
import {Dispatch} from './dispatch'
import type {InvokeArgs, HookWrapperArgs} from './dispatch'
import * as log from './log'
import {Timer} from './timer'
import * as dbg from './debug'

export interface TransportHooks {
  eof?: (netw: StreamWrapper) => void
  connected?: (netw: StreamWrapper) => void
  after_connect?: () => Promise<void>
}

export interface TransportOpts {
  port?: number
  host?: string
  net_opts?: Record<string, any>
  net_stream?: net.Socket | tls.TLSSocket
  log_obj?: log.Logger
  parent?: any
  do_tcp_delay?: boolean
  hooks?: TransportHooks
  dbgr?: dbg.Debugger | null
  path?: string
  tls_opts?: Record<string, any>
  connect_timeout?: number
}

export class StreamWrapper {
  _net_stream: (net.Socket | tls.TLSSocket) | null
  private _parent: Transport
  private _generation: number
  private _write_closed_warn: boolean = false

  constructor(net_stream: net.Socket | tls.TLSSocket, parent: Transport) {
    this._net_stream = net_stream
    this._parent = parent
    this._generation = this._parent.next_generation()
  }

  close(): boolean {
    let ret = false
    const x = this._net_stream
    if (x) {
      ret = true
      this._net_stream = null
      this._parent._dispatch_reset()
      this._parent._packetizer_reset()
      x.end()
    }
    return ret
  }

  write(msg: string, enc: BufferEncoding): void {
    if (this._net_stream) {
      this._net_stream.write(msg, enc)
    } else if (!this._write_closed_warn) {
      this._write_closed_warn = true
      this._parent._warn('write on closed socket...')
    }
  }

  stream(): (net.Socket | tls.TLSSocket) | null {
    return this._net_stream
  }

  is_connected(): boolean {
    return !!this._net_stream
  }

  get_generation(): number {
    return this._generation
  }

  remote_address(): string | null {
    return this._net_stream ? this._net_stream.remoteAddress || null : null
  }

  remote_port(): number | null {
    return this._net_stream ? this._net_stream.remotePort || null : null
  }
}

export class Transport extends Dispatch {
  port?: number
  host: string
  net_opts: Record<string, any>
  log_obj!: log.Logger
  parent: any
  do_tcp_delay?: boolean
  hooks?: TransportHooks
  path?: string
  tls_opts?: Record<string, any>
  _explicit_close: boolean = false
  _remote_str: string
  _lock: Lock
  _generation: number = 1
  _connect_timeout: number
  _netw: StreamWrapper | null = null

  constructor(opts: TransportOpts) {
    super()

    this.port = opts.port
    this.host = !opts.host || opts.host === '-' ? 'localhost' : opts.host
    this.net_opts = opts.net_opts || {}
    this.net_opts.host = this.host
    this.net_opts.port = this.port
    this.net_opts.path = opts.path
    this._explicit_close = false
    this.parent = opts.parent
    this.do_tcp_delay = opts.do_tcp_delay
    this.hooks = opts.hooks
    this.path = opts.path
    this.tls_opts = opts.tls_opts

    this._remote_str = [this.host, this.port].join(':')
    this.set_logger(opts.log_obj)

    this._lock = new Lock()

    this._dbgr = opts.dbgr || null

    this._connect_timeout = opts.connect_timeout || 10 * 1000

    if (opts.net_stream) {
      this._activate_stream(opts.net_stream)
    }
  }

  set_debugger(d: dbg.Debugger | null): void {
    this._dbgr = d
  }

  set_debug_flags(d: number | string): void {
    this.set_debugger(dbg.make_debugger(d, this.log_obj))
  }

  next_generation(): number {
    const ret = this._generation
    this._generation++
    return ret
  }

  get_generation(): number {
    return this._netw ? this._netw.get_generation() : -1
  }

  remote_address(): string | null {
    return this._netw ? this._netw.remote_address() : null
  }

  remote_port(): number | null {
    return this._netw ? this._netw.remote_port() : null
  }

  set_logger(o?: log.Logger): void {
    if (!o) o = log.new_default_logger()
    this.log_obj = o
    this.log_obj.set_remote(this._remote_str)
  }

  get_logger(): log.Logger {
    return this.log_obj
  }

  is_connected(): boolean {
    return this._netw?.is_connected() || false
  }

  async connect(): Promise<Error | null> {
    await this._lock.acquire()
    let err: Error | null = null
    if (!this.is_connected()) {
      err = await this._connect_critical_section()
    }
    this._lock.release()
    if (err) this._reconnect(true)
    return err
  }

  reset(w?: StreamWrapper): void {
    if (!w) w = this._netw || undefined
    if (w) this._close(w)
  }

  close(): void {
    this._explicit_close = true
    if (this._netw) {
      this._netw.close()
      this._netw = null
    }
  }

  _warn(e: any): void {
    this.log_obj.warn(e)
  }
  _info(e: any): void {
    this.log_obj.info(e)
  }
  _fatal(e: any): void {
    this.log_obj.fatal(e)
  }
  _debug(e: any): void {
    this.log_obj.debug(e)
  }
  _error(e: any): void {
    this.log_obj.error(e)
  }

  _close(netw?: StreamWrapper): void {
    if (netw) {
      this.hooks?.eof?.(netw)
      if (netw.close()) {
        this._reconnect(false)
      }
    }
  }

  _handle_error(e: any, netw?: StreamWrapper): void {
    this._error(e)
    this._close(netw)
  }

  _packetize_error(err: string): void {
    this._handle_error(`In packetizer: ${err}`, this._netw || undefined)
  }

  _packetize_warning(w: string): void {
    this._warn(`In packetizer: ${w}`)
  }

  _handle_close(netw: StreamWrapper): void {
    if (!this._explicit_close) this._info('EOF on transport')
    this._close(netw)
    if (this.parent) this.parent.close_child(this)
  }

  _reconnect(_first_time: boolean): void {
    // In other classes we can override this — see RobustTransport
  }

  _activate_stream(x: net.Socket | tls.TLSSocket): void {
    this._info('connection established')

    const w = new StreamWrapper(x, this)
    this._netw = w

    this.hooks?.connected?.(w)

    x.on('error', (err: Error) => this._handle_error(err, w))
    x.on('close', () => this._handle_close(w))
    x.on('data', (msg: Buffer) => this.packetize_data(new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength)))
  }

  async _connect_critical_section(): Promise<Error | null> {
    let oldCwd: string | undefined

    let x: net.Socket | tls.TLSSocket
    let connect_event_name: string

    if (this.tls_opts) {
      const opts: Record<string, any> = {}
      for (const [name, val] of Object.entries(this.net_opts)) {
        opts[name] = val
      }
      for (const [name, val] of Object.entries(this.tls_opts)) {
        opts[name] = val
      }
      x = tls.connect(opts)
      connect_event_name = 'secureConnect'
    } else {
      let opts = this.net_opts
      if (this.net_opts.path != null && this.net_opts.path.length >= 103) {
        oldCwd = process.cwd()
        const path_info = pp(this.net_opts.path)
        try {
          process.chdir(path_info.dir)
        } catch (ex: any) {
          this._warn(`could not cd close to socket path: ${ex.code} ${ex.message}`)
          return new Error('error in connection (cd to long socket path)')
        }
        opts = Object.assign({}, this.net_opts)
        opts.path = path_info.base
      }
      x = net.connect(opts as net.NetConnectOpts)
      connect_event_name = 'connect'
    }
    if (!this.do_tcp_delay) x.setNoDelay(true)

    type RaceResult = {id: 'connect'} | {id: 'error'; err: Error} | {id: 'close'} | {id: 'timeout'}

    const result = await Promise.race<RaceResult>([
      new Promise<RaceResult>(resolve => x.once(connect_event_name, () => resolve({id: 'connect'}))),
      new Promise<RaceResult>(resolve => x.once('error', (err: Error) => resolve({id: 'error', err}))),
      new Promise<RaceResult>(resolve => x.once('close', () => resolve({id: 'close'}))),
      new Promise<RaceResult>(resolve =>
        setTimeout(() => resolve({id: 'timeout'}), this._connect_timeout)
      ),
    ])

    if (oldCwd != null) {
      try {
        process.chdir(oldCwd)
      } catch (ex: any) {
        this._warn(`could not recover cwd: ${ex.code} ${ex.message}`)
        return new Error('error in connection (changed cwd)')
      }
    }

    let ok = false
    let err: Error | null = null

    switch (result.id) {
      case 'connect':
        ok = true
        break
      case 'error':
        this._warn(result.err)
        err = result.err
        break
      case 'close':
        this._warn('connection closed during open')
        break
      case 'timeout':
        this._warn(`connection timed out after ${this._connect_timeout}s`)
        break
    }

    if (ok) {
      this._activate_stream(x)
      err = null
      if (this.hooks?.after_connect) {
        try {
          await this.hooks.after_connect()
        } catch (e: any) {
          err = e
        }
      }
    } else if (!err) {
      err = new Error('error in connection')
    }

    return err
  }

  _raw_write(msg: string, encoding: string): void {
    if (!this._netw) {
      this._warn('write attempt with no active stream')
    } else {
      this._netw.write(msg, encoding as BufferEncoding)
    }
  }
}

export interface RobustTransportOpts extends TransportOpts {
  reconnect_delay?: number
  queue_max?: number
  warn_threshhold?: number
  error_threshhold?: number
  robust?: boolean
}

export class RobustTransport extends Transport {
  queue_max: number
  warn_threshhold?: number
  error_threshhold?: number
  reconnect_delay: number
  private _time_rpcs: boolean
  private _waiters: Array<[InvokeArgs, ((result: {error: any; result: any}) => void) | undefined]> = []

  constructor(sd: RobustTransportOpts, d: RobustTransportOpts = {}) {
    super(sd)

    this.queue_max = d.queue_max != null ? d.queue_max : 1000
    this.warn_threshhold = d.warn_threshhold
    this.error_threshhold = d.error_threshhold
    this.reconnect_delay = d.reconnect_delay || 1

    this._time_rpcs = this.warn_threshhold != null || this.error_threshhold != null
    this._waiters = []
  }

  _reconnect(first_time: boolean): void {
    if (!this._explicit_close) {
      this._connect_loop(first_time)
    }
  }

  private _flush_queue(): void {
    const tmp = this._waiters
    this._waiters = []
    for (const [arg, resolveOuter] of tmp) {
      this.invoke(arg).then(res => resolveOuter?.(res))
    }
  }

  async _connect_critical_section(): Promise<Error | null> {
    const err = await super._connect_critical_section()
    if (!err) {
      this._flush_queue()
    }
    return err
  }

  private async _connect_loop(first_time: boolean = false): Promise<void> {
    const prfx = first_time ? '' : 're'
    let i = 0

    await this._lock.acquire()

    let go = true
    let first_through_loop = true

    while (go) {
      if (this.is_connected() || this._explicit_close) {
        go = false
      } else if (first_through_loop && !first_time) {
        first_through_loop = false
        this._info('reconnect loop started, initial delay...')
        await new Promise<void>(resolve => setTimeout(resolve, this.reconnect_delay * 1000))
      } else {
        i++
        this._info(`${prfx}connecting (attempt ${i})`)
        const err = await this._connect_critical_section()
        if (err) {
          await new Promise<void>(resolve => setTimeout(resolve, this.reconnect_delay * 1000))
        } else {
          go = false
        }
      }
    }

    if (this.is_connected()) {
      const s = i === 1 ? '' : 's'
      this._warn(`${prfx}connected after ${i} attempt${s}`)
    }

    this._lock.release()
  }

  private async _timed_invoke(arg: InvokeArgs): Promise<{error: any; result: any}> {
    const tm = new Timer({start: true})
    const meth = this.make_method(arg.program, arg.method)

    const et = this.error_threshhold ? this.error_threshhold * 1000 : 0
    const wt = this.warn_threshhold ? this.warn_threshhold * 1000 : 0

    // Race: RPC vs periodic timeout warnings
    let rpc_done = false
    const rpcPromise = Dispatch.prototype.invoke.call(this, arg).then(res => {
      rpc_done = true
      return res
    })

    if (et) {
      // periodically log while we wait
      const logLoop = async () => {
        while (!rpc_done) {
          await new Promise<void>(r => setTimeout(r, et))
          if (!rpc_done) {
            this._error(`RPC call to '${meth}' is taking > ${et / 1000}s`)
          }
        }
      }
      logLoop() // fire and forget
    }

    const result = await rpcPromise
    const dur = tm.stop()

    let m: ((msg: any) => void) | null = null
    if (et && dur >= et) m = this._error.bind(this)
    else if (wt && dur >= wt) m = this._warn.bind(this)

    if (m) m(`RPC call to '${meth}' finished in ${dur / 1000}s`)

    return result
  }

  invoke(arg: InvokeArgs): Promise<{error: any; result: any}> {
    const meth = this.make_method(arg.program, arg.method)
    if (this.is_connected()) {
      if (this._time_rpcs) return this._timed_invoke(arg)
      return super.invoke(arg)
    } else if (this._explicit_close) {
      this._warn('invoke call after explicit close')
      return Promise.resolve({error: 'socket was closed', result: {}})
    } else if (this._waiters.length < this.queue_max) {
      return new Promise<{error: any; result: any}>(resolve => {
        this._waiters.push([arg, resolve])
        this._info(`Queuing call to ${meth} (num queued: ${this._waiters.length})`)
      })
    } else if (this.queue_max > 0) {
      this._warn(`Queue overflow for ${meth}`)
    }
    return Promise.resolve({error: 'queue overflow', result: {}})
  }
}

export function createTransport(opts: RobustTransportOpts): Transport {
  if (opts.robust) return new RobustTransport(opts, opts)
  return new Transport(opts)
}
