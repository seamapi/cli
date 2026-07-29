import type { Blueprint } from '@seamapi/blueprint'

import { ellipsis } from '../util/ellipsis.js'

type Endpoint = Blueprint['routes'][number]['endpoints'][number]
type Parameter = Endpoint['request']['parameters'][number]

export interface CompletionFlag {
  /** Long form without the leading `--`, or `null` for short-only flags. */
  long: string | null
  /** Short form without the leading `-`, or `null` when there is none. */
  short: string | null
  description: string
  /** Known values for the flag, used to complete its argument. */
  values: string[]
  /** Whether the flag is followed by a value. */
  takesValue: boolean
}

export interface CompletionCommand {
  path: string[]
  description: string
  flags: CompletionFlag[]
}

export interface CompletionSubcommand {
  name: string
  description: string
}

export interface CompletionGroup {
  /** Command path completed by this group, empty for `seam` itself. */
  path: string[]
  subcommands: CompletionSubcommand[]
}

export interface CompletionSpec {
  /** Every invocable command, sorted by command path. */
  commands: CompletionCommand[]
  /** Every incomplete command path, sorted by command path. */
  groups: CompletionGroup[]
  /** Flags accepted regardless of the command. */
  globalFlags: CompletionFlag[]
}

export const globalFlags: CompletionFlag[] = [
  {
    long: 'help',
    short: 'h',
    description: 'Display the help guide.',
    values: [],
    takesValue: false,
  },
  {
    long: 'remote-api-defs',
    short: null,
    description: 'Use the API definitions served by the Seam API.',
    values: [],
    takesValue: false,
  },
  {
    long: 'version',
    short: null,
    description: 'Print the CLI version.',
    values: [],
    takesValue: false,
  },
  {
    long: null,
    short: 'y',
    description: 'Take the first suggestion instead of prompting.',
    values: [],
    takesValue: false,
  },
]

export const flagTokens = (flag: CompletionFlag): string[] => {
  const tokens = []
  if (flag.long != null) tokens.push(`--${flag.long}`)
  if (flag.short != null) tokens.push(`-${flag.short}`)
  return tokens
}

export const getCompletionSpec = (blueprint: Blueprint): CompletionSpec => {
  const commands = sortByPath(
    dedupeByPath([
      ...blueprint.routes
        .flatMap((route) => route.endpoints)
        .map(toCompletionCommand),
      ...localCommands,
    ]),
  )

  return { commands, groups: toCompletionGroups(commands), globalFlags }
}

const stringFlag = (long: string, description: string): CompletionFlag => ({
  long,
  short: null,
  description,
  values: [],
  takesValue: true,
})

/**
 * Commands handled by the CLI itself, which have no endpoint in the blueprint.
 *
 * Keep in sync with the command handling in `src/bin/cli.ts` and the extra
 * commands offered by `interactForCommandSelection`.
 */
const localCommands: CompletionCommand[] = [
  {
    path: ['completion', 'bash'],
    description: 'Print the bash completion script.',
    flags: [],
  },
  {
    path: ['completion', 'fish'],
    description: 'Print the fish completion script.',
    flags: [],
  },
  {
    path: ['completion', 'zsh'],
    description: 'Print the zsh completion script.',
    flags: [],
  },
  {
    path: ['config', 'reveal-location'],
    description: 'Print the path to the CLI configuration file.',
    flags: [],
  },
  {
    path: ['config', 'use-remote-api-defs'],
    description: 'Choose whether to use the API definitions served by Seam.',
    flags: [],
  },
  {
    path: ['health', 'get-health'],
    description: 'Report the health of the Seam API.',
    flags: [],
  },
  {
    path: ['login'],
    description: 'Log in to Seam.',
    flags: [
      stringFlag('server', 'Seam API server to log in to.'),
      stringFlag('token', 'Personal access token to log in with.'),
      stringFlag('workspace-id', 'Workspace to select after logging in.'),
    ],
  },
  {
    path: ['logout'],
    description: 'Log out of Seam.',
    flags: [],
  },
  {
    path: ['select', 'server'],
    description: 'Select the Seam API server.',
    flags: [stringFlag('server', 'Seam API server to select.')],
  },
  {
    path: ['select', 'workspace'],
    description: 'Select the current workspace.',
    flags: [],
  },
]

const toCompletionCommand = (endpoint: Endpoint): CompletionCommand => ({
  path: toCommandPath(endpoint.path),
  description: summarize(
    endpoint.title === '' ? endpoint.description : endpoint.title,
  ),
  flags: [...endpoint.request.parameters]
    .map(toCompletionFlag)
    .sort((a, b) => compare(a.long ?? a.short, b.long ?? b.short)),
})

const toCompletionFlag = (parameter: Parameter): CompletionFlag => ({
  long: toFlagName(parameter.name),
  short: null,
  description: summarize(parameter.description),
  values: toFlagValues(parameter),
  takesValue: true,
})

const toFlagValues = (parameter: Parameter): string[] => {
  if (parameter.format === 'enum') {
    return parameter.values.map(({ name }) => name).filter(isSafeToken)
  }

  if (parameter.format === 'list' && parameter.itemFormat === 'enum') {
    return parameter.itemEnumValues.map(({ name }) => name).filter(isSafeToken)
  }

  // Nothing marks parameters as boolean-only flags, so minimist reads the next
  // argument as the value.
  if (parameter.format === 'boolean') return ['true', 'false']

  return []
}

/**
 * Whether a word can be written unquoted in a completion script. Command,
 * flag, and enum names come from the API definitions, so never emit one that
 * could be read as shell syntax.
 */
const isSafeToken = (token: string): boolean => /^[\w.:@/+-]+$/.test(token)

const toCompletionGroups = (
  commands: CompletionCommand[],
): CompletionGroup[] => {
  const groups = new Map<string, Map<string, string>>()

  for (const command of commands) {
    for (const [depth, name] of command.path.entries()) {
      const path = command.path.slice(0, depth)
      const key = path.join(' ')

      const subcommands = groups.get(key) ?? new Map<string, string>()
      groups.set(key, subcommands)

      const isCommand = depth === command.path.length - 1

      // A command and a group may share a name, e.g., a hypothetical
      // `seam devices` alongside `seam devices list`. Prefer the command
      // description, since it describes what running the name does.
      if (isCommand) {
        subcommands.set(name, command.description)
        continue
      }

      if (!subcommands.has(name)) {
        subcommands.set(name, `Commands for seam ${[...path, name].join(' ')}`)
      }
    }
  }

  return [...groups]
    .map(([key, subcommands]) => ({
      path: key === '' ? [] : key.split(' '),
      subcommands: [...subcommands]
        .map(([name, description]) => ({ name, description }))
        .sort((a, b) => compare(a.name, b.name)),
    }))
    .sort((a, b) => compare(a.path.join(' '), b.path.join(' ')))
}

const dedupeByPath = (commands: CompletionCommand[]): CompletionCommand[] => {
  const byPath = new Map<string, CompletionCommand>()
  for (const command of commands) {
    const key = command.path.join(' ')
    if (byPath.has(key)) continue
    byPath.set(key, command)
  }
  return [...byPath.values()]
}

const sortByPath = (commands: CompletionCommand[]): CompletionCommand[] =>
  [...commands].sort((a, b) => compare(a.path.join(' '), b.path.join(' ')))

const compare = (a: string | null, b: string | null): number =>
  (a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0

const toCommandPath = (path: string): string[] =>
  path.replace(/^\//, '').split('/').map(toFlagName)

const toFlagName = (name: string): string => name.replace(/_/g, '-')

const maxDescriptionLength = 72

/**
 * Reduce documentation prose to a single short line that is safe to embed in a
 * single-quoted shell string.
 */
export const summarize = (description: string): string => {
  const text = description
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const [sentence] = text.split(/(?<=\.)\s/)

  return ellipsis(
    (sentence ?? text).replace(/['"`$\\:]/g, '').trim(),
    maxDescriptionLength,
  )
}
