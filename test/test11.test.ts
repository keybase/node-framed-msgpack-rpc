import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {log, errors, server, transport, client} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'

const PORT = 19983

describe('test11 - bidirectional RPC + error wrapping', () => {
  it('test_1 - basic bidirectional', async () => {
    const s = new server.Server({
      port: PORT,
      programs: {
        'P.1': {
          foo: async function (this: any, arg: any, res: any) {
            await new Promise(r => setTimeout(r, 10))
            const c = new client.Client(this, 'Q.1')
            const {error: err, result: res2} = await c.invoke('cb', {i: arg.i, j: 15})
            if (err) {
              res.error(err)
            } else {
              res.result({y: res2.y * 40})
            }
          },
        },
      },
    })

    await s.listen()

    const x = new transport.Transport({port: PORT, host: '-'})
    const err = await x.connect()
    expect(err).toBeNull()

    const c = new client.Client(x, 'P.1')
    c.transport.add_programs({
      'Q.1': {
        cb: async (arg: any, res: any) => {
          await new Promise(r => setTimeout(r, 10))
          res.result({y: arg.i - arg.j})
        },
      },
    })

    let result = await c.invoke('foo', {i: 20})
    expect(result.error).toBeFalsy()
    expect(result.result).toEqual({y: 200})

    result = await c.invoke_compressed('foo', COMPRESSION_TYPE_GZIP, {i: 20})
    expect(result.error).toBeFalsy()
    expect(result.result).toEqual({y: 200})

    x.close()
    await s.close()
  })

  it('test_2 - error wrapping', async () => {
    class MyServer extends server.Server {
      got_new_connection(c: any) {
        super.got_new_connection(c)
        c.get_handler_this = (_m: string) => ({conn: c, server: this})
        c.wrap_outgoing_error = (e: any) => ({message: e.message, code: e.code, method: e.method})
      }
    }

    class MyTransport extends transport.Transport {
      unwrap_incoming_error(o: any): any {
        if (o == null) return o
        if (typeof o === 'object') {
          switch (o.code) {
            case errors.UNKNOWN_METHOD: {
              const err = new errors.UnknownMethodError(o.message)
              err.method = o.method
              return err
            }
            default:
              return new Error(o.message)
          }
        }
        return new Error(o)
      }
    }

    const myServer = new MyServer({
      port: PORT,
      programs: {
        'P.1': {
          foo: async function (this: any, arg: any, res: any) {
            await new Promise(r => setTimeout(r, 10))
            const c = new client.Client(this.conn, 'Q.1')
            const {error: err, result: res2} = await c.invoke('cb', {i: arg.i, j: 15})
            if (err) {
              res.error(err)
            } else {
              res.result({y: res2.y * 40})
            }
          },
        },
      },
    })

    await myServer.listen()

    const x = new MyTransport({port: PORT, host: '-'})
    const err = await x.connect()
    expect(err).toBeNull()

    const c = new client.Client(x, 'P.1')
    c.transport.add_programs({
      'Q.1': {
        cb: async (arg: any, res: any) => {
          await new Promise(r => setTimeout(r, 10))
          res.result({y: arg.i - arg.j})
        },
      },
    })

    let result = await c.invoke('foo', {i: 20})
    expect(result.error).toBeFalsy()
    expect(result.result).toEqual({y: 200})

    result = await c.invoke_compressed('foo', COMPRESSION_TYPE_GZIP, {i: 20})
    expect(result.error).toBeFalsy()
    expect(result.result).toEqual({y: 200})

    // Now check error wrapping/unwrapping
    const e2result = await c.invoke('bar', {})
    expect(e2result.error).toBeInstanceOf(errors.UnknownMethodError)
    expect(e2result.error.method).toBe('P.1.bar')

    x.close()
    await myServer.close()
  })
})
