export const levels = {
  NONE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  TOP: 6,
} as const

export type LogLevel = (typeof levels)[keyof typeof levels]

let default_level: LogLevel = levels.INFO

function stringify(o: unknown): string {
  if (o == null) return ''
  else if (o instanceof Uint8Array) return new TextDecoder().decode(o)
  else if ((Error as any).isError ? (Error as any).isError(o) : o instanceof Error) return o.toString()
  else return '' + o
}

export class Logger {
  prefix: string
  remote: string
  level: LogLevel
  output_hook: (m: string, level?: LogLevel) => void

  constructor({prefix, remote, level}: {prefix?: string; remote?: string; level?: LogLevel} = {}) {
    this.prefix = prefix || 'RPC'
    this.remote = remote || '-'
    this.output_hook = (m: string) => console.log(m)
    this.level = level != null ? level : default_level
  }

  set_level(l: LogLevel): void {
    this.level = l
  }
  set_remote(r: string): void {
    this.remote = r
  }
  set_prefix(p: string): void {
    this.prefix = p
  }

  debug(m: unknown): void {
    if (this.level <= levels.DEBUG) this._log(m, 'D', null, levels.DEBUG)
  }
  info(m: unknown): void {
    if (this.level <= levels.INFO) this._log(m, 'I', null, levels.INFO)
  }
  warn(m: unknown): void {
    if (this.level <= levels.WARN) this._log(m, 'W', null, levels.WARN)
  }
  error(m: unknown): void {
    if (this.level <= levels.ERROR) this._log(m, 'E', null, levels.ERROR)
  }
  fatal(m: unknown): void {
    if (this.level <= levels.FATAL) this._log(m, 'F', null, levels.FATAL)
  }

  _log(
    m: unknown,
    l: string | null,
    ohook: ((m: string, level?: LogLevel) => void) | null,
    level: LogLevel
  ): void {
    const parts: string[] = []
    if (this.prefix != null) parts.push(this.prefix)
    if (l) parts.push(`[${l}]`)
    if (this.remote) parts.push(this.remote)
    parts.push(stringify(m))
    if (!ohook) ohook = this.output_hook
    ohook(parts.join(' '), level)
  }

  make_child(d: {prefix?: string; remote?: string; level?: LogLevel}): Logger {
    return new Logger(d)
  }
}

let default_logger_class: new (d?: any) => Logger = Logger

export function set_default_level(l: LogLevel): void {
  default_level = l
}

export function set_default_logger_class(k: new (d?: any) => Logger): void {
  default_logger_class = k
}

export function new_default_logger(d: {prefix?: string; remote?: string; level?: LogLevel} = {}): Logger {
  return new default_logger_class(d)
}
