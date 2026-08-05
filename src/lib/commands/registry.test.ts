import { expect, test } from 'vitest'

import { testBlueprint } from '../../../test/fixtures/blueprint.js'
import {
  acceptedParamsOf,
  buildRegistry,
  findLocalCommand,
  localCommands,
} from './registry.js'

const registry = buildRegistry(testBlueprint)

test('registry: every spec command resolves to an executable command', () => {
  for (const { path } of registry.spec.commands) {
    const command = registry.find(path)
    expect(command, `no executor for seam ${path.join(' ')}`).toBeDefined()
    expect(command?.execute).toBeTypeOf('function')
  }
})

test('registry: every visible local command is in the spec', () => {
  for (const { definition, hidden } of localCommands) {
    const inSpec = registry.spec.commands.some(
      ({ path }) => path.join(' ') === definition.path.join(' '),
    )
    expect(
      inSpec,
      `seam ${definition.path.join(' ')} should${hidden === true ? ' not' : ''} be in the spec`,
    ).toBe(hidden !== true)
  }
})

test('registry: hidden commands are findable without being offered', () => {
  const fakeServer = registry.find(['config', 'set', 'fake-server'])
  expect(fakeServer?.hidden).toBe(true)
  expect(fakeServer?.requiresAuth).toBe(false)
})

test('registry: only commands for logging in and selecting a server skip auth', () => {
  const noAuth = localCommands
    .filter(({ requiresAuth }) => !requiresAuth)
    .map(({ definition }) => definition.path.join(' '))
    .sort()
  expect(noAuth).toEqual([
    'completion bash',
    'completion fish',
    'completion zsh',
    'config set fake-server',
    'login',
    'select server',
    'wizard',
  ])
})

test('registry: api commands come from the blueprint and require auth', () => {
  const devicesList = registry.find(['devices', 'list'])
  expect(devicesList?.requiresAuth).toBe(true)
  expect(devicesList?.definition.kind).toBe('api')
})

test('findLocalCommand: knows nothing of blueprint endpoints', () => {
  expect(findLocalCommand(['login'])?.definition.path).toEqual(['login'])
  expect(findLocalCommand(['devices', 'list'])).toBeUndefined()
})

test('acceptedParamsOf: names the parameters behind the flags', () => {
  const login = findLocalCommand(['login'])
  expect(login).toBeDefined()
  if (login == null) return
  expect(acceptedParamsOf(login.definition)).toEqual(
    new Set(['server', 'token', 'workspace_id']),
  )
})
