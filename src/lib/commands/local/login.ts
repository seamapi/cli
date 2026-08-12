import { assertMutable, login } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { stringFlag } from 'lib/commands/spec.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForLogin } from 'lib/interactions/index.js'

export const loginCommand: Command = {
  definition: {
    path: ['login'],
    kind: 'cli',
    title: 'Log in to Seam.',
    description:
      'Prompts for a personal access token unless one is passed with --token.',
    flags: [
      stringFlag('endpoint', 'Seam API endpoint to log in to.'),
      stringFlag('token', 'Personal access token to log in with.'),
      stringFlag('workspace-id', 'Workspace to select after logging in.'),
    ],
  },
  requiresAuth: false,
  execute: async ({ args }, ctx) => {
    if (args['token'] || args['workspace_id'] || args['endpoint']) {
      await login(
        {
          endpoint: args['endpoint'] ? args['endpoint'] : undefined,
          token: args['token'] ? String(args['token']).trim() : undefined,
          workspaceId: args['workspace_id'] ? args['workspace_id'] : undefined,
        },
        ctx.config,
      )
      return { kind: 'done' }
    }
    assertMutable(ctx.auth, 'token', 'log in')
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Missing required parameter for login: --token',
      )
    }
    await interactForLogin()
    return { kind: 'done' }
  },
}
