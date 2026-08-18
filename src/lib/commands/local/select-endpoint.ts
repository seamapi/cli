import { assertMutable, selectEndpoint } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForEndpointSelection } from 'lib/interactions/index.js'

export const selectEndpointCommand: Command = {
  definition: {
    path: ['select', 'endpoint'],
    kind: 'cli',
    title: 'Select the Seam API endpoint.',
    description:
      'Stores the endpoint every later command runs against. To use one for a single command instead, pass --endpoint to that command.',
    flags: [],
    positional: {
      name: 'url',
      description: 'Seam API endpoint to select.',
    },
  },
  requiresAuth: false,
  execute: async ({ positional }, ctx) => {
    assertMutable(ctx.auth, 'endpoint', 'select an endpoint')
    if (positional != null) {
      selectEndpoint(positional, ctx.config)
      return { kind: 'done' }
    }
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Missing required argument for select endpoint: <url>',
      )
    }
    await interactForEndpointSelection()
    return { kind: 'done' }
  },
}
