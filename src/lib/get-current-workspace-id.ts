import { getWorkspaceId } from './get-credentials.js'
import { interactForWorkspaceId } from './interact-for-workspace-id.js'

export const getCurrentWorkspaceId = async (): Promise<string> => {
  const currentWorkspaceId = getWorkspaceId()
  if (currentWorkspaceId != null) return currentWorkspaceId

  return await interactForWorkspaceId()
}
