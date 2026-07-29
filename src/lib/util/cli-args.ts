import parseArgs, { type ParsedArgs } from 'minimist'

/**
 * Argument keys that disable interactive prompts
 * and are therefore not command parameters.
 */
export const nonInteractiveFlags = ['non_interactive', 'y']

/**
 * Thrown when the CLI needs input it cannot prompt for.
 */
export class NonInteractiveError extends Error {
  override name = 'NonInteractiveError'
}

export const parseCliArgs = (argv: string[]): ParsedArgs =>
  parseArgs(argv, {
    string: ['code'],
    boolean: ['non-interactive'],
    // Deliberately not aliased to -n, which is reserved for a future
    // --dry-run flag.
    alias: { 'non-interactive': 'y' },
  })

/**
 * Whether or not the CLI may prompt for input.
 *
 * When false, the command must be given in full:
 * anything missing is an error instead of a prompt.
 */
export const isInteractive = (args: ParsedArgs): boolean =>
  !nonInteractiveFlags.some((flag) => args[flag] === true)

/**
 * Render a parameter name as the argument used to set it,
 * e.g., `device_id` as `--device-id`.
 */
export const toArgName = (parameterName: string): string =>
  `--${parameterName.replace(/_/g, '-')}`
