import type { ApiBlueprint } from 'lib/blueprint/index.js'
import type { Command } from 'lib/commands/registry.js'
import type { CommandSpec } from 'lib/commands/spec.js'
import { getOutput } from 'lib/output/get-output.js'
import {
  type CompletionShell,
  renderCompletion,
} from 'lib/render/completion/index.js'

/**
 * Print the completion script for a shell.
 *
 * Completions always come from the cached API definitions so that they can
 * be generated without logging in. They may lag the definitions served by
 * Seam when config use-remote-api-defs is enabled.
 *
 * Called by the entry before any auth or blueprint context exists, and by
 * the registered command's executor — one implementation for both.
 */
export const printCompletion = (
  shell: CompletionShell,
  spec: CommandSpec,
): void => {
  getOutput().text(renderCompletion(shell, spec))
}

type BuildSpec = (blueprint: ApiBlueprint) => CommandSpec

const completionCommand = (
  shell: CompletionShell,
  buildSpec: BuildSpec,
): Command => ({
  definition: {
    path: ['completion', shell],
    kind: 'cli',
    title: `Print the ${shell} completion script.`,
    description: '',
    flags: [],
  },
  requiresAuth: false,
  execute: async (_invocation, ctx) => {
    printCompletion(shell, buildSpec(ctx.blueprint))
    return { kind: 'done' }
  },
})

export const createCompletionCommands = (buildSpec: BuildSpec): Command[] => [
  completionCommand('bash', buildSpec),
  completionCommand('fish', buildSpec),
  completionCommand('zsh', buildSpec),
]
