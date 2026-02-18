let mp: any = null
let pp: any = null
let mpmp: any = null

try {
  mp = require('msgpack')
} catch {}

try {
  pp = require('purepack')
} catch {}

try {
  mpmp = require('@msgpack/msgpack')
} catch {}

if (!mp && !pp && !mpmp) {
  throw new Error('Need either msgpack, purepack, or @msgpack/msgpack to run')
}

let _opts: Record<string, any> = {}

export function set_opt(k: string, v: any): void {
  _opts[k] = v
}

export function set_opts(o: Record<string, any>): void {
  _opts = o
}

export function get_encode_lib(): string {
  const encode_lib = _opts.encode_lib || '@msgpack/msgpack'
  switch (encode_lib) {
    case 'purepack':
    case 'msgpack':
    case '@msgpack/msgpack':
      return encode_lib
  }
  throw new Error(`Unsupported encode library ${encode_lib}`)
}

export function use_byte_arrays(): void {
  if (!pp) {
    try {
      const encode_lib = get_encode_lib()
      switch (encode_lib) {
        case 'purepack':
          pp = require('purepack')
          break
        case 'msgpack':
          throw new Error('not supported')
        case '@msgpack/msgpack':
          mpmp = require('@msgpack/msgpack')
          break
      }
    } catch {
      throw new Error("Cannot use_byte_arrays without 'purepack' or '@msgpack/msgpack!'")
    }
  }
}

export function pack(b: any): Uint8Array {
  const encode_lib = get_encode_lib()
  switch (encode_lib) {
    case 'purepack':
      return pp.pack(b)
    case 'msgpack':
      return mp.pack(b)
    case '@msgpack/msgpack':
      return mpmp.encode(b)
  }
  throw new Error(`Unsupported encode library ${encode_lib}`)
}

export function unpack(b: Uint8Array): [any, any] {
  let err: any = null
  let dat: any = null
  const encode_lib = get_encode_lib()
  switch (encode_lib) {
    case 'purepack':
      try {
        dat = pp.unpack(b)
      } catch (e) {
        err = e
      }
      break
    case 'msgpack':
      try {
        dat = mp.unpack(b)
      } catch (e) {
        err = e
      }
      break
    case '@msgpack/msgpack':
      try {
        dat = mpmp.decode(b)
      } catch (e) {
        err = e
      }
      break
  }
  return [err, dat]
}
