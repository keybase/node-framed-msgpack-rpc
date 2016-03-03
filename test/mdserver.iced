#! /usr/bin/env iced

# Test connecting over TLS with a hardcoded CA cert.

fs = require 'fs'
path = require 'path'
{transport, client, debug, errors} = require '../src/main'
purepack = require 'purepack'

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

# from common.avdl.
KBFS_PUBLIC_MERKLE_TREE_ID = 1
KBFS_PRIVATE_MERKLE_TREE_ID = 2

main = (cb) ->
  tls_opts = {
    ca: fs.readFileSync(path.join(__dirname, 'root_cert.pem'))
    # checkServerIdentity: ignoreServerIdentity
  }
  trans = new MyTransport { port: 443, host: "mdserver.kbfs.keybase.io", tls_opts}
  # trans.set_debugger new debug.Debugger debug.constants.flags.LEVEL_4

  await trans.connect defer err
  if err?
    console.log "Failed to connect in Transport:", err
    trans.close()
  else
    do_one = (tree_name, tree_id, cb) ->
        c = new client.Client trans, "keybase.1"
        arg =
          treeID: tree_id
        await c.invoke "metadata.getMerkleRootLatest", [arg], defer err, result
        console.log("#{tree_name} result:", result)
        console.log("#{tree_name} version:", result.version)
        console.log("#{tree_name} unpacked blob:", purepack.unpack(result.root))
        console.log("#{tree_name} base64 root:", result.root.toString("base64"))
        console.log("#{tree_name} error:", err)
        cb()
    await do_one "public", KBFS_PUBLIC_MERKLE_TREE_ID, defer()
    await do_one "private", KBFS_PRIVATE_MERKLE_TREE_ID, defer()
  trans.close()
  cb err

await main defer()
