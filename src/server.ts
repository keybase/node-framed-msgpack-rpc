import {Listener} from './listener'
import {Transport} from './transport'
import type {TransportOpts} from './transport'
import type {ListNode} from './list'
import type {HookWrapperArgs} from './dispatch'
import net from 'net'
import tls from 'tls'

export function collect_hooks(proto: any): Record<string, Function> {
  const re = /^h_(.*)$/
  const hooks: Record<string, Function> = {}
  for (const k of Object.getOwnPropertyNames(proto)) {
    const m = k.match(re)
    if (m) {
      hooks[m[1]] = proto[k]
    }
  }
  return hooks
}

export class Server extends Listener {
  programs: Record<string, Record<string, Function>>

  constructor(d: {
    port?: number
    host?: string
    path?: string
    TransportClass?: new (opts: TransportOpts) => Transport
    log_obj?: any
    tls_opts?: Record<string, any>
    programs: Record<string, Record<string, Function>>
  }) {
    super(d)
    this.programs = d.programs
  }

  got_new_connection(c: Transport): void {
    c.add_programs(this.programs)
  }
}

export class SimpleServer extends Listener {
  _program: string | undefined
  _hooks: Record<string, Function> | undefined

  constructor(d: {
    port?: number
    host?: string
    path?: string
    TransportClass?: new (opts: TransportOpts) => Transport
    log_obj?: any
    tls_opts?: Record<string, any>
    program?: string
  }) {
    super(d)
    this._program = d.program
  }

  get_hook_wrapper(): ((args: HookWrapperArgs) => void) | null {
    return null
  }

  got_new_connection(c: Transport): void {
    this._hooks = collect_hooks(Object.getPrototypeOf(this))
    c.add_program(this.get_program_name(), this._hooks)
  }

  set_program_name(p: string): void {
    this._program = p
  }

  get_program_name(): string {
    const r = this._program
    if (r == null) throw new Error("No 'program' given")
    return r
  }

  make_new_transport(c: net.Socket | tls.TLSSocket): Transport & ListNode {
    const x = super.make_new_transport(c)
    const self = this
    ;(x as any).get_handler_this = (_m: string) => self
    ;(x as any).get_hook_wrapper = () => self.get_hook_wrapper()
    return x
  }
}

export class Handler {
  transport: Transport
  server: Listener

  constructor({transport, server}: {transport: Transport; server: Listener}) {
    this.transport = transport
    this.server = server
  }

  static collect_hooks(): Record<string, Function> {
    return collect_hooks(this.prototype)
  }
}

export class ContextualServer extends Listener {
  programs: Record<string, Record<string, Function>> = {}
  classes: Record<string, typeof Handler>

  constructor(d: {
    port?: number
    host?: string
    path?: string
    TransportClass?: new (opts: TransportOpts) => Transport
    log_obj?: any
    tls_opts?: Record<string, any>
    classes: Record<string, typeof Handler>
  }) {
    super(d)
    this.classes = d.classes
    for (const [n, klass] of Object.entries(this.classes)) {
      this.programs[n] = klass.collect_hooks()
    }
  }

  got_new_connection(c: Transport): void {
    c.add_programs(this.programs)
  }

  make_new_transport(c: net.Socket | tls.TLSSocket): Transport & ListNode {
    const x = super.make_new_transport(c)

    const ctx: Record<string, Handler> = {}
    for (const [n, klass] of Object.entries(this.classes)) {
      ctx[n] = new klass({transport: x, server: this})
    }

    ;(x as any).get_handler_this = (m: string) => {
      const pn = m.split('.').slice(0, -1).join('.')
      const obj = ctx[pn]
      if (!obj) throw new Error(`Couldn't find prog ${pn}`)
      return obj
    }

    return x
  }
}
