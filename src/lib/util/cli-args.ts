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
 * Thrown when the CLI needs input it cannot prompt for.
 */
export class NonInteractiveError extends Error {
  override name = 'NonInteractiveError'
}

export const parseCliArgs = (argv: string[]): ParsedArgs =>
  parseArgs(argv, {
    string: ['code'],
    boolean: ['non-interactive', 'interactive'],
    // Deliberately not aliased to -n, which is reserved for a future
    // --dry-run flag.
    alias: { 'non-interactive': 'y', interactive: 'i' },
  })

export const getInteractivity = (args: ParsedArgs): Interactivity => {
  // Prefer the flag that cannot hang when both are given.
  if (args['non_interactive'] === true || args['y'] === true) {
    return 'non-interactive'
  }
  if (args['interactive'] === true || args['i'] === true) return 'interactive'
  return 'auto'
}

/**
 * Render a parameter name as the argument used to set it,
 * e.g., `device_id` as `--device-id`.
 */
export const toArgName = (parameterName: string): string =>
  `--${parameterName.replace(/_/g, '-')}`
