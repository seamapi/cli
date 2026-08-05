import { RequestSeamApi } from '../../http/request.js'
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
  execute: async () => {
    await RequestSeamApi({
      path: '/health/get_health',
      params: {},
    })
    return { kind: 'done' }
  },
}
