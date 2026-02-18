export function time(): number {
  return new Date().getTime()
}

export class Timer {
  private _running: boolean = false
  private _total: number = 0
  private _ts: number = 0

  constructor(opts?: {start?: boolean}) {
    this.reset()
    if (opts?.start) this.start()
  }

  start(): void {
    if (!this._running) {
      this._ts = time()
      this._running = true
    }
  }

  stop(): number {
    if (this._running) {
      this._total += time() - this._ts
      this._running = false
    }
    return this._total
  }

  is_running(): boolean {
    return this._running
  }

  total(): number {
    return this._total
  }

  reset(): void {
    this._running = false
    this._total = 0
    this._ts = 0
  }
}
