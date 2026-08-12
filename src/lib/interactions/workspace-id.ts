import { SeamHttpWithoutWorkspace } from '@seamapi/http/connect'

import { assertMutable, selectWorkspace } from 'lib/auth/operations.js'
import { getConfig } from 'lib/config/index.js'
import { resolveAuth } from 'lib/context.js'
import { getSeamMultiWorkspace } from 'lib/http/client.js'
import { withLoading } from 'lib/output/with-loading.js'
import { promptAutocomplete } from 'lib/prompt.js'

export const interactForWorkspaceId = async (personalAccessToken?: string) => {
  const config = getConfig()

  // Refuse before prompting: nothing selected here could be stored.
  assertMutable(resolveAuth(config), 'workspaceId', 'select a workspace')

  const seam = personalAccessToken
    ? SeamHttpWithoutWorkspace.fromPersonalAccessToken(personalAccessToken, {
        endpoint: resolveAuth(config).endpoint,
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

  selectWorkspace(workspaceId, config)
  return workspaceId
}
