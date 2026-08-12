import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryConfigStore } from 'lib/config/memory-config-store.js'
import { resolveAuth } from 'lib/context.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from 'lib/env.js'
import { resetAuthOverrides, setAuthOverrides } from 'lib/overrides.js'

const endpoint = 'https://connect.example.com'

const store = createMemoryConfigStore

/** The flags for one command, as `bin/cli.ts` sets them from the arguments. */
const overrideWith = (overrides: {
  endpoint?: string
  workspaceId?: string
}): void => {
  setAuthOverrides({
    endpoint: overrides.endpoint ?? null,
    workspaceId: overrides.workspaceId ?? null,
  })
}

const clearEnv = (): void => {
  delete process.env[endpointEnvVar]
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
  resetAuthOverrides()
}

beforeEach(clearEnv)
afterEach(clearEnv)

test('resolveAuth: reads the stored endpoint', () => {
  const auth = resolveAuth(store({ endpoint }))

  expect(auth.endpoint).toBe(endpoint)
  expect(auth.endpointSource).toBe('config')
})

test('resolveAuth: defaults the endpoint to Seam', () => {
  const auth = resolveAuth(store())

  expect(auth.endpoint).toBe('https://connect.getseam.com')
  expect(auth.endpointSource).toBe('default')
})

test('resolveAuth: reads an endpoint stored under the legacy key', () => {
  const auth = resolveAuth(store({ server: endpoint }))

  expect(auth.endpoint).toBe(endpoint)
  expect(auth.endpointSource).toBe('config')
})

test('resolveAuth: the stored endpoint wins over the legacy key', () => {
  const auth = resolveAuth(
    store({ endpoint, server: 'https://old.example.com' }),
  )

  expect(auth.endpoint).toBe(endpoint)
})

test('resolveAuth: --endpoint wins over the stored endpoint', () => {
  overrideWith({ endpoint: 'http://localhost:3020' })

  const auth = resolveAuth(store({ endpoint }))

  expect(auth.endpoint).toBe('http://localhost:3020')
  expect(auth.endpointSource).toBe('flag')
})

test(`resolveAuth: --endpoint wins over ${endpointEnvVar}`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'
  overrideWith({ endpoint: 'http://localhost:9999' })

  const auth = resolveAuth(store({ endpoint }))

  expect(auth.endpoint).toBe('http://localhost:9999')
  expect(auth.endpointSource).toBe('flag')
})

test('resolveAuth: reads the token stored for an overridden endpoint', () => {
  overrideWith({ endpoint: 'http://localhost:3020' })

  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
      'http://localhost:3020.pat': 'seam_apikey1_local',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_local')
})

test('resolveAuth: --workspace-id wins over the stored selection', () => {
  overrideWith({ workspaceId: 'workspace2' })

  const auth = resolveAuth(store({ current_workspace_id: 'workspace1' }))

  expect(auth.workspaceId).toBe('workspace2')
  expect(auth.workspaceIdSource).toBe('flag')
})

test(`resolveAuth: --workspace-id wins over ${workspaceIdEnvVar}`, () => {
  process.env[workspaceIdEnvVar] = 'workspace2'
  overrideWith({ workspaceId: 'workspace3' })

  const auth = resolveAuth(store({ current_workspace_id: 'workspace1' }))

  expect(auth.workspaceId).toBe('workspace3')
  expect(auth.workspaceIdSource).toBe('flag')
})

test(`resolveAuth: ${endpointEnvVar} wins over the stored endpoint`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  const auth = resolveAuth(store({ endpoint }))

  expect(auth.endpoint).toBe('http://localhost:3020')
  expect(auth.endpointSource).toBe('env')
})

test(`resolveAuth: ${endpointEnvVar} is used without a stored endpoint`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  expect(resolveAuth(store()).endpoint).toBe('http://localhost:3020')
})

test(`resolveAuth: ignores an empty ${endpointEnvVar}`, () => {
  process.env[endpointEnvVar] = ''

  const auth = resolveAuth(store({ endpoint }))

  expect(auth.endpoint).toBe(endpoint)
  expect(auth.endpointSource).toBe('config')
})

test('resolveAuth: reads the token stored for the current endpoint', () => {
  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_stored')
  expect(auth.tokenSource).toBe('config')
})

test(`resolveAuth: the token stored for ${endpointEnvVar} wins over the stored endpoint's`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
      'http://localhost:3020.pat': 'seam_apikey1_local',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_local')
})

test(`resolveAuth: ${tokenEnvVar} wins over the stored token`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'

  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_env')
  expect(auth.tokenSource).toBe('env')
})

test(`resolveAuth: ${tokenEnvVar} is used without a stored token`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'

  expect(resolveAuth(store()).token).toBe('seam_apikey1_env')
})

test(`resolveAuth: ignores an empty ${tokenEnvVar}`, () => {
  process.env[tokenEnvVar] = '   '

  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_stored')
})

test('resolveAuth: token is null when nothing is set', () => {
  const auth = resolveAuth(store())

  expect(auth.token).toBe(null)
  expect(auth.tokenSource).toBe(null)
})

test('resolveAuth: reads the stored workspace selection', () => {
  const auth = resolveAuth(store({ current_workspace_id: 'workspace1' }))

  expect(auth.workspaceId).toBe('workspace1')
  expect(auth.workspaceIdSource).toBe('config')
})

test(`resolveAuth: ${workspaceIdEnvVar} wins over the stored selection`, () => {
  process.env[workspaceIdEnvVar] = 'workspace2'

  const auth = resolveAuth(store({ current_workspace_id: 'workspace1' }))

  expect(auth.workspaceId).toBe('workspace2')
  expect(auth.workspaceIdSource).toBe('env')
})

test(`resolveAuth: ${workspaceIdEnvVar} is used without a stored selection`, () => {
  process.env[workspaceIdEnvVar] = 'workspace2'

  expect(resolveAuth(store()).workspaceId).toBe('workspace2')
})

test(`resolveAuth: ignores an empty ${workspaceIdEnvVar}`, () => {
  process.env[workspaceIdEnvVar] = ''

  expect(
    resolveAuth(store({ current_workspace_id: 'workspace1' })).workspaceId,
  ).toBe('workspace1')
})

test('resolveAuth: workspace is null when nothing is set', () => {
  const auth = resolveAuth(store())

  expect(auth.workspaceId).toBe(null)
  expect(auth.workspaceIdSource).toBe(null)
})

test('resolveAuth: each value resolves on its own', () => {
  process.env[workspaceIdEnvVar] = 'workspace2'

  const auth = resolveAuth(
    store({
      endpoint,
      [`${endpoint}.pat`]: 'seam_apikey1_stored',
      current_workspace_id: 'workspace1',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_stored')
  expect(auth.workspaceId).toBe('workspace2')
})
