import type { Blueprint } from '@seamapi/blueprint'

type Endpoint = Blueprint['routes'][number]['endpoints'][number]
type Parameter = Endpoint['request']['parameters'][number]

export interface CommandFlag {
  /** Long form without the leading `--`, or `null` for short-only flags. */
  long: string | null
  /** Short form without the leading `-`, or `null` when there is none. */
  short: string | null
  description: string
  /** Known values for the flag, used to complete and document its argument. */
  values: string[]
  /** Whether the flag is followed by a value. */
  takesValue: boolean
  isRequired: boolean
}

/**
 * Whether a command is part of the CLI itself or calls a Seam API endpoint.
 */
export type CommandKind = 'cli' | 'api'

export interface CommandDefinition {
  path: string[]
  kind: CommandKind
  /** One line naming what the command does. */
  title: string
  /** Longer prose about the command, empty when there is none to add. */
  description: string
  flags: CommandFlag[]
}

export interface Subcommand {
  name: string
  /** 'api' when the name holds any command that calls the Seam API. */
  kind: CommandKind
  description: string
}

export interface CommandGroup {
  /** Command path completed by this group, empty for `seam` itself. */
  path: string[]
  subcommands: Subcommand[]
}

export interface CommandSpec {
  /** Every invocable command, sorted by command path. */
  commands: CommandDefinition[]
  /** Every incomplete command path, sorted by command path. */
  groups: CommandGroup[]
  /** Flags accepted regardless of the command. */
  globalFlags: CommandFlag[]
}

export const globalFlags: CommandFlag[] = [
  {
    long: 'help',
    short: 'h',
    description: 'Display this help guide.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'interactive',
    short: 'i',
    description:
      'Always prompt to review and edit properties, prefilled with the given arguments.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'json',
    short: null,
    description:
      'Write the response to stdout as JSON. Enabled automatically when stdout is not a terminal, disable with --no-json.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'non-interactive',
    short: 'y',
    description:
      'Never prompt: exit with an error if the command or any required property is missing.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'remote-api-defs',
    short: null,
    description: 'Use the API definitions served by the Seam API.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'update',
    short: null,
    description: 'Force an update of the cached Seam API definitions.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
  {
    long: 'version',
    short: null,
    description: 'Print the CLI version.',
    values: [],
    takesValue: false,
    isRequired: false,
  },
]

export const flagTokens = (flag: CommandFlag): string[] => {
  const tokens = []
  if (flag.long != null) tokens.push(`--${flag.long}`)
  if (flag.short != null) tokens.push(`-${flag.short}`)
  return tokens
}

export const getCommandSpec = (blueprint: Blueprint): CommandSpec => {
  const commands = sortByPath(
    dedupeByPath([
      ...blueprint.routes
        .flatMap((route) => route.endpoints)
        .map(toCommandDefinition)
        // Command and flag names end up unquoted or single-quoted in shell
        // scripts, so drop any the definitions should never contain rather
        // than emit something a shell could read as syntax.
        .filter((command) => command.path.every(isSafeToken)),
      ...localCommands,
    ]),
  )

  return { commands, groups: toCommandGroups(commands), globalFlags }
}

export const findCommand = (
  spec: CommandSpec,
  path: string[],
): CommandDefinition | undefined =>
  spec.commands.find((command) => isSamePath(command.path, path))

export const findGroup = (
  spec: CommandSpec,
  path: string[],
): CommandGroup | undefined =>
  spec.groups.find((group) => isSamePath(group.path, path))

/**
 * The definition of a command the CLI handles itself, or `undefined` when the
 * path is an endpoint or no command at all.
 *
 * Unlike {@link findCommand} this needs no blueprint, since these commands are
 * declared by the CLI rather than derived from the API definitions.
 */
export const findLocalCommand = (
  path: string[],
): CommandDefinition | undefined =>
  localCommands.find((command) => isSamePath(command.path, path))

const isSamePath = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((word, index) => word === b[index])

const stringFlag = (long: string, description: string): CommandFlag => ({
  long,
  short: null,
  description,
  values: [],
  takesValue: true,
  isRequired: false,
})

/**
 * Commands handled by the CLI itself, which have no endpoint in the blueprint.
 *
 * Keep in sync with the command handling in `src/bin/cli.ts` and the extra
 * commands offered by `interactForCommandSelection`.
 */
const localCommands: CommandDefinition[] = [
  {
    path: ['completion', 'bash'],
    kind: 'cli',
    title: 'Print the bash completion script.',
    description: '',
    flags: [],
  },
  {
    path: ['completion', 'fish'],
    kind: 'cli',
    title: 'Print the fish completion script.',
    description: '',
    flags: [],
  },
  {
    path: ['completion', 'zsh'],
    kind: 'cli',
    title: 'Print the zsh completion script.',
    description: '',
    flags: [],
  },
  {
    path: ['config', 'reveal-location'],
    kind: 'cli',
    title: 'Print the path to the CLI configuration file.',
    description: '',
    flags: [],
  },
  {
    path: ['config', 'use-remote-api-defs'],
    kind: 'cli',
    title: 'Choose whether to use the API definitions served by Seam.',
    description: '',
    flags: [],
  },
  {
    path: ['health', 'get-health'],
    kind: 'api',
    title: 'Report the health of the Seam API.',
    description: '',
    flags: [],
  },
  {
    path: ['login'],
    kind: 'cli',
    title: 'Log in to Seam.',
    description:
      'Prompts for a personal access token unless one is passed with --token.',
    flags: [
      stringFlag('server', 'Seam API server to log in to.'),
      stringFlag('token', 'Personal access token to log in with.'),
      stringFlag('workspace-id', 'Workspace to select after logging in.'),
    ],
  },
  {
    path: ['logout'],
    kind: 'cli',
    title: 'Log out of Seam.',
    description: '',
    flags: [],
  },
  {
    path: ['select', 'server'],
    kind: 'cli',
    title: 'Select the Seam API server.',
    description: '',
    flags: [stringFlag('server', 'Seam API server to select.')],
  },
  {
    path: ['select', 'workspace'],
    kind: 'cli',
    title: 'Select the current workspace.',
    description: '',
    flags: [],
  },
  {
    path: ['wizard'],
    kind: 'cli',
    title: 'Set up Seam in the current project.',
    description:
      'Takes a project from zero to a working Seam integration. Run seam wizard --help for its own options.',
    flags: [],
  },
]

const toCommandDefinition = (endpoint: Endpoint): CommandDefinition => {
  const description = toPlainText(endpoint.description)

  return {
    path: toCommandPath(endpoint.path),
    kind: 'api',
    title:
      endpoint.title === ''
        ? firstSentence(description)
        : toPlainText(endpoint.title),
    description,
    flags: [...endpoint.request.parameters]
      .map(toCommandFlag)
      .filter((flag) => flag.long == null || isSafeToken(flag.long))
      .sort((a, b) => compare(a.long ?? a.short, b.long ?? b.short)),
  }
}

const toCommandFlag = (parameter: Parameter): CommandFlag => ({
  long: toFlagName(parameter.name),
  short: null,
  description: toPlainText(parameter.description),
  values: toFlagValues(parameter),
  takesValue: true,
  isRequired: parameter.isRequired,
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
 * Whether a word is safe to write into a shell script. Command, flag, and
 * enum names come from the API definitions and are embedded unquoted or
 * single-quoted in completion scripts, so never emit one that a shell could
 * read as syntax.
 */
const isSafeToken = (token: string): boolean => /^[\w.:@/+-]+$/.test(token)

interface GroupEntry {
  isCommand: boolean
  kind: CommandKind
  description: string
}

const toCommandGroups = (commands: CommandDefinition[]): CommandGroup[] => {
  const groups = new Map<string, Map<string, GroupEntry>>()

  for (const command of commands) {
    for (const [depth, name] of command.path.entries()) {
      const key = command.path.slice(0, depth).join(' ')

      const entries = groups.get(key) ?? new Map<string, GroupEntry>()
      groups.set(key, entries)

      // An entry is an API command if any command it holds calls the API.
      const kind =
        command.kind === 'api' ? 'api' : (entries.get(name)?.kind ?? 'cli')

      // A command and a group may share a name, e.g., a hypothetical
      // `seam devices` alongside `seam devices list`. Prefer the command
      // title, since it describes what running the name does.
      if (depth === command.path.length - 1) {
        entries.set(name, { isCommand: true, kind, description: command.title })
        continue
      }

      const entry = entries.get(name)
      entries.set(name, {
        isCommand: entry?.isCommand ?? false,
        kind,
        description: entry?.description ?? '',
      })
    }
  }

  // Groups have no description of their own in the API definitions, so name
  // the commands they hold instead. Leave the list whole: help wraps it, and
  // completion shortens it to fit a menu column.
  const summarizeGroup = (key: string): string =>
    [...(groups.get(key)?.keys() ?? [])].join(', ')

  return [...groups]
    .map(([key, entries]) => ({
      path: key === '' ? [] : key.split(' '),
      subcommands: [...entries]
        .map(([name, entry]) => ({
          name,
          kind: entry.kind,
          description: entry.isCommand
            ? entry.description
            : summarizeGroup(key === '' ? name : `${key} ${name}`),
        }))
        .sort((a, b) => compare(a.name, b.name)),
    }))
    .sort((a, b) => compare(a.path.join(' '), b.path.join(' ')))
}

const dedupeByPath = (commands: CommandDefinition[]): CommandDefinition[] => {
  const byPath = new Map<string, CommandDefinition>()
  for (const command of commands) {
    const key = command.path.join(' ')
    if (byPath.has(key)) continue
    byPath.set(key, command)
  }
  return [...byPath.values()]
}

const sortByPath = (commands: CommandDefinition[]): CommandDefinition[] =>
  [...commands].sort((a, b) => compare(a.path.join(' '), b.path.join(' ')))

const compare = (a: string | null, b: string | null): number =>
  (a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0

const toCommandPath = (path: string): string[] =>
  path.replace(/^\//, '').split('/').map(toFlagName)

const toFlagName = (name: string): string => name.replace(/_/g, '-')

/** Reduce documentation markdown to a single line of prose. */
export const toPlainText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const firstSentence = (text: string): string => {
  const [sentence] = text.split(/(?<=\.)\s/)
  return sentence ?? text
}
