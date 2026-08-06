# Testing the Seam CLI

How to decide, for any module in this repo, what kind of test it gets and where
the fake goes.

## Principles

1. **Classical by default.** Assert on returned values and on data captured at
   a process edge. A test that asserts "function A called function B" is
   testing the implementation unless B is the outside world.
2. **Fake only where data leaves the process** — the terminal, the wire, the
   disk location, the environment. Everything on our side of those edges stays
   real in every test, including sibling modules in `src/lib`.
3. **Fakes are injected values, never module-path substitution.**
   `vi.mock('./config/index.js')` couples the test to file layout and to the
   accidental shape of the import; a rename or internal refactor breaks tests
   while behavior is unchanged. A fake is a real implementation of a narrow
   interface, handed to the code under test.
4. **`createMemoryOutput()` + `setOutput()` is the house pattern**
   (`src/lib/output/`): a tiny interface, a real in-memory implementation, a
   capture you assert on. Config (`createMemoryConfigStore()` +
   `setConfigStore()`), the prompt layer (`createMemoryPrompt()` +
   `setPromptClient()`), and the Seam API get the same treatment; nothing else
   needs it. An interface with more than one implementation — the real edge
   and its memory fake — is fulfilled by **classes** (`HttpSeamApi` /
   `MemorySeamApi`, `TerminalPromptClient` / `MemoryPromptClient`,
   `PersistentConfigStore` / `MemoryConfigStore`), with `createFoo` factories kept
   as the convenient way to construct them.
5. **The e2e suite proves wiring once; module tests prove behavior
   everywhere.** Don't re-prove auth headers in a unit test, and don't push
   branching logic into `test/cli.test.ts`.

## Where tests live

- **Test fixtures live in `test/fixtures` and nowhere else.** Anything that
  exists for a test — a hand-built blueprint, seeded config files — never
  sits beside normal code.
- **A test that uses such a fixture is not a unit test.** It goes under
  `test/`, mirroring the source layout (`test/commands/registry.test.ts`
  tests `src/lib/commands/registry.ts`).
- **A test may sit beside its module in `src` only when it tests the module
  of the same name and imports nothing beyond it** — external packages and
  type-only imports excepted. The moment it needs another module's code (a
  memory fake from elsewhere, a sibling's helpers, a fixture), it moves
  under `test/`.

## Taxonomy

| Module kind                                                                                                              | The tell                                                     | Default test                                                                                                                                                                 | Gets faked                                                        | Never faked                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Pure transform** — `render/help`, `render/completion/render-*`, `output/select-response-payload`, `args/parse`         | Value in → value out; no I/O imports                         | Classical unit, real values                                                                                                                                                  | Nothing                                                           | Anything                                                         |
| **Decision over injected data** — `interact-for-command-selection` (non-interactive), `blueprint/endpoint`, `context.ts` | Takes `CliContext` / blueprint / config store as a parameter | Classical with a literal ctx object (`command-selection.test.ts` is the model)                                                                                               | Nothing — a hand-built blueprint literal is a fixture, not a fake | The traversal/decision logic                                     |
| **Prompt flow** — `interactions/*` importing `lib/prompt.js`                                                             | Imports `lib/prompt.js`                                      | Classical on the returned value, memory output, scripted prompt fake; assert the choice list _offered_ where the prompt is the UX                                            | The prompt layer (the whole `@clack/prompts` edge), output        | The module's own branching and param assembly                    |
| **Config & state** — `config/config-store`, `config/migrate`                                                             | Touches `Configstore` / `env-paths`                          | Classical against a real store in a temp directory — it's a JSON file, and split/merge/migration _is_ the behavior                                                           | The directory; env vars (`vi.stubEnv`)                            | `Configstore` or fs behavior                                     |
| **Network** — `http/request`, `auth/validate-token`, `blueprint/source-npm`                                              | Constructs `SeamHttp` or calls `fetch`                       | Classical against a fake port (or a stubbed global `fetch` with captured requests, as `blueprint/source-npm.test.ts` does); assert the payload sent _and_ the value returned | The `SeamApi` port / global `fetch`                               | Status handling, payload selection, formatting — that's the unit |
| **Orchestration** — `bin/cli.ts`                                                                                         | Reads argv/env, wires everything                             | E2e: spawn via `execa`, `node:http` fake server, XDG temp dirs (`test/cli.test.ts`)                                                                                          | The far end of the wire; the home directories                     | Anything in-process                                              |

## The mocking boundary

Legitimate fakes in this repo, exhaustively: the **terminal** (prompt layer +
output streams), the **wire** (fake `node:http` server for the spawned e2e; the
`SeamApi` port in-process; `fetch` stub for the npm registry), the **disk
location** (temp dirs — never a fake fs), and **env vars**. Everything else —
`Configstore`, blueprint traversal, response formatting, `command-spec`, any
sibling in `src/lib` — must stay real, because faking it removes exactly the
thing the test exists to prove.

## London vs. classical: the rule

A mock-verification assertion is legitimate **only when the interaction is
itself the user-observable contract** — when the message crosses a process
boundary. "We sent this request body to `/devices/list`" is behavior: the
request is the product. "The prompt offered these choices with these hints" is
behavior: the choices are what the user sees
(`blueprint-object.test.ts` asserting on the recorded `choices`
is the good in-repo example). "`resolveAuth` called `getConfigStore`" is
implementation: the contract is _what server comes back_, not how it was
looked up.

Even at a real boundary, prefer **capture-then-assert** over
`toHaveBeenCalledWith`: have the fake record what it received (like the e2e
server's `requests` array, or `createMemoryPrompt()`'s `questions`) and make
classical assertions on the capture. A good London test asserts on the content
of one outbound message; a bad one asserts call counts and ordering of
internal helpers.

## The real-HTTP line

A test earns a real HTTP server only if it proves wiring that exists solely in
the real transport stack: `SeamHttp` auth-header construction, token-type
dispatch, endpoint resolution, `validateStatus`, and the exit code of the
actual spawned process. That is `test/cli.test.ts` and nothing else. Everything
in-process fakes at the port. Today the e2e file is ~20% of tests; hold it
there — each user-visible flow once end-to-end, while new module tests grow the
HTTP-free share.

## The Seam SDK boundary

**Wrap it behind our own narrow port.** Not `vi.mock('./http/client.js')`, and
not dependency-injecting `SeamHttp`: both force the fake to imitate the SDK's
whole surface, so tests end up re-verifying the SDK's shape instead of our
behavior. The CLI is blueprint-driven and has one chokepoint: preparing a
`SeamHttpRequest` for an endpoint path. The port mirrors that — prepare a
request, inspect it, send it:

```ts
// src/lib/http/api.ts
export interface SeamApiRequest {
  readonly url: URL
  readonly method: string
  readonly body: unknown
  fetchResponse: () => Promise<unknown>
}

export interface SeamApi {
  createRequest: (options: ApiRequestOptions) => SeamApiRequest
}

export class HttpSeamApi implements SeamApi {
  constructor(private readonly seam: SeamHttp) {} // the only place SeamHttp appears

  createRequest = ({ path, params, responseKey }: ApiRequestOptions) =>
    new SeamHttpRequest(this.seam, {
      pathname: path,
      method: 'POST',
      body: params,
      responseKey: responseKey ?? undefined,
    })
}
```

The real request object is the SDK's own `SeamHttpRequest`, so the URL is
inspectable before sending and an error status rejects with the SDK's typed
`SeamHttpApiError`. The fake is the in-process mirror of the e2e server — a
routes table plus a capture — and it rejects with those same SDK error
classes, never an imitation:

```ts
// src/lib/http/memory-seam-api.ts
export class MemorySeamApi implements SeamApi {
  readonly requests: Array<{ path: string; params: Record<string, unknown> }> =
    []

  constructor(private readonly routes: Record<string, MemorySeamApiResponse>) {}

  createRequest = ({ path, params }: ApiRequestOptions): SeamApiRequest => ({
    url: new URL(`https://memory.seam.example${path}`),
    method: 'POST',
    body: params,
    fetchResponse: async () => {
      this.requests.push({ path, params })
      const route = this.routes[path]
      if (route == null || route.status >= 400) throw toSeamHttpError(route)
      return route.data
    },
  })
}
```

This keeps transport separate from presentation: the error-status → exit-code
behavior is a classical test with zero HTTP:

```ts
const api = createMemorySeamApi({
  '/devices/list': { status: 400, data: { error: { type: 'invalid_input' } } },
})
const memory = createMemoryOutput()

await requestSeamApi(
  { path: '/devices/list', params: { limit: 5 } },
  { api, output: memory.output },
)

// Boundary interaction: the outbound message IS the behavior.
expect(api.requests).toEqual([{ path: '/devices/list', params: { limit: 5 } }])
expect(memory.stdout()).toContain('invalid_input')
expect(process.exitCode).toBe(1)
```

`auth/validate-token.ts` and the resource pickers (`interactions/device.ts`
and friends) use typed SDK methods and stay on the real SDK, covered by e2e —
don't invent a second port for them.

## Singletons: `getConfigStore`, `getOutput`, the prompt client

Target shape: `CliContext = { config, auth, output, blueprint, interactivity, api }`
threaded as a parameter, with port boundaries exactly the ones above — config
store interface, `Output`, the prompt client, `SeamApi`. That makes every fake
an ordinary argument.

The rule: a singleton getter is tolerable only when it has (a) a setter +
reset and (b) an in-memory fake of the same narrow interface. In this repo
that is `getOutput`/`setOutput`/`resetOutput` + `createMemoryOutput()`,
`getConfigStore`/`setConfigStore`/`resetConfigStore` +
`createMemoryConfigStore()`, and `setPromptClient`/`resetPromptClient` +
`createMemoryPrompt()`. `vi.mock` on a module path is never the delivery
mechanism for a fake. Direct env reads (`env.ts`, `resolveAuth`) are a genuine
ambient edge — setting env vars in the test is fine.

## Anti-pattern

The shape the (since deleted) `get-server.test.ts` used:

```ts
const storedConfig: Record<string, unknown> = {}
vi.mock('./config/index.js', () => ({
  getConfigStore: vi.fn(() => ({ get: (key: string) => storedConfig[key] })),
}))
afterEach(() => {
  vi.mocked(getConfigStore).mockClear()
})
```

Three things wrong: the fake is delivered by file path, so renaming
`config/index.js` breaks the test; the fake's shape is whatever the test author
remembered (`{ get }`) rather than the store's interface, so it drifts
silently; and the `mockClear` bookkeeping exists only because the mock is
module-global state. The same tests written against an injected
`createMemoryConfigStore()` keep every assertion and lose all three problems.

## Rule of thumb

> **Assert on what leaves the process — stdout, the config file, the request
> payload, the choices offered, the exit code. Fake only the edge it leaves
> through, and keep everything on our side of that edge real.**
