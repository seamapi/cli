import { SeamHttpWithoutWorkspace } from '@seamapi/http/connect'

import { getConfigStore } from './config/index.js'
import { getSeamMultiWorkspace } from './get-seam.js'
import { getServer } from './get-server.js'
import { promptSelect } from './util/prompt.js'
import { withLoading } from './util/with-loading.js'

export const interactForWorkspaceId = async (personalAccessToken?: string) => {
  const config = getConfigStore()
  const seam = personalAccessToken
    ? SeamHttpWithoutWorkspace.fromPersonalAccessToken(personalAccessToken, {
        endpoint: getServer(),
      })
    : await getSeamMultiWorkspace()

  const workspaces = await withLoading('Fetching workspaces...', () =>
    seam.workspaces.list(),
  )
  const workspaceId = await promptSelect<string>({
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
