import { isDeepStrictEqual as isEqual } from 'node:util'

import type { ContextHelpers } from './types.js'
import { NonInteractiveError } from './util/cli-args.js'
import { promptAutocomplete, PromptBackError } from './util/prompt.js'

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

export async function interactForCommandSelection(
  commandPath: string[],
  helpers: ContextHelpers,
) {
  const commands = helpers.blueprint.routes
    .flatMap((route) => route.endpoints)
    .map((endpoint) =>
      endpoint.path.replace(/_/g, '-').replace(/^\//, '').split('/'),
    )
    .concat([
      ['login'],
      ['logout'],
      ['config', 'reveal-location'],
      ['config', 'use-remote-api-defs'],
      ['select', 'workspace'],
      ['select', 'server'],
      ['health', 'get-health'],
    ])

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

  let selectedCommand: string
  try {
    selectedCommand = await promptAutocomplete({
      message: `Select a command: /${commandPathStr}`,
      choices: [
        ...possibleCommands.map((cmd) => ({
          label:
            cmd?.[commandPath.length] ?? `[Call /${commandPathStr} Directly]`,
          value: cmd?.[commandPath.length] ?? '<none>',
        })),
      ].sort((a, b) => ergonomicSort(a.value, b.value)),
      allowBack: commandPath.length > 0,
    })
  } catch (error) {
    if (!(error instanceof PromptBackError)) throw error
    // The left arrow acts like the [Back] entry, which exists whenever
    // allowBack is set above.
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
