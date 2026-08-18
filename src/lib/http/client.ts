import {
  isConsoleSessionToken,
  isPersonalAccessToken,
  SeamHttp,
  SeamHttpWithoutWorkspace,
} from '@seamapi/http'

import { type AuthContext, resolveAuth } from 'lib/context.js'
import { tokenEnvVar, workspaceIdEnvVar } from 'lib/env.js'

export const getSeam = async (
  auth: AuthContext = resolveAuth(),
): Promise<SeamHttp> => {
  const token = getRequiredToken(auth)

  const options = { endpoint: auth.endpoint }

  if (isPersonalAccessToken(token)) {
    return SeamHttp.fromPersonalAccessToken(
      token,
      getRequiredWorkspaceId(auth),
      options,
    )
  }

  if (isConsoleSessionToken(token)) {
    return SeamHttp.fromConsoleSessionToken(
      token,
      getRequiredWorkspaceId(auth),
      options,
    )
  }

  return SeamHttp.fromApiKey(token, options)
}

export const getSeamMultiWorkspace = async (
  auth: AuthContext = resolveAuth(),
): Promise<SeamHttpWithoutWorkspace | SeamHttp> => {
  const token = getRequiredToken(auth)
  const options = { endpoint: auth.endpoint }

  if (isPersonalAccessToken(token)) {
    return SeamHttpWithoutWorkspace.fromPersonalAccessToken(token, options)
  }

  return await getSeam(auth)
}

const getRequiredToken = (auth: AuthContext): string => {
  const { token } = auth

  if (token == null) {
    throw new Error(
      `Not logged in: run "seam login" or set the ${tokenEnvVar} environment variable`,
    )
  }

  return token
}

const getRequiredWorkspaceId = (auth: AuthContext): string => {
  const { workspaceId } = auth

  if (workspaceId == null) {
    throw new Error(
      `No workspace selected: run "seam select workspace" or set the ${workspaceIdEnvVar} environment variable`,
    )
  }

  return workspaceId
}
