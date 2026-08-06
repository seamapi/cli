import type { OutputFormat } from './output.js'

export interface ResolveOutputFormatOptions {
  /** Whether stdout is a terminal. */
  isTty?: boolean
}

/**
 * Whether to write machine readable output.
 *
 * An explicit `--json` or `--no-json` wins, otherwise the CLI writes JSON
 * whenever stdout is piped or redirected, and pretty output at a terminal.
 *
 * This reads the arguments rather than the parsed args because `--json` is
 * declared as a boolean flag, so that it never consumes the argument after
 * it, and a boolean cannot tell `--no-json` apart from not passing anything.
 */
export const resolveOutputFormat = (
  argv: string[],
  { isTty = false }: ResolveOutputFormatOptions = {},
): OutputFormat => {
  const flag = argv.filter((arg) => arg === '--json' || arg === '--no-json')

  // The last one wins, matching how the argument parser resolves repeats.
  switch (flag[flag.length - 1]) {
    case '--json':
      return 'json'
    case '--no-json':
      return 'text'
    default:
      return isTty ? 'text' : 'json'
  }
}
