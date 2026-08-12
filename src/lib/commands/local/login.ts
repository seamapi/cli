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
      'Prompts for a personal access token unless one is passed with --token. The token is stored for the selected endpoint, or for the one --endpoint names.',
    flags: [stringFlag('token', 'Personal access token to log in with.')],
  },
  requiresAuth: false,
  execute: async ({ args }, ctx) => {
    if (args['token']) {
      await login(String(args['token']).trim(), ctx.config)
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
