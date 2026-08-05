import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryConfigStore } from './config/create-memory-config-store.js'
import { resolveAuth } from './context.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from './env.js'

const server = 'https://connect.example.com'

const store = createMemoryConfigStore

const clearEnv = (): void => {
  delete process.env[endpointEnvVar]
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
}

beforeEach(clearEnv)
afterEach(clearEnv)

test('resolveAuth: reads the stored server', () => {
  const auth = resolveAuth(store({ server }))

  expect(auth.server).toBe(server)
  expect(auth.serverSource).toBe('config')
})

test('resolveAuth: defaults the server to Seam', () => {
  const auth = resolveAuth(store())

  expect(auth.server).toBe('https://connect.getseam.com')
  expect(auth.serverSource).toBe('default')
})

test(`resolveAuth: ${endpointEnvVar} wins over the stored server`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  const auth = resolveAuth(store({ server }))

  expect(auth.server).toBe('http://localhost:3020')
  expect(auth.serverSource).toBe('env')
})

test(`resolveAuth: ${endpointEnvVar} is used without a stored server`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  expect(resolveAuth(store()).server).toBe('http://localhost:3020')
})

test(`resolveAuth: ignores an empty ${endpointEnvVar}`, () => {
  process.env[endpointEnvVar] = ''

  const auth = resolveAuth(store({ server }))

  expect(auth.server).toBe(server)
  expect(auth.serverSource).toBe('config')
})

test('resolveAuth: reads the token stored for the current server', () => {
  const auth = resolveAuth(
    store({ server, [`${server}.pat`]: 'seam_apikey1_stored' }),
  )

  expect(auth.token).toBe('seam_apikey1_stored')
  expect(auth.tokenSource).toBe('config')
})

test(`resolveAuth: the token stored for ${endpointEnvVar} wins over the stored server's`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  const auth = resolveAuth(
    store({
      server,
      [`${server}.pat`]: 'seam_apikey1_stored',
      'http://localhost:3020.pat': 'seam_apikey1_local',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_local')
})

test(`resolveAuth: ${tokenEnvVar} wins over the stored token`, () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'

  const auth = resolveAuth(
    store({ server, [`${server}.pat`]: 'seam_apikey1_stored' }),
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
    store({ server, [`${server}.pat`]: 'seam_apikey1_stored' }),
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
      server,
      [`${server}.pat`]: 'seam_apikey1_stored',
      current_workspace_id: 'workspace1',
    }),
  )

  expect(auth.token).toBe('seam_apikey1_stored')
  expect(auth.workspaceId).toBe('workspace2')
})
