import type { Parameter } from '@seamapi/blueprint'

import type { CommandDefinition } from 'lib/commands/spec.js'
import { NonInteractiveError, UsageError } from 'lib/errors.js'
import type { AuthOverrides } from 'lib/overrides.js'

import { toArgName, toGivenArgName } from './parse.js'

/**
 * Report every required parameter still missing from the params, rather
 * than prompting for it.
 *
 * @param target What the params are for, e.g., `/devices/list`.
 */
export const assertRequiredParams = (
  parameters: Parameter[],
  params: Record<string, unknown>,
  target: string,
): void => {
  // A required parameter is satisfied by being present, not by being
  // truthy: `false`, `0` and `''` are values a caller can supply.
  const missing = parameters
    .filter((parameter) => parameter.isRequired)
    .map((parameter) => parameter.name)
    .filter((name) => params[name] === undefined)

  if (missing.length === 0) return

  throw new NonInteractiveError(
    `Missing required ${
      missing.length === 1 ? 'parameter' : 'parameters'
    } for ${target}: ${missing.map(toArgName).join(' ')}`,
  )
}

/**
 * Report any argument the command does not accept, rather than acting on it.
 * An unrecognized argument is a mistake: forwarded to the API it would fail
 * somewhere less obvious or be quietly ignored, and on a command the CLI
 * handles itself it would go nowhere at all.
 *
 * Only arguments are checked. Params read from stdin are passed through as
 * given, so a caller may send whatever the API itself accepts.
 */
/**
 * Refuse the auth overrides on a command that selects what they override.
 *
 * `--endpoint` and `--workspace-id` scope one command and are never stored,
 * so on `seam select ...` they would read as the value to store and quietly
 * do nothing of the kind. The positional is what stores.
 */
export const assertNoAuthOverrides = (
  { path, positional }: CommandDefinition,
  overrides: AuthOverrides,
): void => {
  if (path[0] !== 'select') return

  const given = [
    overrides.endpoint == null ? null : '--endpoint',
    overrides.workspaceId == null ? null : '--workspace-id',
  ].filter((flag) => flag != null)

  if (given.length === 0) return

  const command = `seam ${path.join(' ')}`

  throw new UsageError(
    `${given.join(' and ')} cannot be used with ${command}: ${
      given.length === 1 ? 'it overrides' : 'they override'
    } a single command rather than changing what is selected.`,
    {
      hint:
        positional == null
          ? `Run '${command}' to change what is selected.`
          : `Run '${command} <${positional.name}>' to change what is selected.`,
    },
  )
}

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
