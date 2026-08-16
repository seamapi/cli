import { join } from 'node:path'

import { isApiKey } from '@seamapi/http'
import type {
  default as wizard,
  StorageAdapter,
  WizardAdapter,
  WizardAuth,
} from '@seamapi/wizard'
import Configstore from 'configstore'

import type { Command } from 'lib/commands/registry.js'
import { type CliConfig, getConfig, rootPaths } from 'lib/config/index.js'
import { resolveAuth } from 'lib/context.js'
import { UsageError } from 'lib/errors.js'

/**
 * Run the Seam setup wizard.
 *
 * Intercepted by the entry before argument parsing so the wizard owns its
 * own argv; the registered executor covers selecting it interactively.
 */
type Wizard = typeof wizard
type WizardModule = { default: Wizard }
type LoadWizard = () => Promise<WizardModule>

const loadWizard: LoadWizard = async () => await import('@seamapi/wizard')

export const runWizard = async (
  argv: string[],
  load: LoadWizard = loadWizard,
): Promise<void> => {
  let wizard: Wizard
  try {
    const module = await load()
    wizard = module.default
  } catch (error) {
    if (isMissingWizard(error)) {
      throw new UsageError(
        [
          'The Seam Wizard is not available in this installation.',
          '',
          'This is most likely because the packaging source does not allow software that includes dependencies with non-commercial licenses, including the Claude SDK used by the Wizard.',
          '',
          'To use the Wizard, install the Seam CLI from npm:',
          '',
          '  npm i -g seam',
        ].join('\n'),
      )
    }
    throw error
  }

  await wizard({
    argv,
    commandName: 'seam wizard',
    adapter: createWizardAdapter(),
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

const isMissingWizard = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' ||
    error.code === 'MODULE_NOT_FOUND') &&
  error.message.includes("'@seamapi/wizard'")

const wizardFileName = 'wizard.json'

export const createWizardAdapter = ({
  cliConfig = getConfig(),
  configPath = join(rootPaths.config, wizardFileName),
  statePath = join(rootPaths.log, wizardFileName),
}: {
  cliConfig?: CliConfig
  configPath?: string
  statePath?: string
} = {}): WizardAdapter => ({
  getAuth: async () => toWizardAuth(cliConfig),
  config: createStorage(configPath),
  state: createStorage(statePath),
})

// Only a workspace-scoped key may go in a project, so a personal access
// token is not handed over at all.
const toWizardAuth = (cliConfig: CliConfig): WizardAuth => {
  const { endpoint, token, workspaceId } = resolveAuth(cliConfig)

  return {
    endpoint,
    apiKey: token != null && isApiKey(token) ? token : null,
    workspaceId,
  }
}

const createStorage = (path: string): StorageAdapter => {
  const store = new Configstore('seam-cli', undefined, { configPath: path })

  return {
    get: async (key) => store.get(key),
    set: async (key, value) => {
      store.set(key, value)
    },
  }
}
