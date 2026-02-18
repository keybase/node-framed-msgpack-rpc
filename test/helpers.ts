import {Transport, RobustTransport, Client, log} from '../src/main'

log.set_default_level(log.levels.TOP)

export const PORT = 8881

export interface RobustOpts {
  reconnect_delay?: number
  queue_max?: number
  warn_threshhold?: number
  error_threshhold?: number
}

export async function connect(
  port: number | string,
  prog: string,
  rtopts?: RobustOpts
): Promise<{x: Transport | RobustTransport; c: Client}> {
  let opts: any
  if (typeof port === 'string' || isNaN(port as number)) {
    opts = {path: port}
  } else {
    opts = {port, host: '-'}
  }
  const klass = rtopts ? RobustTransport : Transport
  const x = new klass(opts, rtopts)
  const err = await x.connect()
  if (err) {
    throw err
  }
  const c = new Client(x, prog)
  return {x, c}
}

export async function test_rpc(
  cli: Client,
  method: string,
  arg: any,
  expected: any
): Promise<{error: any; result: any}> {
  const {error, result} = await cli.invoke(method, arg)
  return {error, result}
}
