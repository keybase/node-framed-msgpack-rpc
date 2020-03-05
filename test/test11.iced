
{log,errors,server,transport,client} = require "../"
{COMPRESSION_TYPE_GZIP} = require '../src/dispatch'

PORT = 19983

s = null

# A basic test in which client and server swap roles!
#------------------------------------------------------

exports.test_1 = (T,cb) ->

  s = new server.Server
    port : PORT
    programs :
      "P.1" :
        foo : (arg, res) ->
          await setTimeout defer(), 10
          c = new client.Client @, "Q.1"
          await c.invoke "cb", { i : arg.i, j : 15 }, defer err, res2
          if err?
            res.error err
          else
            res.result { y : res2.y*40 }

  await s.listen defer err
  return cb err if err?

  x = new transport.Transport { port : PORT, host : "-" }

  await x.connect defer err
  if err?
    console.log "Failed to connect in Transport..."
  else
    c = new client.Client x, "P.1"
    c.transport.add_programs {
      "Q.1" :
        cb : (arg, res) ->
          await setTimeout defer(), 10
          res.result { y : arg.i - arg.j }
    }
    await T.test_rpc c, "foo", { i : 20 }, { y : 200 }, defer()
    await T.test_rpc_compressed c, "foo", COMPRESSION_TYPE_GZIP, { i : 20 }, { y : 200 }, defer()
    x.close()
    x = c = null

  await s.close defer()
  cb err

# A more feature-ful test, in which errors are wrapped/unwrapped
# before they are sent over the wire.
#------------------------------------------------------

# This is our specialization of a server that just uses got_new_connection to specialize
# those the given 2 hooks.  This is a little bit of a hack, to operate on the instance,
# rather than the prototype, but it works, so let's go with it until we have a problem.
class MyServer extends server.Server

  got_new_connection : (c) ->
    super c
    c.get_handler_this = (m) => { conn : c, server : @ }
    c.wrap_outgoing_error = (e) -> { message : e.message, code : e.code, method : e.method }

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
          new Error err.message
    else
      new Error o

#--------------------

exports.test_2 = (T,cb) ->

  myServer = new MyServer
    port : PORT
    programs :
      "P.1" :
        foo : (arg, res) ->
          await setTimeout defer(), 10
          c = new client.Client @conn, "Q.1"
          await c.invoke "cb", { i : arg.i, j : 15 }, defer err, res2
          if err?
            res.error err
          else
            res.result { y : res2.y*40 }

  await myServer.listen defer err
  return cb err if err?

  x = new MyTransport { port : PORT, host : "-" }

  await x.connect defer err
  if err?
    console.log "Failed to connect in Transport..."
  else
    c = new client.Client x, "P.1"
    c.transport.add_programs {
      "Q.1" :
        cb : (arg, res) ->
          await setTimeout defer(), 10
          res.result { y : arg.i - arg.j }
    }
    await T.test_rpc c, "foo", { i : 20 }, { y : 200 }, defer()
    await T.test_rpc_compressed c, "foo", COMPRESSION_TYPE_GZIP, { i : 20 }, { y : 200 }, defer()

    # Now check that we've succesfully gotten an error, and the error
    # went through the wrapping/unwrapping system as we expect
    await c.invoke "bar", {}, defer e2, res
    T.assert (e2 instanceof errors.UnknownMethodError), "the right error message"
    T.equal e2.method, "P.1.bar", "method name equality"

    x.close()
    x = c = null

  await myServer.close defer()
  cb err

