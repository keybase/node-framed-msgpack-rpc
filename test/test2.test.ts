import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {Server, Transport, Client} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'
import {connect} from './helpers'

const PORT = 8881

describe('test2 - rebind', () => {
  let s: InstanceType<typeof Server>

  beforeAll(async () => {
    s = new Server({
      port: PORT,
      programs: {
        'P.1': {
          foo: (arg: any, res: any) => res.result({y: arg.i + 2}),
          bar: (arg: any, res: any) => res.result({y: arg.j * arg.k}),
        },
      },
    })
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

    x.close()
  }

  it('test1', async () => {
    await test_A()
  })

  it('test2', async () => {
    await test_A()
  })
})
