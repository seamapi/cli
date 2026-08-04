import commandLineUsage, { type Section } from 'command-line-usage'

import {
  type CommandDefinition,
  type CommandFlag,
  type CommandGroup,
  type CommandSpec,
  findCommand,
  findGroup,
} from './command-spec.js'

/**
 * Render the help guide for a command path, or `null` when no command or
 * group goes by that path.
 *
 * An empty path is the guide for `seam` itself.
 */
export const renderHelp = (
  path: string[],
  spec: CommandSpec,
): string | null => {
  const group = findGroup(spec, path)
  if (group != null) return commandLineUsage(groupSections(group, spec))

  const command = findCommand(spec, path)
  if (command != null) return commandLineUsage(commandSections(command, spec))

  return null
}

const overview =
  'Every seam command is interactive and will prompt you for any missing required properties with helpful suggestions. To avoid automatic behavior, pass -y'

const examples = [
  { name: 'seam', summary: 'Interactively select commands to execute.' },
  { name: 'seam login', summary: 'Login to Seam.' },
  { name: 'seam wizard', summary: 'Set up Seam in the current project.' },
  { name: 'seam select workspace', summary: 'Select your workspace.' },
  {
    name: 'seam connect-webviews create',
    summary: 'Create a connect webview to connect devices.',
  },
  { name: 'seam devices list', summary: 'List devices in your workspace.' },
  {
    name: 'seam locks unlock-door {bold --device-id} $MY_DOOR',
    summary: 'Unlock a lock.',
  },
  {
    name: "seam access-codes create {bold --code} '1234' {bold --name} 'My Code'",
    summary: 'Create an access code.',
  },
  {
    name: 'seam completion bash',
    summary: 'Print a shell completion script for bash, fish, or zsh.',
  },
]

const groupSections = (group: CommandGroup, spec: CommandSpec): Section[] => {
  const isRoot = group.path.length === 0
  const name = ['seam', ...group.path].join(' ')

  return [
    isRoot
      ? { header: 'Seam CLI', content: overview }
      : { header: name, content: `Commands under ${name}.` },
    { header: 'Usage', content: `${name} <command> [options]` },
    {
      header: 'Commands',
      content: group.subcommands.map(({ name, description }) => ({
        name,
        summary: description,
      })),
    },
    optionSection(spec.globalFlags),
    ...(isRoot ? [{ header: 'Command List Examples', content: examples }] : []),
    { content: `Run '${name} <command> --help' to see a command in detail.` },
  ]
}

const commandSections = (
  command: CommandDefinition,
  spec: CommandSpec,
): Section[] => {
  const name = ['seam', ...command.path].join(' ')
  const hasFlags = command.flags.length > 0

  return [
    {
      header: name,
      content: [command.title, command.description].filter(
        (line) => line !== '',
      ),
    },
    { header: 'Usage', content: `${name} [options]` },
    optionSection([...command.flags, ...spec.globalFlags]),
    ...(hasFlags
      ? [
          {
            content:
              'Any required option left out is prompted for interactively.',
          },
        ]
      : []),
  ]
}

const optionSection = (flags: CommandFlag[]): Section => ({
  header: 'Options',
  optionList: flags.map(toOptionDefinition),
})

const maxDocumentedValues = 8

interface OptionDefinition {
  name: string
  alias?: string
  description: string
  type: typeof Boolean | typeof String
  typeLabel?: string
}

const toOptionDefinition = (flag: CommandFlag): OptionDefinition => {
  const description = [
    flag.isRequired ? '{bold [required]}' : '',
    flag.description,
    describeValues(flag),
  ]
    .filter((part) => part !== '')
    .join(' ')

  return {
    // command-line-usage renders a nameless option as the short form alone.
    name: flag.long ?? '',
    ...(flag.short == null ? {} : { alias: flag.short }),
    // A flag with no value must be typed as a boolean, or the guide labels it
    // as taking a string.
    type: flag.takesValue ? String : Boolean,
    ...(flag.takesValue ? { typeLabel: '{underline value}' } : {}),
    description,
  }
}

const describeValues = (flag: CommandFlag): string => {
  if (flag.values.length === 0) return ''

  const shown = flag.values.slice(0, maxDocumentedValues).join(', ')
  const rest = flag.values.length - maxDocumentedValues

  return rest > 0 ? `One of: ${shown}, and ${rest} more.` : `One of: ${shown}.`
}
