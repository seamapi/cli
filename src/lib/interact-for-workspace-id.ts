import { getConfigStore } from "./get-config-store"
import prompts from "prompts"
import { SeamHttpWithoutWorkspace } from "@seamapi/http/connect"
import { getSeamMultiWorkspace } from "./get-seam"
import { getServer } from "./get-server"
import { withLoading } from "./util/with-loading"

export const interactForWorkspaceId = async (personalAccessToken?: string) => {
  const config = getConfigStore()
  const seam = personalAccessToken
    ? SeamHttpWithoutWorkspace.fromPersonalAccessToken(personalAccessToken, {
        endpoint: getServer(),
      })
    : await getSeamMultiWorkspace()

  const workspaces = await withLoading("Fetching workspaces...", () =>
    seam.workspaces.list()
  )
  const { workspaceId } = await prompts({
    name: "workspaceId",
    type: "select",
    message: "Select a workspace:",
    choices: workspaces.map((workspace: any) => ({
      title: workspace.name,
      value: workspace.workspace_id,
      description: workspace.workspace_id,
    })),
  })

  if (workspaceId) {
    config.set("current_workspace_id", workspaceId)
    return workspaceId
  }

  throw new Error("Bailed")
}
