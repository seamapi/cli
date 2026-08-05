import { requestSeamApi } from '../../http/request.js'
import type { Command } from '../registry.js'

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
    await requestSeamApi(
      { path: '/health/get_health', params: {} },
      { api: await ctx.api(), output: ctx.output },
    )
    return { kind: 'done' }
  },
}
