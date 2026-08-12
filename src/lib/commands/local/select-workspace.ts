import { assertMutable, selectWorkspace } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'
import { NonInteractiveError } from 'lib/errors.js'
import { interactForWorkspaceId } from 'lib/interactions/index.js'

export const selectWorkspaceCommand: Command = {
  definition: {
    path: ['select', 'workspace'],
    kind: 'cli',
    title: 'Select the current workspace.',
    description:
      'Stores the workspace every later command runs against. To use one for a single command instead, pass --workspace-id to that command.',
    flags: [],
    positional: {
      name: 'workspace-id',
      description: 'Workspace to select.',
    },
  },
  requiresAuth: true,
  execute: async ({ positional }, ctx) => {
    assertMutable(ctx.auth, 'workspaceId', 'select a workspace')
    if (positional != null) {
      selectWorkspace(positional, ctx.config)
      return { kind: 'done' }
    }
    if (ctx.interactivity === 'non-interactive') {
      throw new NonInteractiveError(
        'Missing required argument for select workspace: <workspace-id>',
      )
    }
    await interactForWorkspaceId()
    return { kind: 'done' }
  },
}
