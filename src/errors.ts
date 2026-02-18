export const UNKNOWN_METHOD = 100
export const EOF = 101

export class EofError extends Error {
  code: number
  constructor(message?: string) {
    super(message || 'EOF from server')
    this.name = 'EofError'
    this.code = EOF
  }
}

export class UnknownMethodError extends Error {
  code: number
  method: string
  constructor(method: string) {
    super(`unknown method: ${method}`)
    this.name = 'UnknownMethodError'
    this.code = UNKNOWN_METHOD
    this.method = method
  }

  toString(): string {
    return `unknown method: ${this.method}`
  }
}
