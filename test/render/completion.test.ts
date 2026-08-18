import { expect, test } from 'vitest'

import { buildRegistry } from 'lib/commands/registry.js'
import { describeForShell } from 'lib/render/completion/describe.js'
import {
  completionScriptSentinels,
  completionShells,
  isCompletionShell,
  renderCompletion,
  renderCompletionEval,
  renderCompletionStub,
} from 'lib/render/completion/index.js'
import { testBlueprint } from 'test/fixtures/blueprint.js'

const { spec } = buildRegistry(testBlueprint)

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
  const script = renderCompletion('bash', spec)
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
  const script = renderCompletion('zsh', spec)
  expect(script.startsWith('#compdef seam\n')).toBe(true)
  expect(script).toContain("('devices') _seam_reply+=('list:List Devices'")
  expect(script).toContain("'--limit:Number of devices to return.'")
  expect(script).toContain(
    "('devices list --device-type') _seam_reply+=('august_lock' 'schlage_lock') ;;",
  )
})

test('fish completion: guards each candidate with its command path', () => {
  const script = renderCompletion('fish', spec)
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
  const script = renderCompletion(shell, spec)
  // Descriptions are embedded in single-quoted shell strings.
  expect(script).not.toContain("device's")
  expect(script.endsWith('\n')).toBe(true)
})

test.each(completionShells)(
  '%s completion stub: loads completions from the CLI',
  (shell) => {
    const stub = renderCompletionStub(shell)
    expect(stub).toContain(`seam completion ${shell}`)
    expect(stub.endsWith('\n')).toBe(true)
  },
)

test.each(completionShells)(
  '%s completion stub: evaluates only what the script generator produces',
  (shell) => {
    const sentinel = completionScriptSentinels[shell]
    // The stub requires the sentinel, and the generated script provides it
    // as its exact first line, so the two cannot drift apart.
    expect(renderCompletionStub(shell)).toContain(sentinel)
    expect(renderCompletion(shell, spec).startsWith(`${sentinel}\n`)).toBe(true)
  },
)

test('zsh completion stub: is an autoloadable completion function', () => {
  expect(renderCompletionStub('zsh').startsWith('#compdef seam\n')).toBe(true)
})

test('zsh completion: completes the in-flight request when evaluated by the stub', () => {
  // eval pushes '(eval)' onto funcstack, so the dispatch must search the
  // whole stack for _seam, not only the top.
  expect(renderCompletion('zsh', spec)).toContain(
    // eslint-disable-next-line no-template-curly-in-string
    'if (( ${funcstack[(I)_seam]} )); then',
  )
})

test.each(completionShells)(
  '%s completion loader: survives being evaluated by a shell config',
  (shell) => {
    expect(renderCompletionStub(shell)).not.toMatch(/^local /m)
  },
)

test.each(completionShells)('%s completion eval: loads the loader', (shell) => {
  expect(renderCompletionEval(shell)).toContain(
    `seam completion --loader ${shell}`,
  )
})

test('bash completion loader: completes again with the script it loaded', () => {
  const stub = renderCompletionStub('bash')
  expect(stub).toContain('complete -F _seam_completion_loader seam')
  expect(stub).toContain('return 124')
})

test('zsh completion loader: registers itself when sourced', () => {
  const stub = renderCompletionStub('zsh')
  expect(stub).toContain('if (( $+functions[compdef] )); then')
  expect(stub).toContain('compdef _seam seam')
  // eslint-disable-next-line no-template-curly-in-string
  expect(stub).toContain('if (( ${funcstack[(I)_seam]} )); then')
})

test('zsh completion loader: leaves the completion system to the shell', () => {
  expect(renderCompletionStub('zsh')).not.toContain('compinit')
})
