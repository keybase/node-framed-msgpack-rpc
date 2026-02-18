import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import fs from 'fs'
import path from 'path'
import {server, transport, client} from '../src/main'

const PORT = 8881

describe('test12 - TLS connections', () => {
  let s: InstanceType<typeof server.Server>

  beforeAll(async () => {
    const tls_opts = {
      key: fs.readFileSync(path.join(__dirname, 'ca/good/server-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ca/good/server-crt.pem')),
      ca: fs.readFileSync(path.join(__dirname, 'ca/good/ca-crt.pem')),
    }
    s = new server.Server({
      port: PORT,
      programs: {
        'P.1': {
          question: (_arg: any, res: any) => res.result('ANSWER!'),
        },
      },
      tls_opts,
    })
    await s.listen()
  })

  afterAll(async () => {
    await s.close()
  })

  it('test_good_hardcoded_CA_cert', async () => {
    const tls_opts = {
      ca: fs.readFileSync(path.join(__dirname, 'ca/good/ca-crt.pem')),
    }
    const x = new transport.Transport({port: PORT, host: '-', tls_opts})
    const err = await x.connect()
    expect(err).toBeNull()

    const c = new client.Client(x, 'P.1')
    const res = await c.invoke('question', {})
    expect(res.error).toBeFalsy()
    expect(res.result).toBe('ANSWER!')
    x.close()
  })

  it('test_bad_hardcoded_CA_cert', async () => {
    const tls_opts = {
      ca: fs.readFileSync(path.join(__dirname, 'ca/bad/ca-crt.pem')),
    }
    const x = new transport.Transport({port: PORT, host: '-', tls_opts})
    const err = await x.connect()
    expect(err).toBeTruthy()
    expect(err!.code).toBe('CERT_SIGNATURE_FAILURE')
    x.close()
  })
})
