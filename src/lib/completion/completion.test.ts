import { expect, test } from 'vitest'

import { testBlueprint } from '../../../test/fixtures/blueprint.js'
import { describeForShell } from './describe.js'
import {
  completionShells,
  isCompletionShell,
  renderCompletion,
} from './index.js'

test('isCompletionShell: accepts only supported shells', () => {
  expect(completionShells.every(isCompletionShell)).toBe(true)
  expect(isCompletionShell('nushell')).toBe(false)
  expect(isCompletionShell(undefined)).toBe(false)
})

test('describeForShell: drops characters that would end a quoted string', () => {
  expect(describeForShell("Whether the device's colon: is set.")).toBe(
    'Whether the devices colon is set.',
  )
  expect(describeForShell('First sentence. Second sentence.')).toBe(
    'First sentence.',
  )
  expect(describeForShell(`${'a'.repeat(80)}.`)).toHaveLength(72)
  expect(describeForShell('')).toBe('')
})

test('bash completion: dispatches on the command path', () => {
  const script = renderCompletion('bash', testBlueprint)
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
  const script = renderCompletion('zsh', testBlueprint)
  expect(script.startsWith('#compdef seam\n')).toBe(true)
  expect(script).toContain("('devices') _seam_reply+=('list:List Devices'")
  expect(script).toContain("'--limit:Number of devices to return.'")
  expect(script).toContain(
    "('devices list --device-type') _seam_reply+=('august_lock' 'schlage_lock') ;;",
  )
})

test('fish completion: guards each candidate with its command path', () => {
  const script = renderCompletion('fish', testBlueprint)
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
  const script = renderCompletion(shell, testBlueprint)
  // Descriptions are embedded in single-quoted shell strings.
  expect(script).not.toContain("device's")
  expect(script.endsWith('\n')).toBe(true)
})
