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
import { getAuthOverrides } from './overrides.js'

export const defaultEndpoint = 'https://connect.getseam.com'

/** Where a resolved value came from, e.g., to refuse writes the env shadows. */
export type ValueSource = 'flag' | 'env' | 'config' | 'default'

/**
 * The endpoint, token, and workspace requests are made with.
 *
 * Resolved in one place so the precedence rule exists once: a flag given for
 * the one command wins over an environment variable, which wins over the
 * stored value, and the endpoint falls back to Seam. The source tags say
 * where each value came from.
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
  const { endpoint: flagEndpoint, workspaceId: flagWorkspaceId } =
    getAuthOverrides()

  const envEndpoint = getEndpointFromEnv()
  const storedEndpoint = config.getEndpoint()
  const endpoint = flagEndpoint ?? envEndpoint ?? storedEndpoint

  const envToken = getTokenFromEnv()
  // The token is stored per endpoint, so an overridden endpoint is read with
  // the token belonging to it rather than the one it replaced.
  const storedToken = config.getToken(endpoint ?? defaultEndpoint)

  const envWorkspaceId = getWorkspaceIdFromEnv()
  const storedWorkspaceId = config.getWorkspace()
  const workspaceId = flagWorkspaceId ?? envWorkspaceId ?? storedWorkspaceId

  return {
    endpoint: endpoint ?? defaultEndpoint,
    endpointSource:
      flagEndpoint != null
        ? 'flag'
        : envEndpoint != null
          ? 'env'
          : endpoint != null
            ? 'config'
            : 'default',
    token: envToken ?? storedToken,
    tokenSource:
      envToken != null ? 'env' : storedToken != null ? 'config' : null,
    workspaceId,
    workspaceIdSource:
      flagWorkspaceId != null
        ? 'flag'
        : envWorkspaceId != null
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
