import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {server, debug} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'
import {connect} from './helpers'

const PORT = 8881

class P_v1 extends server.Handler {
  h_foo(arg: any, res: any) {
    res.result({y: arg.i + 2})
  }
  h_bar(arg: any, res: any) {
    res.result({y: arg.j * arg.k})
  }
}

describe('test9 - debug flags', () => {
  let s: InstanceType<typeof server.ContextualServer>

  beforeAll(async () => {
    s = new server.ContextualServer({
      port: PORT,
      classes: {
        'P.1': P_v1 as any,
      },
    })
    s.set_debugger(new debug.Debugger(debug.constants.flags.LEVEL_4))
    await s.listen()
  })

  afterAll(async () => {
    await s.close()
  })

  async function test_A() {
    const {x, c} = await connect(PORT, 'P.1')

    let res = await c.invoke('foo', {i: 4})
    expect(res.error).toBeFalsy()
    expect(res.result).toEqual({y: 6})

    res = await c.invoke('bar', {j: 2, k: 7})
    expect(res.error).toBeFalsy()
    expect(res.result).toEqual({y: 14})

    res = await c.invoke_compressed('foo', COMPRESSION_TYPE_GZIP, {i: 4})
    expect(res.error).toBeFalsy()
    expect(res.result).toEqual({y: 6})

    res = await c.invoke_compressed('bar', COMPRESSION_TYPE_GZIP, {j: 2, k: 7})
    expect(res.error).toBeFalsy()
    expect(res.result).toEqual({y: 14})

    const bad = 'XXyyXX'
    res = await c.invoke(bad, {})
    expect(res.error).toBeTruthy()
    expect(res.error.toString()).toMatch(/unknown method/)

    res = await c.invoke(bad, {ctype: COMPRESSION_TYPE_GZIP})
    expect(res.error).toBeTruthy()
    expect(res.error.toString()).toMatch(/unknown method/)

    x.close()
  }

  it('test1', async () => {
    await test_A()
  })

  it('test2', async () => {
    await test_A()
  })
})
