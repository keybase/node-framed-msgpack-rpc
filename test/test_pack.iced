{pack} = require '../src/main'


exports.test_encode_lib = (T, cb) ->
  T.equal 'purepack', pack.get_encode_lib()
  pack.set_opt 'encode_lib', '@msgpack/msgpack'
  T.equal '@msgpack/msgpack', pack.get_encode_lib()
  pack.set_opt 'encode_lib', 'protobuf'
  try
    encode_lib = get_encode_lib()
  catch err
    T.assert err?
  T.assert not encode_lib?
  cb null
