import { SeamHttpWithoutWorkspace } from '@seamapi/http/connect'

import { getConfigStore } from '../config/index.js'
import { resolveAuth } from '../context.js'
import {
  assertEnvVarUnset,
  getWorkspaceIdFromEnv,
  workspaceIdEnvVar,
} from '../env.js'
import { withLoading } from '../output/with-loading.js'
import { getSeamMultiWorkspace } from '../seam/client.js'
import { promptAutocomplete } from './prompt.js'

export const interactForWorkspaceId = async (personalAccessToken?: string) => {
  const config = getConfigStore()

  assertEnvVarUnset(
    workspaceIdEnvVar,
    getWorkspaceIdFromEnv(),
    'select a workspace',
  )

  const seam = personalAccessToken
    ? SeamHttpWithoutWorkspace.fromPersonalAccessToken(personalAccessToken, {
        endpoint: resolveAuth(config).server,
      })
    : await getSeamMultiWorkspace()

  const workspaces = await withLoading('Fetching workspaces...', () =>
    seam.workspaces.list(),
  )
  // Searchable, as selecting a device or a command is: an account may have
  // more workspaces than fit on a screen.
  const workspaceId = await promptAutocomplete<string>({
    message: 'Select a workspace:',
    choices: workspaces.map((workspace: any) => ({
      label: workspace.name,
      value: workspace.workspace_id,
      hint: workspace.workspace_id,
    })),
  })

  config.set('current_workspace_id', workspaceId)
  return workspaceId
}
