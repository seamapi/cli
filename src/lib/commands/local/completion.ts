import type { ApiBlueprint } from 'lib/blueprint/index.js'
import type { Command } from 'lib/commands/registry.js'
import type { CommandSpec } from 'lib/commands/spec.js'
import { getOutput } from 'lib/output/get-output.js'
import {
  type CompletionShell,
  renderCompletion,
  renderCompletionStub,
} from 'lib/render/completion/index.js'

/**
 * Print the completion script for a shell.
 *
 * Completions always come from the cached API schema so that they can
 * be generated without logging in. They may lag the schema served by
 * Seam when config use-remote-schema is enabled.
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

/** Print the network-free loader installed in a shell completion directory. */
export const printCompletionLoader = (shell: CompletionShell): void => {
  getOutput().text(renderCompletionStub(shell))
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
    flags: [
      {
        long: 'loader',
        short: null,
        description:
          'Print the dynamic, network-free loader for installation by a package manager.',
        values: [],
        takesValue: false,
        isRequired: false,
      },
    ],
  },
  requiresAuth: false,
  execute: async (invocation, ctx) => {
    if (invocation.args['loader'] === true) {
      printCompletionLoader(shell)
    } else {
      printCompletion(shell, buildSpec(ctx.blueprint))
    }
    return { kind: 'done' }
  },
})

export const createCompletionCommands = (buildSpec: BuildSpec): Command[] => [
  completionCommand('bash', buildSpec),
  completionCommand('fish', buildSpec),
  completionCommand('zsh', buildSpec),
]
