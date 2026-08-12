import type { Interactivity } from './args/parse.js'
import type { ApiBlueprint } from './blueprint/index.js'
import { type CliConfig, getConfig } from './config/index.js'
import {
  getEndpointFromEnv,
  getTokenFromEnv,
  getWorkspaceIdFromEnv,
} from './env.js'
import type { SeamApi } from './http/api.js'
import type { Output } from './output/output.js'

export const defaultEndpoint = 'https://connect.getseam.com'

/** Where a resolved value came from, e.g., to refuse writes the env shadows. */
export type ValueSource = 'env' | 'config' | 'default'

/**
 * The endpoint, token, and workspace requests are made with.
 *
 * Resolved in one place so the precedence rule exists once: an environment
 * variable wins over the stored value, and the endpoint falls back to Seam.
 * The source tags say where each value came from.
 */
export interface AuthContext {
  endpoint: string
  endpointSource: ValueSource
  token: string | null
  tokenSource: Exclude<ValueSource, 'default'> | null
  workspaceId: string | null
  workspaceIdSource: Exclude<ValueSource, 'default'> | null
}

export const resolveAuth = (config: CliConfig = getConfig()): AuthContext => {
  const envEndpoint = getEndpointFromEnv()
  const storedEndpoint = config.getEndpoint()
  const endpoint = envEndpoint ?? storedEndpoint

  const envToken = getTokenFromEnv()
  const storedToken = config.getToken(endpoint ?? defaultEndpoint)

  const envWorkspaceId = getWorkspaceIdFromEnv()
  const storedWorkspaceId = config.getWorkspace()

  return {
    endpoint: endpoint ?? defaultEndpoint,
    endpointSource:
      envEndpoint != null ? 'env' : endpoint != null ? 'config' : 'default',
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
  config: CliConfig
  auth: AuthContext
  output: Output
  blueprint: ApiBlueprint
  interactivity: Interactivity
  /** The Seam API, constructed on first use and shared for the run. */
  api: () => Promise<SeamApi>
}
