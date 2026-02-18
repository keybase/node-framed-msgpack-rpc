import {Packetizer} from './packetizer'
import {unpack, pack} from './pack'
import * as dbg from './debug'
import * as E from './errors'
import pako from 'pako'

export const COMPRESSION_TYPE_NONE = 0
export const COMPRESSION_TYPE_GZIP = 1

function compress(ctype: number | undefined | null, data: any): any {
  if (ctype == null) return data
  switch (ctype) {
    case COMPRESSION_TYPE_NONE:
      return data
    case COMPRESSION_TYPE_GZIP: {
      let packed = pack(data)
      return pako.deflate(packed, {windowBits: 31})
    }
    default:
      throw new Error(`Compress: unknown compression type ${ctype}`)
  }
}

function uncompress(ctype: number | undefined | null, data: any): any {
  if (ctype == null) return data
  switch (ctype) {
    case COMPRESSION_TYPE_NONE:
      return data
    case COMPRESSION_TYPE_GZIP: {
      const inflated = pako.inflate(data)
      const [err, result] = unpack(inflated)
      if (err == null) return result
      throw err
    }
    default:
      throw new Error(`Uncompress: unknown compression type ${ctype}`)
  }
}

export interface InvokeArgs {
  program?: string | null
  ctype?: number
  method: string
  args: any
  notify: boolean
}

export class Response {
  dispatch: Dispatch
  seqid: number
  ctype: number | undefined
  debug_msg: dbg.Message | null = null

  constructor(dispatch: Dispatch, seqid: number, ctype?: number) {
    this.dispatch = dispatch
    this.seqid = seqid
    this.ctype = ctype
  }

  result(res: any): void {
    res = compress(this.ctype, res)
    if (this.debug_msg) this.debug_msg.response(null, res).call()
    this.dispatch.respond(this.seqid, null, res)
  }

  error(err: any): void {
    if (this.debug_msg) this.debug_msg.response(err, null).call()
    this.dispatch.respond(this.seqid, err, null)
  }
}

export interface ServeArgs {
  method: string
  param: any
  response?: Response
}

export interface HookWrapperArgs {
  method: any
  thisobj: any
  param: any
  response?: Response
  dispatch: Dispatch
}

export abstract class Dispatch extends Packetizer {
  INVOKE = 0
  RESPONSE = 1
  NOTIFY = 2
  INVOKE_COMPRESSED = 4

  _invocations: Record<number, (error: any, result: any) => void> = {}
  _handlers: Record<string, Function> = {}
  _seqid: number = 1
  _dbgr: dbg.Debugger | null = null
  _generic_handler: ((args: {method: string; param: any; response?: Response; dispatch: Dispatch}) => void) | null =
    null

  constructor() {
    super()
  }

  set_debugger(d: dbg.Debugger | null): void {
    this._dbgr = d
  }

  set_generic_handler(
    h: ((args: {method: string; param: any; response?: Response; dispatch: Dispatch}) => void) | null
  ): void {
    this._generic_handler = h
  }

  _dispatch(msg: any[]): void {
    if (!Array.isArray(msg) || msg.length < 2) {
      this._warn('Bad input packet in dispatch')
    } else {
      const type = msg.shift()
      switch (type) {
        case this.INVOKE: {
          const [seqid, method, param] = msg
          const response = new Response(this, seqid)
          this._serve({method, param, response})
          break
        }
        case this.NOTIFY: {
          const [method, param] = msg
          this._serve({method, param})
          break
        }
        case this.RESPONSE: {
          const [seqid, error, result] = msg
          this._dispatch_handle_response({seqid, error, result})
          break
        }
        case this.INVOKE_COMPRESSED: {
          const [seqid, ctype, method, param] = msg
          const uncompressed = uncompress(ctype, param)
          const response = new Response(this, seqid, ctype)
          this._serve({method, param: uncompressed, response})
          break
        }
        default:
          this._warn(`Unknown message type: ${type}`)
      }
    }
  }

  _dispatch_handle_response({seqid, error, result}: {seqid: number; error: any; result: any}): void {
    this._call_cb({seqid, error, result})
  }

  _call_cb({seqid, error, result}: {seqid: number; error: any; result: any}): void {
    const cb = this._invocations[seqid]
    if (cb) {
      delete this._invocations[seqid]
      error = this.unwrap_incoming_error(error)
      cb(error, result)
    }
  }

  cancel(seqid: number): void {
    this._call_cb({seqid, error: 'cancelled', result: null})
  }

  _next_seqid(): number {
    const ret = this._seqid
    this._seqid++
    return ret
  }

  make_method(prog: string | null | undefined, meth: string): string {
    return prog ? [prog, meth].join('.') : meth
  }

  respond(seqid: number, error: any, result: any): void {
    const msg = [this.RESPONSE, seqid, error, result]
    this.send(msg)
  }

  invoke(
    {program, ctype, method, args, notify}: InvokeArgs,
    _cb?: (error: any, result: any) => void,
    out?: {cancel?: () => void}
  ): Promise<{error: any; result: any}> {
    method = this.make_method(program, method)

    const seqid = this._next_seqid()

    let type: number
    let dtype: number
    if (notify) {
      type = this.NOTIFY
      dtype = dbg.constants.type.CLIENT_NOTIFY
    } else if (ctype != null) {
      type = this.INVOKE_COMPRESSED
      dtype = dbg.constants.type.CLIENT_INVOKE_COMPRESSED
    } else {
      type = this.INVOKE
      dtype = dbg.constants.type.CLIENT_INVOKE
    }

    let msg: any[]
    if (ctype != null) {
      args = compress(ctype, args)
      msg = [type, seqid, ctype, method, args]
    } else {
      msg = [type, seqid, method, args]
    }

    let debug_msg: dbg.Message | undefined
    if (this._dbgr) {
      debug_msg = this._dbgr.new_message({
        method,
        seqid,
        ctype,
        arg: args,
        dir: dbg.constants.dir.OUTGOING,
        remote: this.remote_address(),
        port: this.remote_port(),
        type: dtype,
      })
      debug_msg.call()
    }

    // Down to the packetizer, which will jump back up to the Transport!
    this.send(msg)

    if (notify) {
      return Promise.resolve({error: undefined, result: undefined})
    }

    return new Promise<{error: any; result: any}>(resolve => {
      if (out) {
        out.cancel = () => this.cancel(seqid)
      }

      this._invocations[seqid] = (error: any, result: any) => {
        if (ctype != null && !error) {
          result = uncompress(ctype, result)
        }
        if (debug_msg) debug_msg.response(error, result).call()
        resolve({error, result})
      }
    })
  }

  _dispatch_reset(): void {
    const inv = this._invocations
    this._invocations = {}
    for (const key of Object.keys(inv)) {
      inv[Number(key)](new E.EofError(), {})
    }
  }

  _serve({method, param, response}: ServeArgs): void {
    const pair = this.get_handler_pair(method)

    if (this._dbgr) {
      const debug_msg = this._dbgr.new_message({
        method,
        seqid: response?.seqid,
        arg: param,
        dir: dbg.constants.dir.INCOMING,
        remote: this.remote_address(),
        port: this.remote_port(),
        type: dbg.constants.type.SERVER,
        err: pair ? null : 'unknown method',
      })

      if (response) response.debug_msg = debug_msg
      debug_msg.call()
    }

    if (this._generic_handler != null) {
      this._generic_handler({method, param, response, dispatch: this})
    } else if (pair != null && this.get_hook_wrapper() != null) {
      this.get_hook_wrapper()!({method: pair[1], thisobj: pair[0], param, response, dispatch: this})
    } else if (pair) {
      pair[1].call(pair[0], param, response, this)
    } else if (response != null) {
      const err = new E.UnknownMethodError(method)
      err.method = method
      response.error(this.wrap_outgoing_error(err))
    }
  }

  // please override me!
  get_handler_this(_m: string): any {
    return this
  }

  get_hook_wrapper(): ((args: HookWrapperArgs) => void) | null {
    return null
  }

  wrap_outgoing_error(s: any): any {
    return s.toString()
  }

  unwrap_incoming_error(s: any): any {
    return typeof s === 'string' ? new Error(s) : s
  }

  // please override me!
  get_handler_pair(m: string): [any, Function] | null {
    const h = this._handlers[m]
    if (h) return [this.get_handler_this(m), h]
    return null
  }

  add_handler(method: string, hook: Function, program: string | null = null): void {
    method = this.make_method(program, method)
    this._handlers[method] = hook
  }

  add_program(program: string, hooks: Record<string, Function>): void {
    for (const [method, hook] of Object.entries(hooks)) {
      this.add_handler(method, hook, program)
    }
  }

  add_programs(programs: Record<string, Record<string, Function>>): void {
    for (const [program, hooks] of Object.entries(programs)) {
      this.add_program(program, hooks)
    }
  }

  abstract remote_address(): string | null
  abstract remote_port(): number | null
  abstract _warn(e: any): void
}
