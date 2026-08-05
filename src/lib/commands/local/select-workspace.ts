import { assertMutable } from '../../auth/operations.js'
import { NonInteractiveError } from '../../errors.js'
import { interactForWorkspaceId } from '../../interact/interact-for-workspace-id.js'
import type { Command } from '../registry.js'

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
