import parseArgs, { type ParsedArgs } from 'minimist'

import type { AuthOverrides } from 'lib/overrides.js'

/**
 * How the CLI should behave when properties are not given as arguments.
 *
 * - `auto`: make the request as soon as every required property is given,
 *   otherwise prompt for what is missing. This is the default.
 * - `interactive`: always prompt to review and edit properties, prefilled
 *   with the given arguments. Selected with `--interactive` or `-i`.
 * - `non-interactive`: never prompt: anything missing is an error.
 *   Selected with `--non-interactive` or `-y`.
 */
export type Interactivity = 'auto' | 'interactive' | 'non-interactive'

/**
 * Argument keys that select the interactivity
 * and are therefore not command parameters.
 */
export const interactivityFlags: string[] = [
  'non_interactive',
  'y',
  'interactive',
  'i',
]

/**
 * Argument keys that configure the CLI itself
 * and are therefore never sent as command parameters.
 */
export const cliFlags: string[] = [
  ...interactivityFlags,
  'endpoint',
  'h',
  'help',
  'json',
  'raw',
  'remote_schema',
  'update',
  'version',
  'workspace_id',
]

export interface ParseCliArgsOptions {
  /**
   * Argument keys read exactly as given rather than by guessing at a type,
   * e.g., every parameter of an endpoint that does not take a number or a
   * boolean. Read as a number, an opaque value like an access code would
   * lose leading zeroes or turn exponent notation into a digit string.
   */
  stringKeys?: string[]
}

export const parseCliArgs = (
  argv: string[],
  { stringKeys = [] }: ParseCliArgsOptions = {},
): ParsedArgs =>
  parseArgs(argv, {
    // A page cursor and a code are opaque even before the endpoint's own
    // parameter types are known, so always keep them exactly as given. The
    // overrides are read as given for the same reason: a URL or an id is
    // never a number, however it happens to be spelled.
    string: [
      'code',
      'endpoint',
      'page-cursor',
      'page_cursor',
      'workspace-id',
      'workspace_id',
      ...stringKeys,
    ],
    boolean: ['non-interactive', 'interactive', 'json'],
    // Deliberately not aliased to -n, which is reserved for a future
    // --dry-run flag.
    alias: { 'non-interactive': 'y', interactive: 'i' },
  })

/**
 * The request params among the parsed arguments: every key normalized to
 * the parameter it names, minus the flags that configure the CLI itself.
 */
export const toArgParams = (args: ParsedArgs): Record<string, unknown> => {
  const argParams: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key === '_') continue
    const name = toParameterName(key)
    if (cliFlags.includes(name)) continue
    argParams[name] = value
  }
  return argParams
}

/**
 * The auth overrides among the parsed arguments.
 *
 * Both scope a single command: they change what it resolves to and are never
 * stored, so they read like the environment variables they take precedence
 * over, down to treating a blank value as though it were not given.
 */
export const toAuthOverrides = (args: ParsedArgs): AuthOverrides => {
  // Read by the name each key names, as every other argument is, so the
  // overrides may be written `--workspace-id`, `--workspace_id`, or in caps,
  // and so they resolve whenever they are read.
  const byName: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key === '_') continue
    byName[toParameterName(key)] = value
  }

  return {
    endpoint: readOverride(byName['endpoint']),
    workspaceId: readOverride(byName['workspace_id']),
  }
}

const readOverride = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}

export interface GetInteractivityOptions {
  /**
   * Whether there is a terminal to prompt on.
   *
   * When there is not, the CLI cannot ask for anything, so it behaves as
   * though `--non-interactive` was given rather than waiting on a prompt
   * nobody can answer.
   */
  canPrompt?: boolean
}

export const getInteractivity = (
  args: ParsedArgs,
  { canPrompt = true }: GetInteractivityOptions = {},
): Interactivity => {
  const isNonInteractive =
    args['non_interactive'] === true || args['y'] === true
  const isInteractive = args['interactive'] === true || args['i'] === true

  if (isNonInteractive && isInteractive) {
    throw new Error(
      'The --interactive and --non-interactive flags cannot be used together',
    )
  }
  if (isNonInteractive) return 'non-interactive'
  // An explicit --interactive still asks, and fails loudly if it cannot.
  if (isInteractive) return 'interactive'
  if (!canPrompt) return 'non-interactive'
  return 'auto'
}

/**
 * Render a parameter name as the argument used to set it,
 * e.g., `device_id` as `--device-id`.
 */
export const toArgName = (parameterName: string): string =>
  `--${parameterName.replace(/_/g, '-')}`

/**
 * Read an argument key as the parameter it names, e.g., `--page-cursor`,
 * `--page_cursor`, and `--PAGE-CURSOR` all name `page_cursor`.
 */
export const toParameterName = (argKey: string): string =>
  argKey.toLowerCase().replace(/-/g, '_')

/**
 * Render an argument key as the argument it was given as, naming a one letter
 * key as the short form it can only have been written as, e.g., `-n`.
 */
export const toGivenArgName = (argKey: string): string =>
  argKey.length === 1 ? `-${argKey}` : toArgName(argKey)
