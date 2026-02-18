/**
 * A Ring of buffers. Every so often you'll have to compress buffers into
 * smaller buffers, but try to limit that as much as possible.
 */
export class Ring {
  private _bufs: Uint8Array[] = []
  private _len: number = 0

  buffer(b: Uint8Array): void {
    this._bufs.push(b)
    this._len += b.length
  }

  len(): number {
    return this._len
  }

  grab(n_wanted: number): Uint8Array | null {
    // Fail fast if there just aren't enough bytes
    if (n_wanted > this.len()) return null

    // fast-path is that we're already set up
    if (this._bufs.length && this._bufs[0].length >= n_wanted) {
      return this._bufs[0]
    }

    let n_grabbed = 0
    let num_bufs = 0

    for (const b of this._bufs) {
      n_grabbed += b.length
      num_bufs++
      if (n_grabbed >= n_wanted) {
        break
      }
    }

    // now make a buffer that's potentially bigger than what we wanted
    const ret = new Uint8Array(n_grabbed)
    let n = 0

    // now copy all of those num_bufs into ret
    for (const b of this._bufs.slice(0, num_bufs)) {
      const sub = ret.subarray(n, n + b.length)
      sub.set(b)
      n += b.length
    }

    // this first buffer that we'll be keeping (the returned buffer)
    const first_pos = num_bufs - 1
    this._bufs[first_pos] = ret
    this._bufs.splice(0, first_pos)

    return ret
  }

  consume(n: number): void {
    if (this._bufs.length === 0 || this._bufs[0].length < n) {
      throw new Error(`Ring underflow; can't remove ${n} bytes`)
    }
    const b = this._bufs[0]
    if (b.length === n) {
      this._bufs.splice(0, 1)
    } else {
      this._bufs[0] = b.subarray(n)
    }
    this._len -= n
  }
}
