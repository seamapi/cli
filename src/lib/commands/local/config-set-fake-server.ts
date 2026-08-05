import { selectFakeServer } from 'lib/auth/operations.js'
import type { Command } from 'lib/commands/registry.js'

/** Hidden: a development shortcut, kept out of help and completion. */
export const configSetFakeServerCommand: Command = {
  definition: {
    path: ['config', 'set', 'fake-server'],
    kind: 'cli',
    title: 'Point the CLI at a fake Seam Connect server.',
    description: '',
    flags: [],
  },
  requiresAuth: false,
  hidden: true,
  execute: async (_invocation, ctx) => {
    const { server } = selectFakeServer({ config: ctx.config })
    ctx.output.info(`Server URL set to ${server}`)
    ctx.output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return { kind: 'done' }
  },
}
