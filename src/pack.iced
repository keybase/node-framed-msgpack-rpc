try
  mp = require 'msgpack'
catch e

try
  pp = require 'purepack'
catch e

try
  mpmp = require '@msgpack/msgpack'
catch e

if not mp? and not pp? and not mpmp?
  throw new Error "Need either msgpack, purepack, or @msgpack/msgpack to run"

##==============================================================================

_opts = {}

exports.set_opt = set_opt = (k,v) -> _opts[k] = v
exports.set_opts = set_opts = (o) -> _opts = o
exports.get_encode_lib = get_encode_lib = () ->
  encode_lib = _opts.encode_lib or "purepack"
  switch encode_lib
    when "purepack", "msgpack", "@msgpack/msgpack"
      return encode_lib
  throw new Error "Unsupported encode library #{encode_lib}"

# If we want to use byte arrays, we need purepack and not msgpack4 or msgpack!
exports.use_byte_arrays = () ->
  if not pp?
    try
      encode_lib = get_encode_lib()
      switch encode_lib
        when "purepack"
          pp = require "purepack"
        when "msgpack"
          throw new Error "not supported"
        when "@msgpack/msgpack"
          mpmp = require "@msgpack/msgpack"
    catch err
      throw new Error "Cannot use_byte_arrays without 'purepack' or '@msgpack/msgpack!'"

exports.pack = (b) ->
  encode_lib = get_encode_lib()
  switch encode_lib
    when "purepack"
      return pp.pack b
    when "msgpack"
      return mp.pack b
    when "@msgpack/msgpack"
      encoded = mpmp.encode(b)
      return Buffer.from encoded.buffer, encoded.byteOffset, encoded.byteLength

exports.unpack = (b) ->
  err = dat = null
  encode_lib = get_encode_lib()
  switch encode_lib
    when "purepack"
      try dat = pp.unpack b
      catch err
    when "msgpack"
      try dat = mp.unpack b
      catch err
    when "@msgpack/msgpack"
      try dat = mpmp.decode b
      catch err
  [err, dat]

##==============================================================================
