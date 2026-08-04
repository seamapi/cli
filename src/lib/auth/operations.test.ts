import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { SeamConfigStore } from '../config/index.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from '../env.js'
import {
  login,
  logout,
  selectFakeServer,
  selectServer,
  selectWorkspace,
  storeToken,
} from './operations.js'
import { validateToken } from './validate-token.js'

vi.mock('./validate-token.js', () => ({
  validateToken: vi.fn(async () => {}),
}))

const server = 'https://connect.example.com'

const createStore = (
  values: Record<string, unknown> = {},
): { values: Record<string, unknown>; store: SeamConfigStore } => ({
  values,
  store: {
    get: (key: string) => values[key],
    set: (key: string, value: unknown) => {
      values[key] = value
    },
    delete: (key: string) => {
      delete values[key]
    },
  } as unknown as SeamConfigStore,
})

const clearEnv = (): void => {
  delete process.env[endpointEnvVar]
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
}

beforeEach(() => {
  clearEnv()
  vi.mocked(validateToken).mockClear()
})

afterEach(clearEnv)

test('login: stores a validated token under the current server', async () => {
  const { values, store } = createStore({ server })

  await login({ token: 'seam_apikey1_stored' }, store)

  expect(validateToken).toHaveBeenCalledWith('seam_apikey1_stored', undefined)
  expect(values[`${server}.pat`]).toBe('seam_apikey1_stored')
})

test('login: stores the token under a server given alongside it', async () => {
  const { values, store } = createStore({ server })

  await login(
    { server: 'https://other.example.com', token: 'seam_apikey1_stored' },
    store,
  )

  expect(values['server']).toBe('https://other.example.com')
  expect(values['https://other.example.com.pat']).toBe('seam_apikey1_stored')
  expect(values[`${server}.pat`]).toBeUndefined()
})

test('login: a new login clears the previous workspace selection', async () => {
  const { values, store } = createStore({
    server,
    current_workspace_id: 'workspace1',
  })

  await login({ token: 'seam_apikey1_stored' }, store)

  expect(values['current_workspace_id']).toBeUndefined()
})

test('login: stores a workspace given with the token', async () => {
  const { values, store } = createStore({ server })

  await login({ token: 'seam_at1_stored', workspaceId: 'workspace1' }, store)

  expect(validateToken).toHaveBeenCalledWith('seam_at1_stored', 'workspace1')
  expect(values['current_workspace_id']).toBe('workspace1')
})

test(`login: refuses while ${tokenEnvVar} is set, before storing anything`, async () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const { values, store } = createStore({ server })

  await expect(login({ token: 'seam_apikey1_stored' }, store)).rejects.toThrow(
    `Cannot log in while ${tokenEnvVar} is set`,
  )
  expect(values[`${server}.pat`]).toBeUndefined()
  expect(validateToken).not.toHaveBeenCalled()
})

test(`login: refuses a server while ${endpointEnvVar} is set`, async () => {
  process.env[endpointEnvVar] = server
  const { store } = createStore()

  await expect(
    login({ server: 'https://other.example.com' }, store),
  ).rejects.toThrow(`Cannot select a server while ${endpointEnvVar} is set`)
})

test(`login: refuses a workspace while ${workspaceIdEnvVar} is set`, async () => {
  process.env[workspaceIdEnvVar] = 'workspace_env'
  const { store } = createStore({ server })

  await expect(
    login({ token: 'seam_at1_stored', workspaceId: 'workspace1' }, store),
  ).rejects.toThrow(
    `Cannot select a workspace while ${workspaceIdEnvVar} is set`,
  )
})

test('storeToken: stores under the current server without validating', () => {
  const { values, store } = createStore({ server })

  storeToken('seam_apikey1_stored', store)

  expect(values[`${server}.pat`]).toBe('seam_apikey1_stored')
  expect(validateToken).not.toHaveBeenCalled()
})

test('logout: removes the stored token, legacy token, and workspace', () => {
  const { values, store } = createStore({
    server,
    [`${server}.pat`]: 'seam_apikey1_stored',
    pat: 'seam_apikey1_legacy',
    current_workspace_id: 'workspace1',
  })

  logout(store)

  expect(values[`${server}.pat`]).toBeUndefined()
  expect(values['pat']).toBeUndefined()
  expect(values['current_workspace_id']).toBeUndefined()
})

test(`logout: refuses while ${tokenEnvVar} is set`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  const { values, store } = createStore({
    server,
    [`${server}.pat`]: 'seam_apikey1_stored',
  })

  expect(() => {
    logout(store)
  }).toThrow(`Cannot log out while ${tokenEnvVar} is set`)
  expect(values[`${server}.pat`]).toBe('seam_apikey1_stored')
})

test('selectServer: stores the server and clears the workspace', () => {
  const { values, store } = createStore({ current_workspace_id: 'workspace1' })

  selectServer(server, store)

  expect(values['server']).toBe(server)
  expect(values['current_workspace_id']).toBeUndefined()
})

test(`selectServer: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'
  const { store } = createStore()

  expect(() => {
    selectServer(server, store)
  }).toThrow(`Cannot select a server while ${endpointEnvVar} is set`)
})

test('selectWorkspace: stores the workspace selection', () => {
  const { values, store } = createStore()

  selectWorkspace('workspace1', store)

  expect(values['current_workspace_id']).toBe('workspace1')
})

test(`selectWorkspace: refuses while ${workspaceIdEnvVar} is set`, () => {
  process.env[workspaceIdEnvVar] = 'workspace_env'
  const { store } = createStore()

  expect(() => {
    selectWorkspace('workspace1', store)
  }).toThrow(`Cannot select a workspace while ${workspaceIdEnvVar} is set`)
})

test('selectFakeServer: stores the server and its well-known token', () => {
  const { values, store } = createStore({ current_workspace_id: 'workspace1' })

  const { server: fakeServer } = selectFakeServer('abc123', store)

  expect(fakeServer).toBe('https://abc123.fakeseamconnect.seam.vc')
  expect(values['server']).toBe(fakeServer)
  expect(values[`${fakeServer}.pat`]).toBe('seam_apikey1_token')
  expect(values['current_workspace_id']).toBeUndefined()
})

test(`selectFakeServer: refuses while ${endpointEnvVar} is set`, () => {
  process.env[endpointEnvVar] = server
  const { store } = createStore()

  expect(() => selectFakeServer('abc123', store)).toThrow(
    `Cannot select a server while ${endpointEnvVar} is set`,
  )
})
