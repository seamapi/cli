import {
  isConsoleSessionToken,
  isPersonalAccessToken,
  SeamHttp,
  SeamHttpWithoutWorkspace,
} from '@seamapi/http/connect'

import { getConfigStore } from './config/index.js'
import { getServer } from './get-server.js'

export const getSeam = async (): Promise<SeamHttp> => {
  const config = getConfigStore()

  const token = config.get(`${getServer()}.pat`) as string

  const workspaceId = config.get('current_workspace_id') as string

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
  const token = config.get(`${getServer()}.pat`) as string
  const options = { endpoint: getServer() }

  if (isPersonalAccessToken(token)) {
    return SeamHttpWithoutWorkspace.fromPersonalAccessToken(token, options)
  }

  return getSeam()
}
