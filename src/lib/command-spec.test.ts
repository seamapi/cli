import { expect, test } from 'vitest'

import { testBlueprint } from '../../test/fixtures/blueprint.js'
import {
  findCommand,
  findGroup,
  firstSentence,
  getCommandSpec,
  toPlainText,
} from './command-spec.js'

const spec = getCommandSpec(testBlueprint)

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
    'server',
    'token',
    'workspace-id',
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

test('command spec: groups every incomplete command path', () => {
  expect(findGroup(spec, [])?.subcommands.map(({ name }) => name)).toContain(
    'devices',
  )
  expect(
    findGroup(spec, ['devices'])?.subcommands.map(({ name }) => name),
  ).toEqual(['list', 'unmanaged'])
  expect(findGroup(spec, ['devices', 'unmanaged'])?.subcommands).toEqual([
    { name: 'get', description: 'Gets an unmanaged device.' },
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

test('command spec: a command path is either a command or a group', () => {
  expect(findGroup(spec, ['devices', 'list'])).toBeUndefined()
  expect(findCommand(spec, ['devices'])).toBeUndefined()
  expect(findCommand(spec, ['nope'])).toBeUndefined()
  expect(findGroup(spec, ['nope'])).toBeUndefined()
})

test('toPlainText: reduces markdown to one line', () => {
  expect(toPlainText('Returns all [devices](https://docs.seam.co).')).toBe(
    'Returns all devices.',
  )
  expect(toPlainText('Uses `code`\nand **bold**.')).toBe('Uses code and bold.')
  expect(toPlainText("Keeps the device's colon: intact.")).toBe(
    "Keeps the device's colon: intact.",
  )
})

test('firstSentence: stops at the first sentence break', () => {
  expect(firstSentence('First sentence. Second sentence.')).toBe(
    'First sentence.',
  )
  expect(firstSentence('No break here')).toBe('No break here')
})
