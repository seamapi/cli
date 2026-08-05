import { assertMutable } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForWorkspaceId } from 'lib/interactions/index.js'

export const selectWorkspaceCommand: Command = {
  definition: {
    path: ['select', 'workspace'],
    kind: 'cli',
    title: 'Select the current workspace.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    assertMutable(ctx.auth, 'workspaceId', 'select a workspace')
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Cannot select a workspace in non-interactive mode: pass --workspace-id to "seam login"',
      )
    }
    await interactForWorkspaceId()
    return { kind: 'done' }
  },
}
