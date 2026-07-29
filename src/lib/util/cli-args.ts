import parseArgs, { type ParsedArgs } from 'minimist'

/**
 * How the CLI should behave when it needs input that was not given as an
 * argument.
 *
 * - `interactive`: prompt for it. This is the default.
 * - `auto-submit`: skip the parameter prompt when everything required
 *   was already given, otherwise prompt. Selected with `--yes` or `-y`.
 * - `non-interactive`: never prompt: missing input is an error.
 *   Selected with `--non-interactive` or `-n`.
 */
export type Interactivity = 'interactive' | 'auto-submit' | 'non-interactive'

/**
 * Argument keys that affect interactivity
 * and are therefore not command parameters.
 */
export const interactivityFlags = ['non_interactive', 'n', 'yes', 'y']

/**
 * Thrown when the CLI needs input it cannot prompt for.
 */
export class NonInteractiveError extends Error {
  override name = 'NonInteractiveError'
}

export const parseCliArgs = (argv: string[]): ParsedArgs =>
  parseArgs(argv, {
    string: ['code'],
    boolean: ['non-interactive', 'yes'],
    alias: { 'non-interactive': 'n', yes: 'y' },
  })

export const getInteractivity = (args: ParsedArgs): Interactivity => {
  if (args['non_interactive'] === true || args['n'] === true) {
    return 'non-interactive'
  }
  if (args['yes'] === true || args['y'] === true) return 'auto-submit'
  return 'interactive'
}

/**
 * Render a parameter name as the argument used to set it,
 * e.g., `device_id` as `--device-id`.
 */
export const toArgName = (parameterName: string): string =>
  `--${parameterName.replace(/_/g, '-')}`
