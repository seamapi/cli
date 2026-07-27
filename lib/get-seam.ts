import {
  SeamHttp,
  SeamHttpWithoutWorkspace,
  isConsoleSessionToken,
  isPersonalAccessToken,
} from "@seamapi/http/connect"
import { getConfigStore } from "./get-config-store"
import { getServer } from "./get-server"

export const getSeam = async (): Promise<SeamHttp> => {
  const config = getConfigStore()

  const token = config.get(`${getServer()}.pat`)

  const workspaceId = config.get("current_workspace_id")

  const options = { endpoint: getServer() }

  if (isPersonalAccessToken(token)) {
    return SeamHttp.fromPersonalAccessToken(token, workspaceId, options)
  }

  if (isConsoleSessionToken(token)) {
    return SeamHttp.fromConsoleSessionToken(token, workspaceId, options)
  }

  return SeamHttp.fromApiKey(token, options)
}

export const getSeamMultiWorkspace = async (): Promise<
  SeamHttpWithoutWorkspace | SeamHttp
> => {
  const config = getConfigStore()
  const token = config.get(`${getServer()}.pat`)
  const options = { endpoint: getServer() }

  if (isPersonalAccessToken(token)) {
    return SeamHttpWithoutWorkspace.fromPersonalAccessToken(token, options)
  }

  return getSeam()
}
