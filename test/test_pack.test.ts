import {describe, it, expect} from 'vitest'
import {pack} from '../src/main'

describe('test_pack', () => {
  it('test_encode_lib', () => {
    expect(pack.get_encode_lib()).toBe('@msgpack/msgpack')
    pack.set_opt('encode_lib', '@msgpack/msgpack')
    expect(pack.get_encode_lib()).toBe('@msgpack/msgpack')
    pack.set_opt('encode_lib', 'protobuf')
    let encode_lib: string | undefined
    try {
      encode_lib = pack.get_encode_lib()
    } catch (err) {
      expect(err).toBeTruthy()
    }
    expect(encode_lib).toBeUndefined()
    // Reset to default
    pack.set_opt('encode_lib', '@msgpack/msgpack')
  })
})
