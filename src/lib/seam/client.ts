import {
  isConsoleSessionToken,
  isPersonalAccessToken,
  SeamHttp,
  SeamHttpWithoutWorkspace,
} from '@seamapi/http/connect'

import { tokenEnvVar, workspaceIdEnvVar } from '../env.js'
import { getToken, getWorkspaceId } from '../get-credentials.js'
import { getServer } from '../get-server.js'

export const getSeam = async (): Promise<SeamHttp> => {
  const token = getRequiredToken()

  const options = { endpoint: getServer() }

  if (isPersonalAccessToken(token)) {
    return SeamHttp.fromPersonalAccessToken(
      token,
      getRequiredWorkspaceId(),
      options,
    )
  }

  if (isConsoleSessionToken(token)) {
    return SeamHttp.fromConsoleSessionToken(
      token,
      getRequiredWorkspaceId(),
      options,
    )
  }

  return SeamHttp.fromApiKey(token, options)
}

export const getSeamMultiWorkspace = async (): Promise<
  SeamHttpWithoutWorkspace | SeamHttp
> => {
  const token = getRequiredToken()
  const options = { endpoint: getServer() }

  if (isPersonalAccessToken(token)) {
    return SeamHttpWithoutWorkspace.fromPersonalAccessToken(token, options)
  }

  return await getSeam()
}

const getRequiredToken = (): string => {
  const token = getToken()

  if (token == null) {
    throw new Error(
      `Not logged in: run "seam login" or set the ${tokenEnvVar} environment variable`,
    )
  }

  return token
}

const getRequiredWorkspaceId = (): string => {
  const workspaceId = getWorkspaceId()

  if (workspaceId == null) {
    throw new Error(
      `No workspace selected: run "seam select workspace" or set the ${workspaceIdEnvVar} environment variable`,
    )
  }

  return workspaceId
}
