import { homedir } from 'node:os'
import { join, relative } from 'node:path'

import { expect, test } from 'vitest'

import {
  getCacheDirectory,
  getConfigFilePath,
  getStateFilePath,
  seamPaths,
} from 'lib/paths.js'

/**
 * These paths are a contract, not an implementation detail: the wizard keeps
 * its own files beside them and reads the CLI's store for an existing login.
 * Moving one moves the developer's config, so each is asserted here.
 */

test('paths: every directory hangs off one Seam root', () => {
  for (const directory of [
    seamPaths.config,
    seamPaths.cache,
    seamPaths.log,
    seamPaths.data,
  ]) {
    expect(directory).toContain('seam')
    expect(directory.endsWith('seam')).toBe(true)
    expect(relative(homedir(), directory).startsWith('..')).toBe(false)
  }
})

test('paths: the directories are distinct', () => {
  const directories = [seamPaths.config, seamPaths.cache, seamPaths.log]
  expect(new Set(directories).size).toBe(directories.length)
})

test('paths: settings are stored in the config directory', () => {
  expect(getConfigFilePath()).toBe(join(seamPaths.config, 'cli.json'))
})

test('paths: auth state is stored apart from the settings', () => {
  expect(getStateFilePath()).toBe(join(seamPaths.log, 'cli.json'))
  expect(getStateFilePath()).not.toBe(getConfigFilePath())
})

test('paths: regenerable files are stored in the cache directory', () => {
  expect(getCacheDirectory()).toBe(seamPaths.cache)
})

test('paths: the config directory holds no suffixed application name', () => {
  // env-paths appends '-nodejs' unless the suffix is cleared, which would
  // put the CLI in '~/.config/seam-nodejs' instead of '~/.config/seam'.
  expect(seamPaths.config).not.toContain('nodejs')
})
