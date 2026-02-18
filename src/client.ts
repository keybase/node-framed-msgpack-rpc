import type {Dispatch} from './dispatch'

export class Client {
  transport: Dispatch
  program: string | null

  constructor(transport: Dispatch, program: string | null = null) {
    this.transport = transport
    this.program = program
  }

  async invoke(method: string, args: any): Promise<{error: any; result: any}> {
    return this.transport.invoke({program: this.program, method, args, notify: false})
  }

  async invoke_compressed(method: string, ctype: number, args: any): Promise<{error: any; result: any}> {
    return this.transport.invoke({program: this.program, method, ctype, args, notify: false})
  }

  notify(method: string, args: any): void {
    this.transport.invoke({program: this.program, method, args, notify: true})
  }
}
