import { expect, test } from 'vitest'

import * as cli from '@seamapi/cli'

import { getConfigFilePath, getStateFilePath } from 'lib/paths.js'

/**
 * What the package exports is what other Seam tools, e.g., the wizard, build
 * against: a removed or renamed export breaks them at a distance, so the
 * surface is pinned here.
 */

test('index: exports where the CLI keeps its files', () => {
  expect(cli.getConfigFilePath()).toBe(getConfigFilePath())
  expect(cli.getStateFilePath()).toBe(getStateFilePath())
  expect(cli.getCacheDirectory()).toBe(cli.seamPaths.cache)
})

test('index: exports the keys auth is stored under', () => {
  expect(cli.getTokenKey('https://connect.getseam.com')).toBe(
    `https://connect.getseam.com.${cli.patKey}`,
  )
  expect(cli.isStateKey(cli.currentWorkspaceIdKey)).toBe(true)
  expect(cli.isStateKey(cli.getTokenKey(cli.defaultServer))).toBe(true)
  expect(cli.isStateKey('server')).toBe(false)
})

test('index: exports the environment variables that override stored auth', () => {
  expect(cli.tokenEnvVar).toBe('SEAM_CLI_TOKEN')
  expect(cli.workspaceIdEnvVar).toBe('SEAM_CLI_WORKSPACE_ID')
  expect(cli.endpointEnvVar).toBe('SEAM_CLI_ENDPOINT')
})

test('index: exports the server used when none is stored', () => {
  expect(cli.defaultServer).toBe('https://connect.getseam.com')
})
