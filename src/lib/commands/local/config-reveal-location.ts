import type { Command } from 'lib/commands/registry.js'

export const configRevealLocationCommand: Command = {
  definition: {
    path: ['config', 'reveal-location'],
    kind: 'cli',
    title: 'Print the path to the CLI configuration file.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    ctx.output.text(ctx.config.path)
    return { kind: 'done' }
  },
}
