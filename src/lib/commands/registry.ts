import type { ParsedArgs } from 'minimist'

import { toParameterName } from 'lib/args/parse.js'
import type { ApiBlueprint } from 'lib/blueprint/index.js'
import type { CliContext } from 'lib/context.js'

import { executeApiCommand } from './api-command.js'
import { createCompletionCommands } from './local/completion.js'
import { configRevealLocationCommand } from './local/config-reveal-location.js'
import { configUseRemoteSchemaCommand } from './local/config-use-remote-schema.js'
import { healthCommand } from './local/health.js'
import { loginCommand } from './local/login.js'
import { logoutCommand } from './local/logout.js'
import { selectEndpointCommand } from './local/select-endpoint.js'
import { selectWorkspaceCommand } from './local/select-workspace.js'
import { wizardCommand } from './local/wizard.js'
import {
  type CommandDefinition,
  type CommandSpec,
  getCommandSpec,
  isSamePath,
} from './spec.js'

/**
 * One invocable command: what it looks like to help, completion, and the
 * interactive picker, whether it needs a login, and how to run it. Declaring
 * the metadata and the executor together is what keeps them from drifting.
 */
export interface Command {
  definition: CommandDefinition
  /** Whether the command needs a token before it can do anything. */
  requiresAuth: boolean
  /** Kept out of the spec, so out of help, completion, and the picker. */
  hidden?: boolean
  execute: (invocation: Invocation, ctx: CliContext) => Promise<CommandResult>
}

/** Everything a single run of a command was given. */
export interface Invocation {
  path: string[]
  /** The value written after the command path, when the command takes one. */
  positional?: string | undefined
  /** Params given as arguments, held to what the command accepts. */
  argParams: Record<string, unknown>
  /** Params piped in as JSON, passed through as given. */
  stdinParams: Record<string, unknown>
  /** The full parsed arguments, for commands that read their own flags. */
  args: ParsedArgs
  /** The raw argv, for commands that re-read arguments with their own types. */
  argv: string[]
}

export type CommandResult =
  | { kind: 'done' }
  /** Navigate back to selecting a command under `toPath`. */
  | { kind: 'back'; toPath: string[] }

export interface CommandRegistry {
  /** The spec help, completion, and the interactive picker render. */
  spec: CommandSpec
  find: (path: string[]) => Command | undefined
}

/**
 * Commands handled by the CLI itself, which have no endpoint in the
 * blueprint. The single source of truth: the spec, the picker, and the
 * dispatcher all consume this list.
 */
const completionCommands = createCompletionCommands(
  (blueprint) => buildRegistry(blueprint).spec,
)

export const localCommands: Command[] = [
  ...completionCommands,
  configRevealLocationCommand,
  configUseRemoteSchemaCommand,
  healthCommand,
  loginCommand,
  logoutCommand,
  selectEndpointCommand,
  selectWorkspaceCommand,
  wizardCommand,
]

/** Definitions shown in help, completion, and the picker. */
export const localCommandDefinitions: CommandDefinition[] = localCommands
  .filter((command) => command.hidden !== true)
  .map((command) => command.definition)

/**
 * The local command going by a path, or `undefined` when the path is an
 * endpoint or no command at all. Needs no blueprint, so the entry may check
 * commands before any definitions are loaded.
 */
export const findLocalCommand = (path: string[]): Command | undefined =>
  localCommands.find((command) => isSamePath(command.definition.path, path))

/**
 * The local command the given words invoke with a value after its path, e.g.,
 * `select endpoint` for `select endpoint https://connect.getseam.com`, or
 * `undefined` when the words are not a command taking one.
 *
 * Only commands declaring a positional match, so a stray word after any other
 * command stays what it has always been: no command at all.
 */
export const findLocalCommandTakingPositional = (
  words: string[],
): Command | undefined =>
  localCommands.find(
    ({ definition }) =>
      definition.positional != null &&
      words.length === definition.path.length + 1 &&
      isSamePath(definition.path, words.slice(0, -1)),
  )

/** Parameter names a command accepts as arguments. */
export const acceptedParamsOf = (definition: CommandDefinition): Set<string> =>
  new Set(
    definition.flags.flatMap(({ long }) =>
      long == null ? [] : [toParameterName(long)],
    ),
  )

export const buildRegistry = (blueprint: ApiBlueprint): CommandRegistry => {
  const spec = getCommandSpec(blueprint, localCommandDefinitions)

  const commands = new Map<string, Command>()
  for (const definition of spec.commands) {
    commands.set(definition.path.join(' '), {
      definition,
      requiresAuth: true,
      execute: executeApiCommand,
    })
  }
  // Local commands win over a same-named endpoint, as the spec's dedupe does,
  // and hidden ones are findable without being in the spec.
  for (const command of localCommands) {
    commands.set(command.definition.path.join(' '), command)
  }

  return {
    spec,
    find: (path) => commands.get(path.join(' ')),
  }
}
