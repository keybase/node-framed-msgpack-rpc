try
  mp = require 'msgpack'
catch e

if not mp?
  try
    pp = require '@msgpack/msgpack'
    mp = pp
  catch e

if not mp? and not pp?
  throw new Error "Need either msgpack or purepack to run"

##==============================================================================

_opts = {}

exports.set_opt = set_opt = (k,v) -> _opts[k] = v
exports.set_opts = set_opts = (o) -> _opts = o

# If we want to use byte arrays, we need purepack and not msgpack4 or msgpack!
exports.use_byte_arrays = () ->
  if not pp?
    try
      mp = pp = require '@msgpack/msgpack'
    catch err
      throw new Error "Cannot use_byte_arrays without purepack!"

exports.pack = (b) ->
    encoded = mp.encode(b)
    Buffer.from encoded.buffer, encoded.byteOffset, encoded.byteLength


exports.unpack = (b) ->
  err = dat = null
  try dat = mp.decode b
  catch err
  [err, dat]

##==============================================================================
