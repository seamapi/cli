import type { Command } from 'lib/commands/registry.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForUseRemoteApiDefs } from 'lib/interactions/use-remote-api-defs.js'

export const configUseRemoteApiDefsCommand: Command = {
  definition: {
    path: ['config', 'use-remote-api-defs'],
    kind: 'cli',
    title: 'Choose whether to use the API definitions served by Seam.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Cannot select whether to use remote API definitions in non-interactive mode',
      )
    }
    await interactForUseRemoteApiDefs()
    return { kind: 'done' }
  },
}
