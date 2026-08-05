import { NonInteractiveError } from '../../args/parse.js'
import { assertMutable, selectServer } from '../../auth/operations.js'
import { interactForServerSelection } from '../../interact/interact-for-server-selection.js'
import type { Command } from '../registry.js'
import { stringFlag } from '../spec.js'

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
