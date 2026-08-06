import { assertMutable, selectServer } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { stringFlag } from 'lib/commands/spec.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForServerSelection } from 'lib/interactions/index.js'

export const selectServerCommand: Command = {
  definition: {
    path: ['select', 'server'],
    kind: 'cli',
    title: 'Select the Seam API server.',
    description: '',
    flags: [stringFlag('server', 'Seam API server to select.')],
  },
  requiresAuth: false,
  execute: async ({ args }, ctx) => {
    assertMutable(ctx.auth, 'server', 'select a server')
    if (args['server']) {
      selectServer(args['server'], ctx.config)
      return { kind: 'done' }
    }
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Missing required parameter for select server: --server',
      )
    }
    await interactForServerSelection()
    return { kind: 'done' }
  },
}
