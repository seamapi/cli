import type { Blueprint } from '@seamapi/blueprint'
import { expect, test } from 'vitest'

import { getCompletionSpec, summarize } from './completion-spec.js'
import {
  completionShells,
  isCompletionShell,
  renderCompletion,
} from './index.js'

/**
 * A blueprint with just enough shape to render completions from, standing in
 * for the API definitions bundled with the CLI.
 */
const blueprint = {
  routes: [
    {
      endpoints: [
        {
          path: '/devices/list',
          title: 'List Devices',
          description: 'Returns a list of all [devices](https://docs.seam.co).',
          request: {
            parameters: [
              {
                name: 'limit',
                description: 'Number of devices to return.',
                format: 'number',
              },
              {
                name: 'device_type',
                description: 'Device type: for which you want to list devices.',
                format: 'enum',
                values: [{ name: 'august_lock' }, { name: 'schlage_lock' }],
              },
              {
                name: 'is_managed',
                description: "Whether the device's account is managed.",
                format: 'boolean',
              },
            ],
          },
        },
        {
          path: '/devices/unmanaged/get',
          title: '',
          description: 'Gets an unmanaged device. Only some fields are set.',
          request: { parameters: [] },
        },
      ],
    },
  ],
} as unknown as Blueprint

const spec = getCompletionSpec(blueprint)

const findCommand = (path: string) =>
  spec.commands.find((command) => command.path.join(' ') === path)

const findGroup = (path: string) =>
  spec.groups.find((group) => group.path.join(' ') === path)

test('completion spec: derives commands from endpoint paths', () => {
  expect(findCommand('devices list')?.description).toBe('List Devices')
  expect(findCommand('devices unmanaged get')?.description).toBe(
    'Gets an unmanaged device.',
  )
})

test('completion spec: includes commands handled by the CLI itself', () => {
  expect(findCommand('login')?.flags.map(({ long }) => long)).toEqual([
    'server',
    'token',
    'workspace-id',
  ])
  expect(findCommand('select workspace')).toBeDefined()
  expect(findCommand('completion zsh')).toBeDefined()
})

test('completion spec: turns parameters into kebab-case flags', () => {
  expect(findCommand('devices list')?.flags.map(({ long }) => long)).toEqual([
    'device-type',
    'is-managed',
    'limit',
  ])
})

test('completion spec: collects values for enum and boolean flags', () => {
  const flags = findCommand('devices list')?.flags ?? []
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

test('completion spec: groups every incomplete command path', () => {
  expect(findGroup('')?.subcommands.map(({ name }) => name)).toContain(
    'devices',
  )
  expect(findGroup('devices')?.subcommands.map(({ name }) => name)).toEqual([
    'list',
    'unmanaged',
  ])
  expect(findGroup('devices unmanaged')?.subcommands).toEqual([
    { name: 'get', description: 'Gets an unmanaged device.' },
  ])
})

test('summarize: reduces prose to one quotable line', () => {
  expect(
    summarize('Returns a list of all [devices](https://docs.seam.co).'),
  ).toBe('Returns a list of all devices.')
  expect(summarize('First sentence. Second sentence.')).toBe('First sentence.')
  expect(summarize("Don't use a `colon: here`.")).toBe('Dont use a colon here.')
  expect(summarize(`${'a'.repeat(80)}.`)).toHaveLength(72)
})

test('isCompletionShell: accepts only supported shells', () => {
  expect(completionShells.every(isCompletionShell)).toBe(true)
  expect(isCompletionShell('nushell')).toBe(false)
  expect(isCompletionShell(undefined)).toBe(false)
})

test('bash completion: dispatches on the command path', () => {
  const script = renderCompletion('bash', blueprint)
  expect(script).toContain('complete -F _seam_completion seam')
  expect(script).toContain("'devices') echo 'list unmanaged' ;;")
  expect(script).toContain(
    "'devices list') echo '--device-type --is-managed --limit' ;;",
  )
  expect(script).toContain(
    "'devices list --device-type') echo 'august_lock schlage_lock' ;;",
  )
})

test('zsh completion: describes every candidate', () => {
  const script = renderCompletion('zsh', blueprint)
  expect(script.startsWith('#compdef seam\n')).toBe(true)
  expect(script).toContain("('devices') _seam_reply+=('list:List Devices'")
  expect(script).toContain("'--limit:Number of devices to return.'")
  expect(script).toContain(
    "('devices list --device-type') _seam_reply+=('august_lock' 'schlage_lock') ;;",
  )
})

test('fish completion: guards each candidate with its command path', () => {
  const script = renderCompletion('fish', blueprint)
  expect(script).toContain('complete -c seam -f')
  expect(script).toContain(
    `complete -c seam -n '__seam_using "devices"' -a 'list' -d 'List Devices'`,
  )
  expect(script).toContain(
    `complete -c seam -n '__seam_using "devices list"' -l device-type -r -a 'august_lock schlage_lock' -d 'Device type for which you want to list devices.'`,
  )
  expect(script).toContain(`complete -c seam -s h -l help -d`)
})

test.each(completionShells)('%s completion: quotes safely', (shell) => {
  const script = renderCompletion(shell, blueprint)
  // Descriptions are embedded in single-quoted shell strings.
  expect(script).not.toContain("device's")
  expect(script.endsWith('\n')).toBe(true)
})
