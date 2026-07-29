import parseArgs, { type ParsedArgs } from 'minimist'

/**
 * Argument keys that disable interactive prompts.
 *
 * `-y` is the original spelling and is kept as an alias of `--non-interactive`.
 */
export const nonInteractiveFlags = ['non_interactive', 'n', 'y']

export const parseCliArgs = (argv: string[]): ParsedArgs =>
  parseArgs(argv, {
    string: ['code'],
    boolean: ['non-interactive', 'y'],
    alias: { 'non-interactive': 'n' },
  })

/**
 * Whether or not to prompt for missing parameters,
 * as opposed to auto-selecting the first option.
 */
export const isInteractive = (args: ParsedArgs): boolean =>
  !nonInteractiveFlags.some((flag) => args[flag] === true)
