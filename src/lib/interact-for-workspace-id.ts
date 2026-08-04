import { SeamHttpWithoutWorkspace } from '@seamapi/http/connect'

import { getConfigStore } from './config/index.js'
import { getSeamMultiWorkspace } from './get-seam.js'
import { getServer } from './get-server.js'
import { prompt } from './util/prompt.js'
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
  const { workspaceId } = await prompt({
    name: 'workspaceId',
    type: 'select',
    message: 'Select a workspace:',
    choices: workspaces.map((workspace: any) => ({
      title: workspace.name,
      value: workspace.workspace_id,
      description: workspace.workspace_id,
    })),
  })

  if (workspaceId) {
    config.set('current_workspace_id', workspaceId)
    return workspaceId
  }

  throw new Error('Bailed')
}
