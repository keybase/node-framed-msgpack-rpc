import net from 'net'
import tls from 'tls'
import {Transport} from './transport'
import type {TransportOpts} from './transport'
import {List, type ListNode} from './list'
import * as log from './log'
import * as dbg from './debug'

export class Listener {
  port?: number
  host?: string
  path?: string
  TransportClass: new (opts: TransportOpts) => Transport
  log_obj!: log.Logger
  tls_opts?: Record<string, any>
  do_tcp_delay?: boolean
  _children: List<Transport & ListNode>
  _dbgr: dbg.Debugger | null = null
  _net_server: net.Server | null = null

  constructor({
    port,
    host,
    path,
    TransportClass,
    log_obj,
    tls_opts,
  }: {
    port?: number
    host?: string
    path?: string
    TransportClass?: new (opts: TransportOpts) => Transport
    log_obj?: log.Logger
    tls_opts?: Record<string, any>
  }) {
    this.port = port
    this.host = host
    this.path = path
    this.TransportClass = TransportClass || (Transport as any)
    this.tls_opts = tls_opts
    this._children = new List()
    this.set_logger(log_obj)
  }

  _default_logger(): log.Logger {
    const l = log.new_default_logger()
    l.set_prefix('RPC-Server')
    const h = this.host || '0.0.0.0'
    if (this.port != null) {
      l.set_remote(`${h}:${this.port}`)
    } else if (this.path != null) {
      l.set_remote(this.path)
    }
    return l
  }

  set_debugger(d: dbg.Debugger | null): void {
    this._dbgr = d
  }

  set_debug_flags(f: number | string, apply_to_children?: boolean): void {
    this.set_debugger(dbg.make_debugger(f, this.log_obj))
    if (apply_to_children) {
      this.walk_children((c: any) => c.set_debug_flags(f))
    }
  }

  set_logger(o?: log.Logger): void {
    if (!o) o = this._default_logger()
    this.log_obj = o
  }

  make_new_transport(c: net.Socket | tls.TLSSocket): Transport & ListNode {
    if (!this.do_tcp_delay) c.setNoDelay(true)

    const x = new this.TransportClass({
      net_stream: c,
      host: (c as net.Socket).remoteAddress,
      port: (c as net.Socket).remotePort,
      parent: this,
      log_obj: this.make_new_log_object(c),
      dbgr: this._dbgr,
    })
    this._children.push(x as Transport & ListNode)
    return x as Transport & ListNode
  }

  make_new_log_object(c: net.Socket | tls.TLSSocket): log.Logger {
    const r = [(c as net.Socket).remoteAddress, (c as net.Socket).remotePort].join(':')
    return this.log_obj.make_child({prefix: 'RPC', remote: r})
  }

  walk_children(fn: (node: Transport & ListNode) => void): void {
    this._children.walk(fn)
  }

  close_child(c: Transport & ListNode): void {
    this._children.remove(c)
  }

  set_port(p: number): void {
    this.port = p
  }

  _got_new_connection(c: net.Socket | tls.TLSSocket): void {
    const x = this.make_new_transport(c)
    this.got_new_connection(x)
  }

  got_new_connection(_x: Transport): void {
    throw new Error('got_new_connection() is pure virtual; please implement!')
  }

  _make_server(): void {
    if (this.tls_opts) {
      this._net_server = tls.createServer(this.tls_opts, (c: tls.TLSSocket) => this._got_new_connection(c))
    } else {
      this._net_server = net.createServer((c: net.Socket) => this._got_new_connection(c))
    }
  }

  async close(): Promise<void> {
    if (this._net_server) {
      await new Promise<void>(resolve => this._net_server!.close(() => resolve()))
      this._net_server = null
    }
  }

  handle_close(): void {
    this.log_obj.info('listener closing down')
  }

  handle_error(err: Error): void {
    this._net_server = null
    this.log_obj.error(`error in listener: ${err}`)
  }

  _set_hooks(): void {
    this._net_server!.on('error', (err: Error) => this.handle_error(err))
    this._net_server!.on('close', () => this.handle_close())
  }

  async listen(): Promise<void> {
    this._make_server()

    return new Promise<void>((resolve, reject) => {
      const x = this._net_server!

      const onError = (err: Error) => {
        x.removeListener('listening', onListening)
        this.log_obj.error(err)
        this._net_server = null
        reject(err)
      }

      const onListening = () => {
        x.removeListener('error', onError)
        this._set_hooks()
        resolve()
      }

      x.once('error', onError)
      x.once('listening', onListening)

      if (this.port != null) {
        x.listen(this.port, this.host)
      } else {
        x.listen(this.path)
      }
    })
  }

  async listen_retry(delay: number): Promise<void> {
    let go = true
    while (go) {
      try {
        await this.listen()
        go = false
      } catch (err: any) {
        if (err?.code === 'EADDRINUSE') {
          this.log_obj.warn(err)
          await new Promise<void>(resolve => setTimeout(resolve, delay * 1000))
        } else {
          go = false
          throw err
        }
      }
    }
  }
}
