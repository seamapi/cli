import parseArgs, { type ParsedArgs } from 'minimist'

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
  'h',
  'help',
  'json',
  'remote_api_defs',
  'update',
  'version',
]

/**
 * Thrown when the CLI needs input it cannot prompt for.
 */
export class NonInteractiveError extends Error {
  override name = 'NonInteractiveError'
}

export const parseCliArgs = (argv: string[]): ParsedArgs =>
  parseArgs(argv, {
    // A page cursor is opaque, so keep it exactly as given: read as a number
    // it would lose leading zeroes and turn exponent notation into a digit
    // string, naming a page the API never issued.
    string: ['code', 'page-cursor', 'page_cursor'],
    boolean: ['non-interactive', 'interactive', 'json'],
    // Deliberately not aliased to -n, which is reserved for a future
    // --dry-run flag.
    alias: { 'non-interactive': 'y', interactive: 'i' },
  })

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
