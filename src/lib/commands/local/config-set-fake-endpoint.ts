import { selectFakeEndpoint } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'

/** Hidden: a development shortcut, kept out of help and completion. */
export const configSetFakeEndpointCommand: Command = {
  definition: {
    path: ['config', 'set', 'fake-endpoint'],
    kind: 'cli',
    title: 'Point the CLI at a fake Seam Connect endpoint.',
    description: '',
    flags: [],
  },
  requiresAuth: false,
  hidden: true,
  execute: async (_invocation, ctx) => {
    const { endpoint } = selectFakeEndpoint({ config: ctx.config })
    ctx.output.info(`Endpoint URL set to ${endpoint}`)
    ctx.output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return { kind: 'done' }
  },
}
