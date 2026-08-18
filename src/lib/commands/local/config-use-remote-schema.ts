import type { Command } from 'lib/commands/registry.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForUseRemoteSchema } from 'lib/interactions/index.js'

export const configUseRemoteSchemaCommand: Command = {
  definition: {
    path: ['config', 'use-remote-schema'],
    kind: 'cli',
    title: 'Choose whether to use the schema served by Seam.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Cannot select whether to use the remote schema in non-interactive mode',
      )
    }
    await interactForUseRemoteSchema()
    return { kind: 'done' }
  },
}
