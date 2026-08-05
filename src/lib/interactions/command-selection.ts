import { isDeepStrictEqual as isEqual } from 'node:util'

import type { Interactivity } from 'lib/args/parse.js'
import { NonInteractiveError, PromptCancelledError } from 'lib/errors.js'
import { promptAutocomplete, withBackHint } from './prompt.js'

const uniqBy = <T>(items: T[], keyOf: (item: T) => unknown): T[] => {
  const seen = new Set<unknown>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const ergonomicOrder = ['create', 'list', 'get', 'update', 'unlock_door']

function ergonomicSort(aStr: string, bStr: string) {
  let a = ergonomicOrder.indexOf(aStr)
  if (a === -1) a = ergonomicOrder.length
  let b = ergonomicOrder.indexOf(bStr)
  if (b === -1) b = ergonomicOrder.length

  return a > b ? 1 : a < b ? -1 : 0
}

/**
 * Resolve a command path to a full command, prompting to complete it when
 * interactive. `commands` is every selectable command path, from the
 * registry's spec.
 */
export async function interactForCommandSelection(
  commandPath: string[],
  helpers: { commands: string[][]; interactivity: Interactivity },
): Promise<string[]> {
  const commands = helpers.commands

  const possibleCommands = uniqBy(
    commandPath.length === 0
      ? commands
      : commands.filter((cmd) =>
          isEqual(cmd.slice(0, commandPath.length), commandPath),
        ),
    (v) => v[commandPath.length],
  )

  if (possibleCommands.length === 0) {
    throw new Error('No possible commands')
  }

  if (
    possibleCommands.length === 1 &&
    possibleCommands[0]?.length === commandPath.length
  ) {
    return commandPath
  }

  if (helpers.interactivity === 'non-interactive') {
    // The command path is itself a command, so call it directly rather than
    // prompting to select one of its sub-commands.
    if (possibleCommands.some((cmd) => cmd.length === commandPath.length)) {
      return commandPath
    }

    const subcommands = possibleCommands
      .map((cmd) => cmd[commandPath.length])
      .filter((subcommand) => subcommand != null)
      .sort(ergonomicSort)
    throw new NonInteractiveError(
      `${
        commandPath.length === 0
          ? 'Missing command'
          : `Incomplete command "seam ${commandPath.join(' ')}"`
      }: expected one of ${subcommands.join(', ')}`,
    )
  }

  // Add dynamic 'back' command for sub-commands to allow returning
  // to previous level.
  if (commandPath.length > 0) {
    possibleCommands.push([...commandPath, '[Back]'])
  }

  const commandPathStr = commandPath.join('/').replace(/-/g, '_')

  // Only a sub-command menu has a level to go back to, so only it says so.
  const selectMessage = `Select a command: /${commandPathStr}`

  let selectedCommand: string
  try {
    selectedCommand = await promptAutocomplete({
      message:
        commandPath.length > 0 ? withBackHint(selectMessage) : selectMessage,
      choices: [
        ...possibleCommands.map((cmd) => ({
          label:
            cmd?.[commandPath.length] ?? `[Call /${commandPathStr} Directly]`,
          value: cmd?.[commandPath.length] ?? '<none>',
        })),
      ].sort((a, b) => ergonomicSort(a.value, b.value)),
    })
  } catch (error) {
    if (!(error instanceof PromptCancelledError)) throw error
    // Dismissing the menu means the same as its [Back] entry, which is only
    // offered when there is a level to go back to. At the top there is none,
    // so dismissing it stops the CLI as it always has.
    if (commandPath.length === 0) throw error
    selectedCommand = '[Back]'
  }

  if (selectedCommand === '<none>') {
    return commandPath
  }

  const newCommandPath = [...commandPath, selectedCommand]

  const fullCommand = possibleCommands.find((cmd) =>
    isEqual(newCommandPath, cmd),
  )

  if (!fullCommand) {
    return interactForCommandSelection(newCommandPath, helpers)
  }

  return fullCommand
}
