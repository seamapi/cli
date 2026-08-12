import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  login,
  logout,
  selectEndpoint,
  selectWorkspace,
  storeToken,
} from 'lib/auth/operations.js'
import { createMemoryConfigStore } from 'lib/config/memory-config-store.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from 'lib/env.js'
import { resetAuthOverrides, setAuthOverrides } from 'lib/overrides.js'

const endpoint = 'https://connect.example.com'

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
  resetAuthOverrides()
}

beforeEach(clearEnv)
afterEach(clearEnv)

test('login: stores a validated token under the current endpoint', async () => {
  const store = createMemoryConfigStore({ endpoint })
  const { validate, validated } = createValidate()

  await login('seam_apikey1_stored', store, validate)

  expect(validated).toEqual([
    { token: 'seam_apikey1_stored', workspaceId: undefined },
  ])
  expect(store.get(`${endpoint}.pat`)).toBe('seam_apikey1_stored')
})

test('login: stores the token under an overridden endpoint without selecting it', async () => {
  setAuthOverrides({ endpoint: 'https://other.example.com', workspaceId: null })
  const store = createMemoryConfigStore({ endpoint })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', store, validate)

  expect(store.get('https://other.example.com.pat')).toBe('seam_apikey1_stored')
  // The override scopes the command: the selection is left as it was.
  expect(store.get('endpoint')).toBe(endpoint)
  expect(store.has(`${endpoint}.pat`)).toBe(false)
})

test('login: a new login clears the previous workspace selection', async () => {
  const store = createMemoryConfigStore({
    endpoint,
    current_workspace_id: 'workspace1',
  })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', store, validate)

  expect(store.has('current_workspace_id')).toBe(false)
})

test('login: validates against the workspace in effect without storing it', async () => {
  setAuthOverrides({ endpoint: null, workspaceId: 'workspace1' })
  const store = createMemoryConfigStore({ endpoint })
  const { validate, validated } = createValidate()

  await login('seam_at1_stored', store, validate)

  expect(validated).toEqual([
    { token: 'seam_at1_stored', workspaceId: 'workspace1' },
  ])
  expect(store.has('current_workspace_id')).toBe(false)
})

test(`login: refuses while ${tokenEnvVar} is set, before storing anything`, async () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const store = createMemoryConfigStore({ endpoint })
  const { validate, validated } = createValidate()

  await expect(login('seam_apikey1_stored', store, validate)).rejects.toThrow(
    `Cannot log in while ${tokenEnvVar} is set`,
  )
  expect(store.has(`${endpoint}.pat`)).toBe(false)
  expect(validated).toEqual([])
})

test(`login: stores under the endpoint ${endpointEnvVar} names`, async () => {
  process.env[endpointEnvVar] = 'https://other.example.com'
  const store = createMemoryConfigStore({ endpoint })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', store, validate)

  expect(store.get('https://other.example.com.pat')).toBe('seam_apikey1_stored')
  expect(store.get('endpoint')).toBe(endpoint)
})

test('storeToken: stores under the current endpoint without validating', () => {
  const store = createMemoryConfigStore({ endpoint })

  storeToken('seam_apikey1_stored', store)

  expect(store.get(`${endpoint}.pat`)).toBe('seam_apikey1_stored')
})

test('logout: removes the stored token, legacy token, and workspace', () => {
  const store = createMemoryConfigStore({
    endpoint,
    [`${endpoint}.pat`]: 'seam_apikey1_stored',
    pat: 'seam_apikey1_legacy',
    current_workspace_id: 'workspace1',
  })

  logout(store)

  expect(store.has(`${endpoint}.pat`)).toBe(false)
  expect(store.has('pat')).toBe(false)
  expect(store.has('current_workspace_id')).toBe(false)
})

test(`logout: refuses while ${tokenEnvVar} is set`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const store = createMemoryConfigStore({
    endpoint,
    [`${endpoint}.pat`]: 'seam_apikey1_stored',
  })

  expect(() => {
    logout(store)
  }).toThrow(`Cannot log out while ${tokenEnvVar} is set`)
  expect(store.get(`${endpoint}.pat`)).toBe('seam_apikey1_stored')
})

test('selectEndpoint: stores the endpoint and clears the workspace', () => {
  const store = createMemoryConfigStore({ current_workspace_id: 'workspace1' })

  selectEndpoint(endpoint, store)

  expect(store.get('endpoint')).toBe(endpoint)
  expect(store.has('current_workspace_id')).toBe(false)
})

test('selectEndpoint: drops an endpoint left under the legacy key', () => {
  const store = createMemoryConfigStore({ server: 'https://old.example.com' })

  selectEndpoint(endpoint, store)

  expect(store.get('endpoint')).toBe(endpoint)
  expect(store.has('server')).toBe(false)
})

test(`selectEndpoint: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'
  const store = createMemoryConfigStore()

  expect(() => {
    selectEndpoint(endpoint, store)
  }).toThrow(`Cannot select an endpoint while ${endpointEnvVar} is set`)
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
