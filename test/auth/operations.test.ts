import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  login,
  logout,
  selectEndpoint,
  selectWorkspace,
  storeToken,
} from 'lib/auth/operations.js'
import { createCliConfig } from 'lib/config/cli-config.js'
import {
  createMemoryConfig,
  createMemoryConfigStore,
} from 'lib/config/memory-config-store.js'
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
  const config = createMemoryConfig({ endpoint })
  const { validate, validated } = createValidate()

  await login('seam_apikey1_stored', config, validate)

  expect(validated).toEqual([
    { token: 'seam_apikey1_stored', workspaceId: undefined },
  ])
  expect(config.getToken(endpoint)).toBe('seam_apikey1_stored')
})

test('login: stores the token under an overridden endpoint without selecting it', async () => {
  setAuthOverrides({ endpoint: 'https://other.example.com', workspaceId: null })
  const config = createMemoryConfig({ endpoint })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', config, validate)

  expect(config.getToken('https://other.example.com')).toBe(
    'seam_apikey1_stored',
  )
  // The override scopes the command: the selection is left as it was.
  expect(config.getEndpoint()).toBe(endpoint)
  expect(config.getToken(endpoint)).toBeNull()
})

test('login: a new login clears the previous workspace selection', async () => {
  const config = createMemoryConfig({
    endpoint,
    current_workspace_id: 'workspace1',
  })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', config, validate)

  expect(config.getWorkspace()).toBeNull()
})

test('login: validates against the workspace in effect without storing it', async () => {
  setAuthOverrides({ endpoint: null, workspaceId: 'workspace1' })
  const config = createMemoryConfig({ endpoint })
  const { validate, validated } = createValidate()

  await login('seam_at1_stored', config, validate)

  expect(validated).toEqual([
    { token: 'seam_at1_stored', workspaceId: 'workspace1' },
  ])
  expect(config.getWorkspace()).toBeNull()
})

test(`login: refuses while ${tokenEnvVar} is set, before storing anything`, async () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const config = createMemoryConfig({ endpoint })
  const { validate, validated } = createValidate()

  await expect(login('seam_apikey1_stored', config, validate)).rejects.toThrow(
    `Cannot log in while ${tokenEnvVar} is set`,
  )
  expect(config.getToken(endpoint)).toBeNull()
  expect(validated).toEqual([])
})

test(`login: stores under the endpoint ${endpointEnvVar} names`, async () => {
  process.env[endpointEnvVar] = 'https://other.example.com'
  const config = createMemoryConfig({ endpoint })
  const { validate } = createValidate()

  await login('seam_apikey1_stored', config, validate)

  expect(config.getToken('https://other.example.com')).toBe(
    'seam_apikey1_stored',
  )
  expect(config.getEndpoint()).toBe(endpoint)
})

test('storeToken: stores under the current endpoint without validating', () => {
  const config = createMemoryConfig({ endpoint })

  storeToken('seam_apikey1_stored', config)

  expect(config.getToken(endpoint)).toBe('seam_apikey1_stored')
})

test('logout: removes the stored token, legacy token, and workspace', () => {
  const store = createMemoryConfigStore({
    endpoint,
    [`${endpoint}.pat`]: 'seam_apikey1_stored',
    pat: 'seam_apikey1_legacy',
    current_workspace_id: 'workspace1',
  })
  const config = createCliConfig(store)

  logout(config)

  expect(config.getToken(endpoint)).toBeNull()
  expect(config.getWorkspace()).toBeNull()
  // Nothing reads the un-namespaced token, so it is asserted where it lives.
  expect(store.has('pat')).toBe(false)
})

test(`logout: refuses while ${tokenEnvVar} is set`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const config = createMemoryConfig({
    endpoint,
    [`${endpoint}.pat`]: 'seam_apikey1_stored',
  })

  expect(() => {
    logout(config)
  }).toThrow(`Cannot log out while ${tokenEnvVar} is set`)
  expect(config.getToken(endpoint)).toBe('seam_apikey1_stored')
})

test('selectEndpoint: stores the endpoint and clears the workspace', () => {
  const config = createMemoryConfig({ current_workspace_id: 'workspace1' })

  selectEndpoint(endpoint, config)

  expect(config.getEndpoint()).toBe(endpoint)
  expect(config.getWorkspace()).toBeNull()
})

test('selectEndpoint: drops an endpoint left under the legacy key', () => {
  const store = createMemoryConfigStore({ server: 'https://old.example.com' })
  const config = createCliConfig(store)

  selectEndpoint(endpoint, config)

  expect(config.getEndpoint()).toBe(endpoint)
  expect(store.has('server')).toBe(false)
})

test(`selectEndpoint: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'
  const config = createMemoryConfig()

  expect(() => {
    selectEndpoint(endpoint, config)
  }).toThrow(`Cannot select an endpoint while ${endpointEnvVar} is set`)
})

test('selectWorkspace: stores the workspace selection', () => {
  const config = createMemoryConfig()

  selectWorkspace('workspace1', config)

  expect(config.getWorkspace()).toBe('workspace1')
})

test(`selectWorkspace: refuses while ${workspaceIdEnvVar} is set`, () => {
  process.env[workspaceIdEnvVar] = 'workspace_env'
  const config = createMemoryConfig()

  expect(() => {
    selectWorkspace('workspace1', config)
  }).toThrow(`Cannot select a workspace while ${workspaceIdEnvVar} is set`)
})
