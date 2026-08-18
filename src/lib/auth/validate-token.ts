import {
  isApiKey,
  isPersonalAccessToken,
  SeamHttp,
  SeamHttpWithoutWorkspace,
} from '@seamapi/http'

import { resolveAuth } from 'lib/context.js'

export const validateToken = async (token: string, workspaceId?: string) => {
  const options = { endpoint: resolveAuth().endpoint }

  if (isPersonalAccessToken(token)) {
    const seam = workspaceId
      ? SeamHttp.fromPersonalAccessToken(token, workspaceId, options)
      : SeamHttpWithoutWorkspace.fromPersonalAccessToken(token, options)
    await seam.workspaces.list()
    return
  }

  if (isApiKey(token)) {
    const seam = SeamHttp.fromApiKey(token, options)
    await seam.workspaces.list()
    return
  }

  throw new Error('Invalid token: expected a Personal Access Token or API Key')
}
