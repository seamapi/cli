import { logout } from '../../auth/operations.js'
import type { Command } from '../registry.js'

export const logoutCommand: Command = {
  definition: {
    path: ['logout'],
    kind: 'cli',
    title: 'Log out of Seam.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    logout(ctx.config)
    ctx.output.info('Logged out!')
    return { kind: 'done' }
  },
}
