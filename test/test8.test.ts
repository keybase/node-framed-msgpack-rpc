import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {server, Client, RobustTransport} from '../src/main'
import {COMPRESSION_TYPE_GZIP} from '../src/dispatch'

const PORT = 8881
const PROT = 'P.1'
const CONST = 110

class MyServer extends server.SimpleServer {
  _x: number
  constructor(d: any) {
    super(d)
    this._x = CONST
  }

  get_program_name() {
    return PROT
  }
  h_reflect(arg: any, res: any) {
    res.result(arg)
  }
  h_get_x(arg: any, res: any) {
    const o = {x: this._x}
    this._x++
    res.result(o)
  }
}

describe('test8 - SimpleServer', () => {
  let s: MyServer
  let clix: RobustTransport
  let cli: Client

  beforeAll(async () => {
    s = new MyServer({port: PORT})
    await s.listen()

    const x = new RobustTransport({port: PORT, host: '-'}, {})
    const err = await x.connect()
    expect(err).toBeNull()
    clix = x
    cli = new Client(x, PROT)
  })

  afterAll(async () => {
    clix.close()
    await s.close()
  })

  it('test1', async () => {
    const arg = {
      x: 'simple stuff here',
      v: Array.from({length: 101}, (_, i) => i),
    }

    const n = 4
    for (let i = 0; i < n; i++) {
      let res = await cli.invoke('reflect', arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)

      res = await cli.invoke('get_x', arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual({x: CONST + i})
    }

    for (let i = 0; i < n; i++) {
      let res = await cli.invoke_compressed('reflect', COMPRESSION_TYPE_GZIP, arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual(arg)

      res = await cli.invoke_compressed('get_x', COMPRESSION_TYPE_GZIP, arg)
      expect(res.error).toBeFalsy()
      expect(res.result).toEqual({x: CONST + i + n})
    }
  })
})
