#! /usr/bin/env iced

# Test connecting over TLS with a hardcoded CA cert.

fs = require 'fs'
path = require 'path'
{transport, client, debug, errors} = require '../src/main'

PORT = 8125

ignoreServerIdentity = (servername, cert) ->
  console.log "Allowing any servername for testing. Servername: #{servername}"

# stolen from test11.iced
class MyTransport extends transport.Transport
  unwrap_incoming_error : (o) ->
    if not o? then o
    else if typeof o is 'object'
      switch o.code
        when errors.UNKNOWN_METHOD
          err = new errors.UnknownMethodError o.message
          err.method = o.method
          err
        else
          fields = if o.fields? then " #{JSON.stringify o.fields}" else ""
          new Error "#{o.code} #{o.name}: #{o.desc}#{fields}"
    else
      new Error o

# MerkleTreeID.KBFS_PUBLIC_1 from common.avdl.
KBFS_PUBLIC_MERKLE_TREE_ID = 1

main = (cb) ->
  tls_opts = {
    ca: fs.readFileSync(path.join(__dirname, '../../kbfs/kbfsdocker/docker_cert.pem'))
    checkServerIdentity: ignoreServerIdentity
  }
  trans = new MyTransport { port: PORT, host: "localhost", tls_opts}
  trans.set_debugger new debug.Debugger debug.constants.flags.LEVEL_4

  await trans.connect defer err
  if err?
    console.log "Failed to connect in Transport:", err
    trans.close()
  else
    c = new client.Client trans, "keybase.1"
    arg =
      treeID: KBFS_PUBLIC_MERKLE_TREE_ID
    await c.invoke "metadata.getMerkleRootLatest", [arg], defer err, result
    console.log("result:", result)
    console.log("error:", err)
  trans.close()
  cb err

await main defer()
