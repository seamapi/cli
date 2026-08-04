import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getConfigStore } from './config/index.js'
import { tokenEnvVar, workspaceIdEnvVar } from './env.js'
import { getToken, getWorkspaceId } from './get-credentials.js'

const server = 'https://connect.example.com'

const storedConfig: Record<string, unknown> = {}

vi.mock('./config/index.js', () => ({
  getConfigStore: vi.fn(() => ({
    get: (key: string) => storedConfig[key],
  })),
}))

vi.mock('./get-server.js', () => ({
  getServer: vi.fn(() => server),
}))

const clearEnv = (): void => {
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
}

beforeEach(() => {
  for (const key of Object.keys(storedConfig)) {
    delete storedConfig[key]
  }
  clearEnv()
})

afterEach(() => {
  clearEnv()
  vi.mocked(getConfigStore).mockClear()
})

test('getToken: reads the token stored for the current server', () => {
  storedConfig[`${server}.pat`] = 'seam_apikey1_stored'

  expect(getToken()).toBe('seam_apikey1_stored')
})

test(`getToken: ${tokenEnvVar} wins over the stored token`, () => {
  storedConfig[`${server}.pat`] = 'seam_apikey1_stored'
  process.env[tokenEnvVar] = 'seam_apikey1_env'

  expect(getToken()).toBe('seam_apikey1_env')
})

test(`getToken: ${tokenEnvVar} is used without a stored token`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'

  expect(getToken()).toBe('seam_apikey1_env')
})

test(`getToken: ignores an empty ${tokenEnvVar}`, () => {
  storedConfig[`${server}.pat`] = 'seam_apikey1_stored'
  process.env[tokenEnvVar] = '   '

  expect(getToken()).toBe('seam_apikey1_stored')
})

test('getToken: returns null when nothing is set', () => {
  expect(getToken()).toBe(null)
})

test('getWorkspaceId: reads the stored workspace selection', () => {
  storedConfig['current_workspace_id'] = 'workspace1'

  expect(getWorkspaceId()).toBe('workspace1')
})

test(`getWorkspaceId: ${workspaceIdEnvVar} wins over the stored selection`, () => {
  storedConfig['current_workspace_id'] = 'workspace1'
  process.env[workspaceIdEnvVar] = 'workspace2'

  expect(getWorkspaceId()).toBe('workspace2')
})

test(`getWorkspaceId: ${workspaceIdEnvVar} is used without a stored selection`, () => {
  process.env[workspaceIdEnvVar] = 'workspace2'

  expect(getWorkspaceId()).toBe('workspace2')
})

test(`getWorkspaceId: ignores an empty ${workspaceIdEnvVar}`, () => {
  storedConfig['current_workspace_id'] = 'workspace1'
  process.env[workspaceIdEnvVar] = ''

  expect(getWorkspaceId()).toBe('workspace1')
})

test('getWorkspaceId: returns null when nothing is set', () => {
  expect(getWorkspaceId()).toBe(null)
})

test('getToken and getWorkspaceId: either may be set on its own', () => {
  storedConfig[`${server}.pat`] = 'seam_apikey1_stored'
  storedConfig['current_workspace_id'] = 'workspace1'
  process.env[workspaceIdEnvVar] = 'workspace2'

  expect(getToken()).toBe('seam_apikey1_stored')
  expect(getWorkspaceId()).toBe('workspace2')
})
