import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  assertEnvVarUnset,
  endpointEnvVar,
  EnvVarOverrideError,
  getEndpointFromEnv,
  getTokenFromEnv,
  getWorkspaceIdFromEnv,
  tokenEnvVar,
  workspaceIdEnvVar,
} from './env.js'

const envVars = [tokenEnvVar, workspaceIdEnvVar, endpointEnvVar]

const clearEnv = (): void => {
  for (const envVar of envVars) {
    delete process.env[envVar]
  }
}

beforeEach(clearEnv)
afterEach(clearEnv)

test('env: reads each variable', () => {
  process.env[tokenEnvVar] = 'seam_apikey1_env'
  process.env[workspaceIdEnvVar] = 'workspace1'
  process.env[endpointEnvVar] = 'https://connect.example.com'

  expect(getTokenFromEnv()).toBe('seam_apikey1_env')
  expect(getWorkspaceIdFromEnv()).toBe('workspace1')
  expect(getEndpointFromEnv()).toBe('https://connect.example.com')
})

test('env: reads null when unset', () => {
  expect(getTokenFromEnv()).toBe(null)
  expect(getWorkspaceIdFromEnv()).toBe(null)
  expect(getEndpointFromEnv()).toBe(null)
})

test('env: trims values', () => {
  process.env[tokenEnvVar] = '  seam_apikey1_env\n'

  expect(getTokenFromEnv()).toBe('seam_apikey1_env')
})

test('env: reads an empty value as unset', () => {
  process.env[tokenEnvVar] = ''
  process.env[workspaceIdEnvVar] = '   '

  expect(getTokenFromEnv()).toBe(null)
  expect(getWorkspaceIdFromEnv()).toBe(null)
})

test('assertEnvVarUnset: throws when the variable is set', () => {
  expect(() => {
    assertEnvVarUnset(tokenEnvVar, 'seam_apikey1_env', 'log in')
  }).toThrow(EnvVarOverrideError)

  expect(() => {
    assertEnvVarUnset(tokenEnvVar, 'seam_apikey1_env', 'log in')
  }).toThrow(/Cannot log in while SEAM_CLI_TOKEN is set/)
})

test('assertEnvVarUnset: says how to proceed', () => {
  expect(() => {
    assertEnvVarUnset(workspaceIdEnvVar, 'workspace1', 'select a workspace')
  }).toThrow(/Unset SEAM_CLI_WORKSPACE_ID to select a workspace/)
})

test('assertEnvVarUnset: passes when the variable is unset', () => {
  expect(() => {
    assertEnvVarUnset(tokenEnvVar, null, 'log in')
  }).not.toThrow()
})
