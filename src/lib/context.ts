import type { Interactivity } from './args/parse.js'
import type { ApiBlueprint } from './blueprint/index.js'
import { type ConfigStore, getConfigStore } from './config/index.js'
import {
  getEndpointFromEnv,
  getTokenFromEnv,
  getWorkspaceIdFromEnv,
} from './env.js'

export const defaultServer = 'https://connect.getseam.com'

/** Where a resolved value came from, e.g., to refuse writes the env shadows. */
export type ValueSource = 'env' | 'config' | 'default'

/**
 * The server, token, and workspace requests are made with.
 *
 * Resolved in one place so the precedence rule exists once: an environment
 * variable wins over the stored value, and the server falls back to Seam.
 * The source tags say where each value came from.
 */
export interface AuthContext {
  server: string
  serverSource: ValueSource
  token: string | null
  tokenSource: Exclude<ValueSource, 'default'> | null
  workspaceId: string | null
  workspaceIdSource: Exclude<ValueSource, 'default'> | null
}

export const resolveAuth = (
  config: ConfigStore = getConfigStore(),
): AuthContext => {
  const envServer = getEndpointFromEnv()
  const storedServer = config.get('server')
  const server =
    envServer ?? (typeof storedServer === 'string' ? storedServer : null)

  const envToken = getTokenFromEnv()
  const storedToken = readString(config.get(`${server ?? defaultServer}.pat`))

  const envWorkspaceId = getWorkspaceIdFromEnv()
  const storedWorkspaceId = readString(config.get('current_workspace_id'))

  return {
    server: server ?? defaultServer,
    serverSource:
      envServer != null ? 'env' : server != null ? 'config' : 'default',
    token: envToken ?? storedToken,
    tokenSource:
      envToken != null ? 'env' : storedToken != null ? 'config' : null,
    workspaceId: envWorkspaceId ?? storedWorkspaceId,
    workspaceIdSource:
      envWorkspaceId != null
        ? 'env'
        : storedWorkspaceId != null
          ? 'config'
          : null,
  }
}

/**
 * Everything a command runs with: the stores and auth it reads, the API
 * shape it acts on, and how it may interact with the user.
 */
export interface CliContext {
  config: ConfigStore
  auth: AuthContext
  blueprint: ApiBlueprint
  interactivity: Interactivity
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
