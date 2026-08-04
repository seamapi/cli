import { getConfigStore } from './config/index.js'
import { getTokenFromEnv, getWorkspaceIdFromEnv } from './env.js'
import { getServer } from './get-server.js'

/**
 * The token used to authenticate requests.
 *
 * `SEAM_CLI_TOKEN` wins over the token stored by `seam login`,
 * so a token may be given per command or per shell without logging in.
 */
export const getToken = (): string | null => {
  const token = getTokenFromEnv()
  if (token != null) return token

  return readString(getConfigStore().get(`${getServer()}.pat`))
}

/**
 * The workspace requests are made against.
 *
 * `SEAM_CLI_WORKSPACE_ID` wins over the workspace stored by
 * `seam select workspace`. Returns `null` when neither is set: a token
 * scoped to a single workspace does not need one.
 */
export const getWorkspaceId = (): string | null => {
  const workspaceId = getWorkspaceIdFromEnv()
  if (workspaceId != null) return workspaceId

  return readString(getConfigStore().get('current_workspace_id'))
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
