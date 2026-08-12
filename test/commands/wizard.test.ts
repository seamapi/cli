import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test } from 'vitest'

import { createWizardAdapter } from 'lib/commands/local/wizard.js'
import { createMemoryConfig } from 'lib/config/index.js'
import { defaultEndpoint } from 'lib/context.js'
import { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from 'lib/env.js'

let directory = ''

const clearEnv = (): void => {
  delete process.env[endpointEnvVar]
  delete process.env[tokenEnvVar]
  delete process.env[workspaceIdEnvVar]
}

beforeEach(() => {
  clearEnv()
  directory = mkdtempSync(join(tmpdir(), 'seam-wizard-adapter-'))
})

afterEach(() => {
  clearEnv()
  rmSync(directory, { recursive: true, force: true })
})

const createAdapter = ({
  endpoint,
  token,
  workspaceId,
}: {
  endpoint?: string
  token?: string
  workspaceId?: string
} = {}) => {
  const cliConfig = createMemoryConfig()
  if (endpoint != null) cliConfig.setEndpoint(endpoint)
  if (token != null) cliConfig.setToken(endpoint ?? defaultEndpoint, token)
  if (workspaceId != null) cliConfig.setWorkspace(workspaceId)

  return createWizardAdapter({
    cliConfig,
    configPath: join(directory, 'config', 'wizard.json'),
    statePath: join(directory, 'state', 'wizard.json'),
  })
}

test('wizard adapter: hands over an API key for the project to use', async () => {
  const adapter = createAdapter({ token: 'seam_apikey1_token' })

  expect(await adapter.getAuth()).toEqual({
    endpoint: defaultEndpoint,
    apiKey: 'seam_apikey1_token',
    workspaceId: null,
  })
})

test('wizard adapter: hands over no key for a personal access token', async () => {
  const adapter = createAdapter({
    token: 'seam_at1_token',
    workspaceId: 'workspace-1',
  })

  expect(await adapter.getAuth()).toEqual({
    endpoint: defaultEndpoint,
    apiKey: null,
    workspaceId: 'workspace-1',
  })
})

test('wizard adapter: reports no login when nothing is stored', async () => {
  expect(await createAdapter().getAuth()).toEqual({
    endpoint: defaultEndpoint,
    apiKey: null,
    workspaceId: null,
  })
})

test('wizard adapter: uses the endpoint the CLI is pointed at', async () => {
  const adapter = createAdapter({
    endpoint: 'https://connect.example.com',
    token: 'seam_apikey1_token',
  })

  expect(await adapter.getAuth()).toMatchObject({
    endpoint: 'https://connect.example.com',
    apiKey: 'seam_apikey1_token',
  })
})

test('wizard adapter: the environment wins over what the CLI stored', async () => {
  process.env[tokenEnvVar] = 'seam_apikey1_from_env'
  process.env[endpointEnvVar] = 'https://connect.env.example.com'

  const adapter = createAdapter({
    endpoint: 'https://connect.example.com',
    token: 'seam_apikey1_stored',
  })

  expect(await adapter.getAuth()).toMatchObject({
    endpoint: 'https://connect.env.example.com',
    apiKey: 'seam_apikey1_from_env',
  })
})

test('wizard adapter: keeps config and state in separate files', async () => {
  const adapter = createAdapter()

  await adapter.config.set('sdk', 'python')
  await adapter.state.set('projects.app-1234567890', { goal: 'Set up Seam.' })

  expect(await adapter.config.get('sdk')).toBe('python')
  expect(await adapter.state.get('projects.app-1234567890')).toEqual({
    goal: 'Set up Seam.',
  })

  const configFile = join(directory, 'config', 'wizard.json')
  const stateFile = join(directory, 'state', 'wizard.json')
  expect(JSON.parse(readFileSync(configFile, 'utf8'))).toEqual({
    sdk: 'python',
  })
  expect(readFileSync(stateFile, 'utf8')).not.toContain('sdk')
})

test('wizard adapter: keeps what it was given between adapters', async () => {
  await createAdapter().config.set('sdk', 'javascript')

  expect(await createAdapter().config.get('sdk')).toBe('javascript')
})

test('wizard adapter: writes nothing until the wizard saves something', () => {
  createAdapter()

  expect(() =>
    readFileSync(join(directory, 'config', 'wizard.json'), 'utf8'),
  ).toThrow()
})
