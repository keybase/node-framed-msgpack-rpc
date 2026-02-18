export class Lock {
  private _locked: boolean = false
  private _waiters: Array<() => void> = []

  acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true
      return Promise.resolve()
    }
    return new Promise<void>(resolve => {
      this._waiters.push(resolve)
    })
  }

  release(): void {
    if (this._waiters.length > 0) {
      const next = this._waiters.shift()!
      next()
    } else {
      this._locked = false
    }
  }
}
