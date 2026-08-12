import { assertMutable, selectEndpoint } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { stringFlag } from 'lib/commands/spec.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForEndpointSelection } from 'lib/interactions/index.js'

export const selectEndpointCommand: Command = {
  definition: {
    path: ['select', 'endpoint'],
    kind: 'cli',
    title: 'Select the Seam API endpoint.',
    description: '',
    flags: [stringFlag('endpoint', 'Seam API endpoint to select.')],
  },
  requiresAuth: false,
  execute: async ({ args }, ctx) => {
    assertMutable(ctx.auth, 'endpoint', 'select an endpoint')
    if (args['endpoint']) {
      selectEndpoint(args['endpoint'], ctx.config)
      return { kind: 'done' }
    }
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Missing required parameter for select endpoint: --endpoint',
      )
    }
    await interactForEndpointSelection()
    return { kind: 'done' }
  },
}
