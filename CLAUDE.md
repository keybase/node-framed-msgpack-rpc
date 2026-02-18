# CLAUDE.md

## Build & Test Commands

- **Build:** `npm run build` — compiles TypeScript (`src/*.ts`) to JavaScript (`lib/*.js`) with declarations
- **Test:** `npm test` — runs the full test suite via vitest
- **Type check:** `npx tsc --noEmit` — type check without emitting

Source language is TypeScript (`.ts` files) with async/await for async control flow.

## Architecture

Framed msgpack-RPC library for Node.js used by Keybase. Messages are msgpack-encoded and length-prefixed (framed).

### Class Hierarchy

```
Packetizer        — frame-level read/write (length-prefixed msgpack)
  └─ Dispatch     — RPC message routing (invoke/response/notify), handler registry
       └─ Transport        — TCP/TLS/Unix socket connection management
            └─ RobustTransport — auto-reconnect with call queuing
```

### Key Modules

| File | Role |
|------|------|
| `transport.ts` | `Transport` (single connection) and `RobustTransport` (auto-reconnect + queue) |
| `dispatch.ts` | `Dispatch` — RPC invoke/response/notify routing; `Response` helper |
| `packetizer.ts` | Framing: length-prefix encoding/decoding over a byte ring buffer |
| `client.ts` | `Client` — thin wrapper; binds a program name to a transport for `invoke`/`notify` |
| `server.ts` | `Server`, `SimpleServer`, `ContextualServer`, `Handler` — listener-based servers |
| `listener.ts` | `Listener` — TCP/TLS server socket accepting connections, spawns Transports |
| `pack.ts` | Msgpack encode/decode abstraction (supports `@msgpack/msgpack`, `purepack`, `msgpack`) |
| `ring.ts` | `Ring` — circular byte buffer for the packetizer |
| `errors.ts` | Error types: `EofError`, `UnknownMethodError` |
| `log.ts` | Logging infrastructure |
| `debug.ts` | Debug message tracing |
| `lock.ts` | Promise-based `Lock` with `acquire()`/`release()` |

### RPC Protocol (msgpack arrays)

- **Invoke:** `[0, seqid, method, param]`
- **Response:** `[1, seqid, error, result]`
- **Notify:** `[2, method, param]` (fire-and-forget)
- **Invoke Compressed:** `[4, seqid, ctype, method, param]` (gzip via pako)

### Entry Point

`src/main.ts` → `lib/main.js` — re-exports all public classes and the version.

### Async API

All async operations use Promises/async-await:
- `client.invoke(method, args)` → `Promise<{error, result}>`
- `client.invoke_compressed(method, ctype, args)` → `Promise<{error, result}>`
- `transport.connect()` → `Promise<Error | null>`
- `listener.listen()` → `Promise<void>`
- `listener.close()` → `Promise<void>`

### Tests

Tests use vitest with sequential execution (tests share ports). Test files are in `test/*.test.ts`.
