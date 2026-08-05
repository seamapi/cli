import { getApiBlueprint } from '../../blueprint/index.js'
import { getOutput } from '../../output/get-output.js'
import {
  type CompletionShell,
  renderCompletion,
} from '../../render/completion/index.js'
import type { Command } from '../registry.js'

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
export const printCompletion = async (
  shell: CompletionShell,
  { update = false }: { update?: boolean } = {},
): Promise<void> => {
  // Deferred import: the registry lists this module's commands, so a static
  // import back into it would be a cycle.
  const { buildRegistry } = await import('../registry.js')
  const blueprint = await getApiBlueprint({ update })
  const { spec } = buildRegistry(blueprint)
  getOutput().text(renderCompletion(shell, spec))
}

const completionCommand = (shell: CompletionShell): Command => ({
  definition: {
    path: ['completion', shell],
    kind: 'cli',
    title: `Print the ${shell} completion script.`,
    description: '',
    flags: [],
  },
  requiresAuth: false,
  execute: async ({ args }) => {
    await printCompletion(shell, { update: args['update'] === true })
    return { kind: 'done' }
  },
})

export const completionCommands: Command[] = [
  completionCommand('bash'),
  completionCommand('fish'),
  completionCommand('zsh'),
]
