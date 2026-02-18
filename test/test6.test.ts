import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {server} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'
import {connect} from './helpers'

const PORT = 8881
const SLOW = 500

class P_v1 extends server.Handler {
  h_reflect(arg: any, res: any) {
    setTimeout(() => res.result(arg), SLOW)
  }
}

describe('test6 - RobustTransport threshold warnings', () => {
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

  it('slow_warnings', async () => {
    const rtops = {
      warn_threshhold: SLOW / 4000,
      error_threshhold: SLOW / 2000,
    }

    const {x, c} = await connect(PORT, 'P.1', rtops)

    const arg = {
      x: 'simple stuff here',
      v: Array.from({length: 101}, (_, i) => i),
    }

    const n = 4
    for (let i = 0; i < n; i++) {
      let res = await c.invoke('reflect', arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)

      res = await c.invoke_compressed('reflect', COMPRESSION_TYPE_GZIP, arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)
    }

    x.close()
  })
})
