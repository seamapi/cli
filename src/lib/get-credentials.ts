import chalk from 'chalk'

import { getConfigStore } from './config/index.js'
import { getServer } from './get-server.js'
import { getOutput } from './output/get-output.js'

/** Overrides the stored token for the current server. */
export const tokenEnvVar = 'SEAM_CLI_TOKEN'

/** Overrides the stored workspace selection. */
export const workspaceIdEnvVar = 'SEAM_CLI_WORKSPACE_ID'

/**
 * The token used to authenticate requests.
 *
 * {@link tokenEnvVar} wins over the token stored by `seam login`,
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
 * {@link workspaceIdEnvVar} wins over the workspace stored by
 * `seam select workspace`. Returns `null` when neither is set: a token
 * scoped to a single workspace does not need one.
 */
export const getWorkspaceId = (): string | null => {
  const workspaceId = getWorkspaceIdFromEnv()
  if (workspaceId != null) return workspaceId

  return readString(getConfigStore().get('current_workspace_id'))
}

export const getTokenFromEnv = (): string | null =>
  readString(process.env[tokenEnvVar])

export const getWorkspaceIdFromEnv = (): string | null =>
  readString(process.env[workspaceIdEnvVar])

/**
 * Warn when an environment variable shadows what is about to be stored.
 *
 * The value is still stored: it takes effect wherever the environment
 * variable is not set.
 */
export const warnEnvVarOverride = (
  envVar: string,
  envValue: string | null,
  what: string,
): void => {
  if (envValue == null) return

  getOutput().warn(
    chalk.yellow(
      `Warning: ${envVar} is set and overrides the stored ${what} while it remains set`,
    ),
  )
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
