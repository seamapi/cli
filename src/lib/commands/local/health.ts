import type { Command } from 'lib/commands/registry.js'
import { requestSeamApi } from 'lib/http/request.js'

export const healthCommand: Command = {
  definition: {
    path: ['health', 'get-health'],
    // Handled by the CLI itself, but calls the Seam API.
    kind: 'api',
    title: 'Report the health of the Seam API.',
    description: '',
    flags: [],
  },
  requiresAuth: true,
  execute: async (_invocation, ctx) => {
    const api = await ctx.api()
    await requestSeamApi(
      { path: '/health/get_health', params: {} },
      { api, output: ctx.output },
    )
    return { kind: 'done' }
  },
}
