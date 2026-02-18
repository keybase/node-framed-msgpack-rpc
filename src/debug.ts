import * as log from './log'

// Flags for what fields are in our debug messages
const F = {
  NONE: 0,
  METHOD: 0x1,
  REMOTE: 0x2,
  SEQID: 0x4,
  TIMESTAMP: 0x8,
  ERR: 0x10,
  ARG: 0x20,
  RES: 0x40,
  TYPE: 0x80,
  COMPRESSION_TYPE: 0x90,
  DIR: 0x100,
  PORT: 0x200,
  VERBOSE: 0x400,
  ALL: 0xfffffff,
  LEVEL_0: 0,
  LEVEL_1: 0,
  LEVEL_2: 0,
  LEVEL_3: 0,
  LEVEL_4: 0,
} as Record<string, number>

F.LEVEL_0 = F.NONE
F.LEVEL_1 = F.METHOD | F.TYPE | F.DIR | F.TYPE | F.COMPRESSION_TYPE
F.LEVEL_2 = F.LEVEL_1 | F.SEQID | F.TIMESTAMP | F.REMOTE | F.PORT
F.LEVEL_3 = F.LEVEL_2 | F.ERR
F.LEVEL_4 = F.LEVEL_3 | F.RES | F.ARG

// String versions of these flags
const SF: Record<string, number> = {
  m: F.METHOD,
  a: F.REMOTE,
  s: F.SEQID,
  t: F.TIMESTAMP,
  p: F.ARG,
  r: F.RES,
  e: F.ERR,
  c: F.TYPE,
  C: F.COMPRESSION_TYPE,
  d: F.DIR,
  v: F.VERBOSE,
  P: F.PORT,
  A: F.ALL,
  '0': F.LEVEL_0,
  '1': F.LEVEL_1,
  '2': F.LEVEL_2,
  '3': F.LEVEL_3,
  '4': F.LEVEL_4,
}

const dir = {
  INCOMING: 1,
  OUTGOING: 2,
} as const

function flip_dir(d: number): number {
  return d === dir.INCOMING ? dir.OUTGOING : dir.INCOMING
}

const type = {
  SERVER: 1,
  CLIENT_NOTIFY: 2,
  CLIENT_INVOKE: 3,
  CLIENT_INVOKE_COMPRESSED: 4,
} as const

const F2S: Record<number, Record<number, string>> = {}
F2S[F.DIR] = {}
F2S[F.DIR][dir.INCOMING] = 'in'
F2S[F.DIR][dir.OUTGOING] = 'out'
F2S[F.TYPE] = {}
F2S[F.TYPE][type.SERVER] = 'server'
F2S[F.TYPE][type.CLIENT_NOTIFY] = 'cli.notify'
F2S[F.TYPE][type.CLIENT_INVOKE] = 'cli.invoke'
F2S[F.TYPE][type.CLIENT_INVOKE_COMPRESSED] = 'cli.invokeCompresed'

export const constants = {
  type,
  dir,
  flags: F,
  sflags: SF,
  field_to_string: F2S,
}

export function sflags_to_flags(s: string | number): number {
  const str = `${s}`
  let res = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i)
    res |= SF[c] || 0
  }
  return res
}

export interface DebugMessageDict {
  method?: string
  seqid?: number
  ctype?: number
  arg?: any
  res?: any
  err?: any
  dir?: number
  remote?: string | null
  port?: number | null
  type?: number
  [key: string]: any
}

export class Debugger {
  flags: number
  log_obj: log.Logger
  log_obj_mthd: (m: unknown) => void

  constructor(flags: number | string, log_obj?: log.Logger, log_obj_mthd?: (m: unknown) => void) {
    this.flags = typeof flags === 'string' ? sflags_to_flags(flags) : flags
    if (!log_obj) {
      this.log_obj = log.new_default_logger()
      this.log_obj_mthd = this.log_obj.info.bind(this.log_obj)
    } else {
      this.log_obj = log_obj
      this.log_obj_mthd = log_obj_mthd || log_obj.info.bind(log_obj)
    }
  }

  new_message(dict: DebugMessageDict): Message {
    return new Message(dict, this)
  }

  _output(json_msg: any): void {
    this.log_obj_mthd.call(this.log_obj, JSON.stringify(json_msg))
  }

  _skip_flag(f: number): boolean {
    return !!(f & (F.REMOTE | F.PORT))
  }

  call(msg: Message): void {
    const new_json_msg: Record<string, any> = {}

    // Usually don't copy the arg or res if it's in the other direction,
    // but this can overpower that
    const V = !!(this.flags & F.VERBOSE)

    if (this.flags & F.TIMESTAMP) {
      new_json_msg.timestamp = new Date().getTime() / 1000.0
    }

    const json_obj = msg.to_json_object()
    for (const key of Object.keys(json_obj)) {
      let val = json_obj[key]
      const uck = key.toUpperCase()
      const flag = F[uck]

      let do_copy: boolean
      if (this._skip_flag(flag)) do_copy = false
      else if ((this.flags & flag) === 0) do_copy = false
      else if (key === 'res') do_copy = msg.show_res(V)
      else if (key === 'arg') do_copy = msg.show_arg(V)
      else do_copy = true

      if (do_copy) {
        const f2s = F2S[flag]
        if (f2s != null) val = f2s[val] ?? val
        new_json_msg[key] = val
      }
    }

    this._output(new_json_msg)
  }
}

export class Message {
  private _msg: DebugMessageDict
  private _debugger: Debugger | null

  constructor(msg: DebugMessageDict, dbgr: Debugger | null = null) {
    this._msg = msg
    this._debugger = dbgr
  }

  response(error: any, result: any): Message {
    this._msg.err = error
    this._msg.res = result
    this._msg.dir = flip_dir(this._msg.dir!)
    return this
  }

  to_json_object(): DebugMessageDict {
    return this._msg
  }

  call(): void {
    this._debugger!.call(this)
  }

  set(k: string, v: any): void {
    this._msg[k] = v
  }

  is_server(): boolean {
    return this._msg.type === type.SERVER
  }

  is_client(): boolean {
    return !this.is_server()
  }

  is_incoming(): boolean {
    return this._msg.dir === dir.INCOMING
  }

  is_outgoing(): boolean {
    return !this.is_incoming()
  }

  show_arg(V: boolean): boolean {
    return V || (this.is_server() && this.is_incoming()) || (this.is_client() && this.is_outgoing())
  }

  show_res(V: boolean): boolean {
    return V || (this.is_server() && this.is_outgoing()) || (this.is_client() && this.is_incoming())
  }
}

export function make_debugger(d: number | string, lo: log.Logger): Debugger | null {
  if (d === 0) return null
  return new Debugger(d, lo, lo.debug.bind(lo))
}
