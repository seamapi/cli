import { toGivenArgName, UsageError } from './parse.js'

/**
 * Report any argument the command does not accept, rather than acting on it.
 * An unrecognized argument is a mistake: forwarded to the API it would fail
 * somewhere less obvious or be quietly ignored, and on a command the CLI
 * handles itself it would go nowhere at all.
 *
 * Only arguments are checked. Params read from stdin are passed through as
 * given, so a caller may send whatever the API itself accepts.
 */
export const assertKnownArgs = (
  argParams: Record<string, unknown>,
  command: string[],
  {
    accepted,
    isLocal,
  }: {
    /** Parameter names the command accepts. */
    accepted: Set<string>
    /** Whether the CLI handles the command itself. */
    isLocal: boolean
  },
): void => {
  const unknown = Object.keys(argParams).filter((key) => !accepted.has(key))
  if (unknown.length === 0) return

  // Name an endpoint command by its path, as missing params are named, and a
  // command the CLI handles itself by the words that run it.
  const target = isLocal
    ? command.join(' ')
    : `/${command.join('/').replace(/-/g, '_')}`

  throw new UsageError(
    `Unknown ${
      unknown.length === 1 ? 'parameter' : 'parameters'
    } for ${target}: ${unknown.map(toGivenArgName).join(' ')}`,
    {
      hint: `Run 'seam ${command.join(' ')} --help' to see what it accepts.`,
    },
  )
}
