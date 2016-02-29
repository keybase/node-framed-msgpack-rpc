#! /usr/bin/env iced

# Test connecting over TLS with a hardcoded CA cert.

fs = require 'fs'
path = require 'path'
{transport, client} = require '../src/main'

PORT = 8125

main = (cb) ->
  tls_opts = {
    ca: fs.readFileSync(path.join(__dirname, '../../kbfs/kbfsdocker/docker_cert.pem')),
  }
  trans = new transport.Transport { port: PORT, host: "localhost", tls_opts}
  await trans.connect defer err
  if err?
    console.log "Failed to connect in Transport:", err
    trans.close()
  else
    c = new client.Client trans, "P.1"
    await c.invoke "question", {}, defer err, result
    console.log("result:", result)
    console.log("error:", err)
  trans.close()
  cb err

await main defer()
