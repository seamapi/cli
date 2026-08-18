import { expect, test } from 'vitest'

import {
  acceptedParamsOf,
  buildRegistry,
  findLocalCommand,
  findLocalCommandTakingPositional,
  localCommands,
} from 'lib/commands/registry.js'
import { testBlueprint } from 'test/fixtures/blueprint.js'

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

test('registry: only commands for logging in and selecting an endpoint skip auth', () => {
  const noAuth = localCommands
    .filter(({ requiresAuth }) => !requiresAuth)
    .map(({ definition }) => definition.path.join(' '))
    .sort()
  expect(noAuth).toEqual([
    'completion bash',
    'completion fish',
    'completion zsh',
    'login',
    'select endpoint',
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
  expect(acceptedParamsOf(login.definition)).toEqual(new Set(['token']))
})

test('registry: the select commands take a value after their path', () => {
  expect(
    findLocalCommandTakingPositional(['select', 'endpoint', 'a-url']),
  ).toBeDefined()
  expect(
    findLocalCommandTakingPositional(['select', 'workspace', 'workspace1'])
      ?.definition.path,
  ).toEqual(['select', 'workspace'])
})

test('registry: a stray word after any other command is not a positional', () => {
  expect(findLocalCommandTakingPositional(['login', 'a-token'])).toBeUndefined()
  expect(
    findLocalCommandTakingPositional(['devices', 'list', 'extra']),
  ).toBeUndefined()
  // The command alone takes nothing: there is no word after its path.
  expect(
    findLocalCommandTakingPositional(['select', 'endpoint']),
  ).toBeUndefined()
})
