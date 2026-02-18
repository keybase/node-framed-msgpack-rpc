import {unpack, pack} from './pack'
import {Ring} from './ring'

function msgpack_frame_len(buf: Uint8Array): number {
  const b = buf[0]
  if (b < 0x80) return 1
  else if (b === 0xcc) return 2
  else if (b === 0xcd) return 3
  else if (b === 0xce) return 5
  else return 0
}

function is_array(a: unknown): a is any[] {
  return typeof a === 'object' && Array.isArray(a)
}

// States
const FRAME = 1
const DATA = 2

// Results
const OK = 0
const WAIT = 1
const ERR = -1

export abstract class Packetizer {
  FRAME = FRAME
  DATA = DATA
  OK = OK
  WAIT = WAIT
  ERR = ERR

  private _ring: Ring
  private _state: number
  private _next_msg_len: number

  constructor() {
    this._ring = new Ring()
    this._state = FRAME
    this._next_msg_len = 0
  }

  abstract _raw_write(msg: string, enc: string): void
  abstract _packetize_error(err: string): void
  abstract _dispatch(msg: any[]): void

  _packetize_warning?(w: string): void

  private _buf_write(b: Uint8Array): void {
    let s = ''
    for (let i = 0; i < b.length; i++) {
      s += String.fromCharCode(b[i])
    }
    this._raw_write(s, 'binary')
  }

  send(msg: any): boolean {
    const b2 = pack(msg)
    const b1 = pack(b2.length)
    this._buf_write(b1)
    this._buf_write(b2)
    return true
  }

  private _get_frame(): number {
    // We need at least one byte to get started
    if (this._ring.len() <= 0) return WAIT

    // First get the frame's framing byte
    const f0 = this._ring.grab(1)
    if (!f0) return WAIT

    const frame_len = msgpack_frame_len(f0)
    if (!frame_len) {
      this._packetize_error('Bad frame header received')
      return ERR
    }

    // We now know how many bytes to suck in just to get the frame header
    const f_full = this._ring.grab(frame_len)
    if (f_full == null) return WAIT

    const [w, r] = unpack(f_full.subarray(0, frame_len))
    if (w != null && this._packetize_warning) this._packetize_warning(w)

    const typ = typeof r
    switch (typ) {
      case 'number':
        if (r < 0) throw new Error(`Negative len ${r} should not have happened`)
        this._ring.consume(frame_len)
        this._next_msg_len = r
        this._state = DATA
        return OK
      case 'undefined':
        return WAIT
      default:
        this._packetize_error(`bad frame; got type=${typ}, which is wrong`)
        return ERR
    }
  }

  private _get_msg(): number {
    const l = this._next_msg_len

    let ret: number
    if (l > this._ring.len()) {
      ret = WAIT
    } else {
      const b = this._ring.grab(l)
      if (b == null) {
        ret = WAIT
      } else {
        const [pw, msg] = unpack(b.subarray(0, l))
        if (msg == null) {
          this._packetize_error(`bad encoding found in data/payload; len=${l}`)
          ret = ERR
        } else if (!is_array(msg)) {
          this._packetize_error(`non-array found in data stream: ${JSON.stringify(msg)}`)
          ret = ERR
        } else {
          this._ring.consume(l)
          this._state = FRAME
          this._dispatch(msg)
          ret = OK
        }
        if (pw != null && this._packetize_warning) this._packetize_warning(pw)
      }
    }
    return ret
  }

  packetize_data(m: Uint8Array): void {
    this._ring.buffer(m)
    let go = OK
    while (go === OK) {
      go = this._state === FRAME ? this._get_frame() : this._get_msg()
    }
  }

  _packetizer_reset(): void {
    this._state = FRAME
    this._ring = new Ring()
  }
}
