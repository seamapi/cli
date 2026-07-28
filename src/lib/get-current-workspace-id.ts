import { getConfigStore } from "./get-config-store"
import { interactForWorkspaceId } from "./interact-for-workspace-id"

export const getCurrentWorkspaceId = async () => {
  const configStore = getConfigStore()

  const currentWorkspaceId = configStore.get("current_workspace_id")
  if (currentWorkspaceId) return currentWorkspaceId

  await interactForWorkspaceId()
}
