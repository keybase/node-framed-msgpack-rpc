## v1.1.18 (2019-03-28)

 * fix long socket path workaround

## v1.1.17 (2019-03-28)

 * fix package.json

## v1.1.16 (2019-02-01)

 * use Buffer.from not (new Buffer)

## v1.1.15 (2018-09-25)

Bugfixes:
 * fix for android path problem

## v1.1.14 (2018-09-24)

Bugfixes:
 * allow connection to Unix domain sockets with really long names

## v1.1.13 (2016-08-17)

Bufixes:
 * Fix crasher in the error path of _packetizer_error
 * merges from electron fixes

## v1.1.11 (2016-03-03)

Bugfixes:
  * Fix a dropped error in Dispatch.

## v1.1.10 (2016-03-03)

Features:
  * Add initial support for TLS.

## v1.1.9 (2015-08-22)

Features:
  * Add `generic_handler` which can handle any method and will do the
    switching itself.

## v1.1.8 (2015-08-17)

Features:
  * Typed error classes, start to roll them out
  * Ability to wrap an error in a subclass if you want to handle it as 
    something other than a string before it's output via msgpack
