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
  'Every seam command runs as soon as every required property is given, and otherwise prompts you for what is missing with helpful suggestions. Pass -i to always review properties first, or -y to never be prompted.'

const outputSection = {
  header: 'Output',
  content: [
    'Only the response is written to stdout, so it is safe to pipe. Prompts, progress, and other information are written to stderr.',
    'The response is trimmed to the response key and pagination.',
    'Request params may be piped or redirected in as a JSON object. Params given as arguments win over params read from stdin.',
  ],
}

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
    name: 'seam devices list {bold --interactive}',
    summary: 'Review and edit filters before listing devices.',
  },
  {
    name: 'seam devices list {bold --non-interactive}',
    summary: 'List devices, failing instead of prompting.',
  },
  {
    name: 'seam locks unlock-door {bold --device-id} $MY_DOOR',
    summary: 'Unlock a lock.',
  },
  {
    name: "seam access-codes create {bold --code} '1234' {bold --name} 'My Code'",
    summary: 'Create an access code.',
  },
  {
    name: 'seam devices list {bold --page-cursor} $NEXT_PAGE_CURSOR',
    summary: 'List the next page of devices.',
  },
  {
    name: 'seam devices list > devices.json',
    summary: 'Write the response to a file as JSON.',
  },
  {
    name: 'cat params.json | seam locks unlock-door',
    summary: 'Pipe request params in as JSON.',
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
    ...commandSectionsForGroup(group, isRoot),
    optionSection(spec.globalFlags),
    ...(isRoot
      ? [outputSection, { header: 'Command List Examples', content: examples }]
      : []),
    { content: `Run '${name} <command> --help' to see a command in detail.` },
  ]
}

const commandSectionsForGroup = (
  group: CommandGroup,
  isRoot: boolean,
): Section[] => {
  const content = (subcommands: CommandGroup['subcommands']) =>
    subcommands.map(({ name, description }) => ({ name, summary: description }))

  // The root guide separates the commands of the CLI itself from the commands
  // that call the Seam API. Anywhere deeper the split adds nothing: a group
  // holds commands of one kind.
  if (!isRoot) {
    return [{ header: 'Commands', content: content(group.subcommands) }]
  }

  const cli = group.subcommands.filter(({ kind }) => kind === 'cli')
  const api = group.subcommands.filter(({ kind }) => kind === 'api')

  return [
    { header: 'Commands', content: content(cli) },
    { header: 'API Commands', content: content(api) },
  ].filter((section) => section.content.length > 0)
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
    // The command's own parameters are what the request is made of, so keep
    // them apart from the options every seam command takes.
    ...(hasFlags ? [optionSection(command.flags, 'Parameters')] : []),
    optionSection(spec.globalFlags),
    ...(hasFlags
      ? [
          {
            content:
              'Any required parameter left out is prompted for interactively.',
          },
        ]
      : []),
  ]
}

const optionSection = (flags: CommandFlag[], header = 'Options'): Section => ({
  header,
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
