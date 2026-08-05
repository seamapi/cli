import type { Command } from 'lib/commands/registry.js'

/**
 * Run the Seam setup wizard.
 *
 * Intercepted by the entry before argument parsing so the wizard owns its
 * own argv; the registered executor covers selecting it interactively.
 */
export const runWizard = async (argv: string[]): Promise<void> => {
  const { default: wizard } = await import('@seamapi/wizard')
  await wizard({
    argv,
    commandName: 'seam wizard',
  })
}

export const wizardCommand: Command = {
  definition: {
    path: ['wizard'],
    kind: 'cli',
    title: 'Set up Seam in the current project.',
    description:
      'Takes a project from zero to a working Seam integration. Run seam wizard --help for its own options.',
    flags: [],
  },
  requiresAuth: false,
  execute: async () => {
    await runWizard([])
    return { kind: 'done' }
  },
}
