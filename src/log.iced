
util = require 'util'

#
# The standard logger for saying that things went wrong, or state changed,
# inside the RPC system.  You can of course change this to be whatever you'd
# like via the @log_obj member of the Transport class.
#

exports.levels = L =
  NONE : 0
  DEBUG : 1
  INFO : 2
  WARN : 3
  ERROR : 4
  FATAL : 5
  TOP : 6

default_level = L.INFO

##=======================================================================

stringify = (o) ->
  if not o? then ""
  else if Buffer.isBuffer(o) then o.toString('utf8')
  else if util.isError(o) then o.toString()
  else ("" + o)

##=======================================================================

exports.Logger = class Logger
  constructor : ({@prefix, @remote, @level}) ->
    @prefix = "RPC" unless @prefix
    @remote = "-" unless @remote
    @output_hook = (m) -> console.log m
    @level = if @level? then @level else default_level

  set_level : (l) -> @level = l
  set_remote : (r) -> @remote = r
  set_prefix : (p) -> @prefix = p

  debug : (m) -> @_log m, "D", null, L.DEBUG if @level <= L.DEBUG
  info : (m) ->  @_log m, "I", null, L.INFO if @level <= L.INFO
  warn : (m) ->  @_log m, "W", null, L.WARN if @level <= L.WARN
  error : (m) -> @_log m, "E", null, L.ERROR if @level <= L.ERROR
  fatal : (m) -> @_log m, "F", null, L.FATAL if @level <= L.FATAL

  _log : (m, l, ohook, level) ->
    parts = []
    parts.push @prefix if @prefix?
    parts.push "[#{l}]" if l
    parts.push @remote if @remote
    parts.push stringify m
    ohook = @output_hook unless ohook
    ohook (parts.join " "), level

  make_child : (d) -> return new Logger d

##=======================================================================

default_logger_class = Logger

##=======================================================================

exports.set_default_level = (l) -> default_level = l
exports.set_default_logger_class = (k) -> default_logger_class =  k

##=======================================================================

exports.new_default_logger = (d = {}) -> return new default_logger_class d

##=======================================================================
