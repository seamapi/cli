import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryConfigStore } from '../config/create-memory-config-store.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from '../env.js'
import {
  login,
  logout,
  selectFakeServer,
  selectServer,
  selectWorkspace,
  storeToken,
} from './operations.js'

const server = 'https://connect.example.com'

/**
 * Validation is a network call, so it is faked at that edge: a capture of
 * what would have been validated, asserted on like any outbound message.
 */
const createValidate = (): {
  validate: (token: string, workspaceId?: string) => Promise<void>
  validated: Array<{ token: string; workspaceId: string | undefined }>
} => {
  const validated: Array<{ token: string; workspaceId: string | undefined }> =
    []
  return {
    validated,
    validate: async (token, workspaceId) => {
      validated.push({ token, workspaceId })
    },
  }
}

const clearEnv = (): void => {
  delete process.env[endpointEnvVar]
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
}

beforeEach(clearEnv)
afterEach(clearEnv)

test('login: stores a validated token under the current server', async () => {
  const store = createMemoryConfigStore({ server })
  const { validate, validated } = createValidate()

  await login({ token: 'seam_apikey1_stored' }, store, validate)

  expect(validated).toEqual([
    { token: 'seam_apikey1_stored', workspaceId: undefined },
  ])
  expect(store.get(`${server}.pat`)).toBe('seam_apikey1_stored')
})

test('login: stores the token under a server given alongside it', async () => {
  const store = createMemoryConfigStore({ server })
  const { validate } = createValidate()

  await login(
    { server: 'https://other.example.com', token: 'seam_apikey1_stored' },
    store,
    validate,
  )

  expect(store.get('server')).toBe('https://other.example.com')
  expect(store.get('https://other.example.com.pat')).toBe('seam_apikey1_stored')
  expect(store.has(`${server}.pat`)).toBe(false)
})

test('login: a new login clears the previous workspace selection', async () => {
  const store = createMemoryConfigStore({
    server,
    current_workspace_id: 'workspace1',
  })
  const { validate } = createValidate()

  await login({ token: 'seam_apikey1_stored' }, store, validate)

  expect(store.has('current_workspace_id')).toBe(false)
})

test('login: stores a workspace given with the token', async () => {
  const store = createMemoryConfigStore({ server })
  const { validate, validated } = createValidate()

  await login(
    { token: 'seam_at1_stored', workspaceId: 'workspace1' },
    store,
    validate,
  )

  expect(validated).toEqual([
    { token: 'seam_at1_stored', workspaceId: 'workspace1' },
  ])
  expect(store.get('current_workspace_id')).toBe('workspace1')
})

test(`login: refuses while ${tokenEnvVar} is set, before storing anything`, async () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const store = createMemoryConfigStore({ server })
  const { validate, validated } = createValidate()

  await expect(
    login({ token: 'seam_apikey1_stored' }, store, validate),
  ).rejects.toThrow(`Cannot log in while ${tokenEnvVar} is set`)
  expect(store.has(`${server}.pat`)).toBe(false)
  expect(validated).toEqual([])
})

test(`login: refuses a server while ${endpointEnvVar} is set`, async () => {
  process.env[endpointEnvVar] = server
  const store = createMemoryConfigStore()
  const { validate } = createValidate()

  await expect(
    login({ server: 'https://other.example.com' }, store, validate),
  ).rejects.toThrow(`Cannot select a server while ${endpointEnvVar} is set`)
})

test(`login: refuses a workspace while ${workspaceIdEnvVar} is set`, async () => {
  process.env[workspaceIdEnvVar] = 'workspace_env'
  const store = createMemoryConfigStore({ server })
  const { validate } = createValidate()

  await expect(
    login(
      { token: 'seam_at1_stored', workspaceId: 'workspace1' },
      store,
      validate,
    ),
  ).rejects.toThrow(
    `Cannot select a workspace while ${workspaceIdEnvVar} is set`,
  )
})

test('storeToken: stores under the current server without validating', () => {
  const store = createMemoryConfigStore({ server })

  storeToken('seam_apikey1_stored', store)

  expect(store.get(`${server}.pat`)).toBe('seam_apikey1_stored')
})

test('logout: removes the stored token, legacy token, and workspace', () => {
  const store = createMemoryConfigStore({
    server,
    [`${server}.pat`]: 'seam_apikey1_stored',
    pat: 'seam_apikey1_legacy',
    current_workspace_id: 'workspace1',
  })

  logout(store)

  expect(store.has(`${server}.pat`)).toBe(false)
  expect(store.has('pat')).toBe(false)
  expect(store.has('current_workspace_id')).toBe(false)
})

test(`logout: refuses while ${tokenEnvVar} is set`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const store = createMemoryConfigStore({
    server,
    [`${server}.pat`]: 'seam_apikey1_stored',
  })

  expect(() => {
    logout(store)
  }).toThrow(`Cannot log out while ${tokenEnvVar} is set`)
  expect(store.get(`${server}.pat`)).toBe('seam_apikey1_stored')
})

test('selectServer: stores the server and clears the workspace', () => {
  const store = createMemoryConfigStore({ current_workspace_id: 'workspace1' })

  selectServer(server, store)

  expect(store.get('server')).toBe(server)
  expect(store.has('current_workspace_id')).toBe(false)
})

test(`selectServer: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'
  const store = createMemoryConfigStore()

  expect(() => {
    selectServer(server, store)
  }).toThrow(`Cannot select a server while ${endpointEnvVar} is set`)
})

test('selectWorkspace: stores the workspace selection', () => {
  const store = createMemoryConfigStore()

  selectWorkspace('workspace1', store)

  expect(store.get('current_workspace_id')).toBe('workspace1')
})

test(`selectWorkspace: refuses while ${workspaceIdEnvVar} is set`, () => {
  process.env[workspaceIdEnvVar] = 'workspace_env'
  const store = createMemoryConfigStore()

  expect(() => {
    selectWorkspace('workspace1', store)
  }).toThrow(`Cannot select a workspace while ${workspaceIdEnvVar} is set`)
})

test('selectFakeServer: stores the server and its well-known token', () => {
  const store = createMemoryConfigStore({ current_workspace_id: 'workspace1' })

  const { server: fakeServer } = selectFakeServer('abc123', store)

  expect(fakeServer).toBe('https://abc123.fakeseamconnect.seam.vc')
  expect(store.get('server')).toBe(fakeServer)
  expect(store.get(`${fakeServer}.pat`)).toBe('seam_apikey1_token')
  expect(store.has('current_workspace_id')).toBe(false)
})

test(`selectFakeServer: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = server
  const store = createMemoryConfigStore()

  expect(() => selectFakeServer('abc123', store)).toThrow(
    `Cannot select a server while ${endpointEnvVar} is set`,
  )
})
