# Test the isError helper function for cross-Node.js version compatibility

{log} = require '../src/main'
E = require '../src/errors'

exports.test_isError_with_actual_errors = (T, cb) ->
  # Test with standard Error
  err1 = new Error("test error")
  T.assert log.isError(err1), "Standard Error should be detected as error"
  
  # Test with TypeError
  err2 = new TypeError("type error")
  T.assert log.isError(err2), "TypeError should be detected as error"
  
  # Test with ReferenceError
  err3 = new ReferenceError("reference error")  
  T.assert log.isError(err3), "ReferenceError should be detected as error"
  
  # Test with custom Error subclass
  class CustomError extends Error
    constructor: (message) ->
      super(message)
      @name = "CustomError"
  
  err4 = new CustomError("custom error")
  T.assert log.isError(err4), "Custom Error subclass should be detected as error"
  
  # Test with iced-error generated EofError
  err5 = new E.EofError()
  T.assert log.isError(err5), "E.EofError should be detected as error"
  
  cb()

exports.test_isError_with_non_errors = (T, cb) ->
  # Test with null
  T.assert not log.isError(null), "null should not be detected as error"
  
  # Test with undefined
  T.assert not log.isError(undefined), "undefined should not be detected as error"
  
  # Test with string
  T.assert not log.isError("error string"), "string should not be detected as error"
  
  # Test with number
  T.assert not log.isError(42), "number should not be detected as error"
  
  # Test with boolean
  T.assert not log.isError(false), "boolean should not be detected as error"
  
  # Test with plain object
  T.assert not log.isError({message: "not an error"}), "plain object should not be detected as error"
  
  # Test with array
  T.assert not log.isError([]), "array should not be detected as error"
  
  # Test with function
  T.assert not log.isError(() -> "test"), "function should not be detected as error"
  
  cb()

exports.test_isError_with_error_like_objects = (T, cb) ->
  # Test with object that has error-like properties but isn't an Error
  fakeError = {
    name: "FakeError"
    message: "fake error message"
    stack: "fake stack trace"
  }
  T.assert not log.isError(fakeError), "error-like object should not be detected as error"
  
  # Test with object that has toString method returning error-like string
  weirdObject = {
    toString: () -> "Error: weird object"
  }
  T.assert not log.isError(weirdObject), "object with error-like toString should not be detected as error"
  
  cb()

exports.test_isError_cross_version_compatibility = (T, cb) ->
  console.log "Testing isError on Node.js #{process.version}"
  
  err = new Error("compatibility test")
  result = log.isError(err)
  
  T.assert result, "isError should work correctly on Node.js #{process.version}"
  
  # Test that the function exists and is callable
  T.assert typeof log.isError is 'function', "isError should be exported as a function"
  
  cb()

exports.test_isError_with_thrown_errors = (T, cb) ->
  # Test with caught errors from try/catch
  caught_error = null
  try
    throw new Error("thrown error")
  catch e
    caught_error = e
    
  T.assert log.isError(caught_error), "caught error should be detected as error"
  
  # Test with caught non-Error
  caught_non_error = null
  try
    throw "string error"
  catch e
    caught_non_error = e
    
  T.assert not log.isError(caught_non_error), "caught non-Error should not be detected as error"
  
  cb()
