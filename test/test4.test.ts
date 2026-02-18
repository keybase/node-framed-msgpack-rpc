import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import crypto from 'crypto'
import {server} from '../src/main'
import {COMPRESSION_TYPE_NONE, COMPRESSION_TYPE_GZIP} from '../src/dispatch'
import {connect} from './helpers'

const PORT = 8881

class P_v1 extends server.Handler {
  h_reflect(arg: any, res: any) {
    res.result(arg)
  }
}

describe('test4 - random object volleys', () => {
  let s: InstanceType<typeof server.ContextualServer>

  beforeAll(async () => {
    s = new server.ContextualServer({
      port: PORT,
      classes: {
        'P.1': P_v1 as any,
      },
    })
    await s.listen()
  })

  afterAll(async () => {
    await s.close()
  })

  it('volley_of_strings', async () => {
    const n = 100
    const {x, c} = await connect(PORT, 'P.1')

    const args: any[] = []
    for (let i = 0; i <= n; i++) {
      const buf = crypto.randomBytes(10000)
      args.push({r: buf.toString('base64')})
    }

    // normal invoke - parallel
    const results = await Promise.all(args.map(a => c.invoke('reflect', a)))
    for (let i = 0; i < results.length; i++) {
      expect(results[i].error).toBeFalsy()
      expect(results[i].result).toEqual(args[i])
    }

    // compressed gzip - parallel
    const results2 = await Promise.all(args.map(a => c.invoke_compressed('reflect', COMPRESSION_TYPE_GZIP, a)))
    for (let i = 0; i < results2.length; i++) {
      expect(results2[i].error).toBeFalsy()
      expect(results2[i].result).toEqual(args[i])
    }

    // compressed none - parallel
    const results3 = await Promise.all(args.map(a => c.invoke_compressed('reflect', COMPRESSION_TYPE_NONE, a)))
    for (let i = 0; i < results3.length; i++) {
      expect(results3[i].error).toBeFalsy()
      expect(results3[i].result).toEqual(args[i])
    }

    x.close()
  })

  it('volley_of_objects', async () => {
    const rj = require('random-json')
    const n = 400
    const {x, c} = await connect(PORT, 'P.1')

    const args: any[] = []
    for (let i = 0; i <= n; i++) {
      const obj = await new Promise<any>(resolve => rj.obj(resolve))
      args.push(obj)
    }

    // normal invoke - parallel
    const results = await Promise.all(args.map(a => c.invoke('reflect', a)))
    for (let i = 0; i < results.length; i++) {
      expect(results[i].error).toBeFalsy()
      expect(results[i].result).toEqual(args[i])
    }

    // compressed gzip - parallel
    const results2 = await Promise.all(args.map(a => c.invoke_compressed('reflect', COMPRESSION_TYPE_GZIP, a)))
    for (let i = 0; i < results2.length; i++) {
      expect(results2[i].error).toBeFalsy()
      expect(results2[i].result).toEqual(args[i])
    }

    // compressed none - parallel
    const results3 = await Promise.all(args.map(a => c.invoke_compressed('reflect', COMPRESSION_TYPE_NONE, a)))
    for (let i = 0; i < results3.length; i++) {
      expect(results3[i].error).toBeFalsy()
      expect(results3[i].result).toEqual(args[i])
    }

    x.close()
  })
})
