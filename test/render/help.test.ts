import { expect, test } from 'vitest'

import { buildRegistry } from 'lib/commands/registry.js'
import { renderHelp } from 'lib/render/help.js'
import { testBlueprint } from 'test/fixtures/blueprint.js'

const { spec } = buildRegistry(testBlueprint)

const help = (...path: string[]): string => {
  const rendered = renderHelp(path, spec)
  if (rendered == null) throw new Error(`No help for seam ${path.join(' ')}`)
  return rendered
}

/** The guide wraps prose to the terminal, so match it without its layout. */
const helpText = (...path: string[]): string =>
  help(...path).replace(/\s+/g, ' ')

test('root help: lists every top level command', () => {
  const rendered = helpText()
  expect(rendered).toContain('Seam CLI')
  expect(rendered).toContain('seam <command> [options]')
  // Both blueprint routes and commands handled by the CLI itself.
  expect(rendered).toContain('devices')
  expect(rendered).toContain('login')
  expect(rendered).toContain('completion')
  expect(rendered).toContain('Command List Examples')
  expect(rendered).toContain("Run 'seam <command> --help'")
})

test('root help: groups CLI commands apart from API commands', () => {
  const rendered = helpText()

  const commands = rendered.indexOf('Commands')
  const apiCommands = rendered.indexOf('API Commands')
  const examples = rendered.indexOf('Command List Examples')
  expect(commands).toBeGreaterThan(-1)
  expect(apiCommands).toBeGreaterThan(commands)
  expect(examples).toBeGreaterThan(apiCommands)

  // login is a CLI command, devices calls the API.
  expect(rendered.indexOf('login')).toBeLessThan(apiCommands)
  expect(rendered.indexOf('devices')).toBeGreaterThan(apiCommands)
})

test('group help: lists the subcommands of the group', () => {
  const rendered = helpText('devices')
  expect(rendered).toContain('seam devices <command> [options]')
  expect(rendered).toContain('List Devices')
  expect(rendered).toContain('unmanaged')
  // A group is not the place for the whole command list.
  expect(rendered).not.toContain('Command List Examples')
  expect(rendered).not.toContain('API Commands')
  expect(rendered).not.toContain('login')
})

test('group help: works for a nested group', () => {
  const rendered = helpText('devices', 'unmanaged')
  expect(rendered).toContain('seam devices unmanaged <command> [options]')
  expect(rendered).toContain('Gets an unmanaged device.')
})

test('command help: documents the flags of the command', () => {
  const rendered = helpText('devices', 'list')
  expect(rendered).toContain('seam devices list [options]')
  expect(rendered).toContain('Returns a list of all devices.')
  expect(rendered).toContain('--limit')
  expect(rendered).toContain('Number of devices to return.')
  expect(rendered).toContain('--device-type')
  // Global flags stay available on every command.
  expect(rendered).toContain('--help')
  expect(rendered).toContain('-y')
})

test('command help: keeps parameters apart from the CLI options', () => {
  const rendered = helpText('devices', 'list')

  const parameters = rendered.indexOf('Parameters')
  const options = rendered.indexOf('Options')
  expect(parameters).toBeGreaterThan(-1)
  expect(options).toBeGreaterThan(parameters)

  // The command's own parameters sit under Parameters, the CLI's flags
  // under Options.
  expect(rendered.indexOf('--limit')).toBeLessThan(options)
  expect(rendered.indexOf('--version')).toBeGreaterThan(options)

  // A command with no parameters has no Parameters section.
  expect(helpText('logout')).not.toContain('Parameters')
})

test('command help: marks required flags and documents known values', () => {
  expect(helpText('devices', 'unmanaged', 'get')).toContain('[required]')
  expect(helpText('devices', 'list')).toContain(
    'One of: august_lock, schlage_lock.',
  )
})

test('command help: a command has no subcommands to list', () => {
  expect(helpText('devices', 'list')).not.toContain('<command>')
})

test('help: is absent for an unknown command path', () => {
  expect(renderHelp(['nope'], spec)).toBeNull()
  expect(renderHelp(['devices', 'nope'], spec)).toBeNull()
})
