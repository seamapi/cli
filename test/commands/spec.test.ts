import { expect, test } from 'vitest'

import { localCommandDefinitions } from 'lib/commands/registry.js'
import { findCommand, findGroup, getCommandSpec } from 'lib/commands/spec.js'
import { testBlueprint } from 'test/fixtures/blueprint.js'

const spec = getCommandSpec(testBlueprint, localCommandDefinitions)

test('command spec: derives commands from endpoint paths', () => {
  expect(findCommand(spec, ['devices', 'list'])?.title).toBe('List Devices')
  expect(findCommand(spec, ['devices', 'list'])?.description).toBe(
    'Returns a list of all devices. Results are paginated.',
  )
})

test('command spec: falls back to the first sentence for an untitled endpoint', () => {
  expect(findCommand(spec, ['devices', 'unmanaged', 'get'])?.title).toBe(
    'Gets an unmanaged device.',
  )
})

test('command spec: includes commands handled by the CLI itself', () => {
  expect(findCommand(spec, ['login'])?.flags.map(({ long }) => long)).toEqual([
    'token',
  ])
  expect(findCommand(spec, ['select', 'workspace'])).toBeDefined()
  expect(findCommand(spec, ['completion', 'zsh'])).toBeDefined()
})

test('command spec: turns parameters into kebab-case flags', () => {
  expect(
    findCommand(spec, ['devices', 'list'])?.flags.map(({ long }) => long),
  ).toEqual(['device-type', 'is-managed', 'limit'])
})

test('command spec: carries whether a flag is required', () => {
  expect(
    findCommand(spec, ['devices', 'unmanaged', 'get'])?.flags,
  ).toMatchObject([{ long: 'device-id', isRequired: true }])
  expect(
    findCommand(spec, ['devices', 'list'])?.flags.map(
      ({ isRequired }) => isRequired,
    ),
  ).toEqual([false, false, false])
})

test('command spec: collects values for enum and boolean flags', () => {
  const flags = findCommand(spec, ['devices', 'list'])?.flags ?? []
  expect(flags.find(({ long }) => long === 'device-type')?.values).toEqual([
    'august_lock',
    'schlage_lock',
  ])
  expect(flags.find(({ long }) => long === 'is-managed')?.values).toEqual([
    'true',
    'false',
  ])
  expect(flags.find(({ long }) => long === 'limit')?.values).toEqual([])
})

test('command spec: includes null among the values for a nullable flag', () => {
  const blueprint = structuredClone(testBlueprint)
  const parameter = blueprint.routes
    .flatMap(({ endpoints }) => endpoints)
    .find(({ path }) => path === '/devices/list')
    ?.request.parameters.find(({ name }) => name === 'device_type')
  if (parameter == null) throw new Error('Missing test parameter')
  parameter.isNullable = true

  const nullableSpec = getCommandSpec(blueprint, localCommandDefinitions)
  const flags = findCommand(nullableSpec, ['devices', 'list'])?.flags ?? []

  expect(flags.find(({ long }) => long === 'device-type')?.values).toEqual([
    'august_lock',
    'schlage_lock',
    'null',
  ])
})

test('command spec: groups every incomplete command path', () => {
  expect(findGroup(spec, [])?.subcommands.map(({ name }) => name)).toContain(
    'devices',
  )
  expect(
    findGroup(spec, ['devices'])?.subcommands.map(({ name }) => name),
  ).toEqual(['list', 'unmanaged'])
  expect(findGroup(spec, ['devices', 'unmanaged'])?.subcommands).toEqual([
    { name: 'get', kind: 'api', description: 'Gets an unmanaged device.' },
  ])
})

test('command spec: names the commands a group holds', () => {
  const subcommands = findGroup(spec, [])?.subcommands ?? []
  expect(subcommands.find(({ name }) => name === 'devices')?.description).toBe(
    'list, unmanaged',
  )
  expect(
    subcommands.find(({ name }) => name === 'completion')?.description,
  ).toBe('bash, fish, zsh')
})

test('command spec: tells CLI commands apart from API commands', () => {
  expect(findCommand(spec, ['login'])?.kind).toBe('cli')
  expect(findCommand(spec, ['devices', 'list'])?.kind).toBe('api')
  // health is handled by the CLI but calls the Seam API.
  expect(findCommand(spec, ['health', 'get-health'])?.kind).toBe('api')

  const root = findGroup(spec, [])?.subcommands ?? []
  const kindOf = (name: string): string | undefined =>
    root.find((sub) => sub.name === name)?.kind
  expect(kindOf('select')).toBe('cli')
  expect(kindOf('wizard')).toBe('cli')
  expect(kindOf('devices')).toBe('api')
  expect(kindOf('health')).toBe('api')
})

test('command spec: never emits names a shell could read as syntax', () => {
  const hostile = {
    routes: [
      {
        endpoints: [
          {
            path: "/devices'; ls /; '/list",
            title: 'Hostile Path',
            description: '',
            request: { parameters: [] },
          },
          {
            path: '/devices/list',
            title: 'List Devices',
            description: '',
            request: {
              parameters: [
                {
                  name: "limit'; ls /; '",
                  description: '',
                  format: 'number',
                  isRequired: false,
                },
                {
                  name: 'limit',
                  description: '',
                  format: 'number',
                  isRequired: false,
                },
              ],
            },
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof getCommandSpec>[0]

  const hostileSpec = getCommandSpec(hostile)
  const paths = hostileSpec.commands.map(({ path }) => path.join(' '))
  expect(paths.filter((path) => path.includes('ls /'))).toEqual([])
  expect(paths).toContain('devices list')
  expect(
    findCommand(hostileSpec, ['devices', 'list'])?.flags.map(
      ({ long }) => long,
    ),
  ).toEqual(['limit'])
})

test('command spec: a command path is either a command or a group', () => {
  expect(findGroup(spec, ['devices', 'list'])).toBeUndefined()
  expect(findCommand(spec, ['devices'])).toBeUndefined()
  expect(findCommand(spec, ['nope'])).toBeUndefined()
  expect(findGroup(spec, ['nope'])).toBeUndefined()
})
