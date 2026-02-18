import * as server from './server'
import * as client from './client'
import * as transport from './transport'
import * as log from './log'
import * as debug from './debug'
import * as pack from './pack'
import * as errors from './errors'
import * as dispatch from './dispatch'
import * as listener from './listener'

export {server, client, transport, log, debug, pack, errors, dispatch, listener}

export const Server = server.Server
export const SimpleServer = server.SimpleServer
export const ContextualServer = server.ContextualServer
export const Handler = server.Handler
export const Client = client.Client
export const Transport = transport.Transport
export const RobustTransport = transport.RobustTransport
export const Logger = log.Logger
export const createTransport = transport.createTransport

export {version} from './version'

import {version} from './version'

export function at_version(v: string): boolean {
  const A = version.split('.')
  const B = v.split('.')
  while (A.length && B.length) {
    const a = parseInt(A.shift()!)
    const b = parseInt(B.shift()!)
    if (a < b) return false
    else if (a > b) return true
  }
  if (A.length === 0 && B.length > 0) return false
  else if (A.length > 0 && B.length === 0) return true
  return true
}
