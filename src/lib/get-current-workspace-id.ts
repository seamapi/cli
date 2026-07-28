import { getConfigStore } from './get-config-store.js'
import { interactForWorkspaceId } from './interact-for-workspace-id.js'

export const getCurrentWorkspaceId = async (): Promise<string> => {
  const configStore = getConfigStore()

  const currentWorkspaceId = configStore.get('current_workspace_id')
  if (typeof currentWorkspaceId === 'string') return currentWorkspaceId

  return await interactForWorkspaceId()
}
