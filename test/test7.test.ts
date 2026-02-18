import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {server, Client, RobustTransport} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'

const PORT = 8881

class P_v1 extends server.Handler {
  h_buggy(arg: any, res: any) {
    res.result(arg)
    // Generate random junk and send it down the pipe
    ;(this as any).transport._raw_write(Buffer.from([3, 4, 5, 6, 7, 8, 9]).toString('binary'), 'binary')
  }
  h_good(arg: any, res: any) {
    res.result(arg)
  }
}

describe('test7 - reconnect after server error', () => {
  let s: InstanceType<typeof server.ContextualServer>
  let clix: RobustTransport
  let cli: Client

  beforeAll(async () => {
    s = new server.ContextualServer({
      port: PORT,
      classes: {
        'P.1': P_v1 as any,
      },
    })
    await s.listen()

    const x = new RobustTransport({port: PORT, host: '-'}, {})
    const err = await x.connect()
    expect(err).toBeNull()
    clix = x
    cli = new Client(x, 'P.1')
  })

  afterAll(async () => {
    clix.close()
    await s.close()
  })

  it('reconnect_after_server_error', async () => {
    const arg = {
      x: 'simple stuff here',
      v: Array.from({length: 101}, (_, i) => i),
    }

    const n = 4
    for (let i = 0; i < n; i++) {
      const res = await cli.invoke('buggy', arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)
      await new Promise(r => setTimeout(r, 10))
    }
    for (let i = 0; i < n; i++) {
      const res = await cli.invoke_compressed('buggy', COMPRESSION_TYPE_GZIP, arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)
      await new Promise(r => setTimeout(r, 10))
    }
  })

  it('reconnect_after_client_error', async () => {
    const arg = {
      x: 'simple stuff here',
      v: Array.from({length: 101}, (_, i) => i),
    }
    const n = 4
    for (let i = 0; i < n; i++) {
      const res = await cli.invoke('good', arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)
      // Poop on ourselves
      clix._raw_write(Buffer.from([3, 4, 5, 6, 7, 8, 9]).toString('binary'), 'binary')
      await new Promise(r => setTimeout(r, 10))
    }

    for (let i = 0; i < n; i++) {
      const res = await cli.invoke_compressed('good', COMPRESSION_TYPE_GZIP, arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)
      // Poop on ourselves
      clix._raw_write(Buffer.from([3, 4, 5, 6, 7, 8, 9]).toString('binary'), 'binary')
      await new Promise(r => setTimeout(r, 10))
    }
  })
})
