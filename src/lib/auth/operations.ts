import { randomBytes } from 'node:crypto'

import { type ConfigStore, getConfigStore } from 'lib/config/index.js'
import { type AuthContext, resolveAuth } from 'lib/context.js'
import {
  assertEnvVarUnset,
  endpointEnvVar,
  tokenEnvVar,
  workspaceIdEnvVar,
} from 'lib/env.js'

import { validateToken } from './validate-token.js'

/** A stored auth setting an environment variable may override. */
export type AuthSetting = 'endpoint' | 'token' | 'workspaceId'

/**
 * Refuse to store a setting the environment overrides.
 *
 * The env-override policy lives here alone: every auth mutation asserts
 * through this before writing, so a command that appears to succeed cannot
 * leave the CLI using something else.
 *
 * @param action What the command does, e.g., `log in`.
 */
export const assertMutable = (
  auth: AuthContext,
  setting: AuthSetting,
  action: string,
): void => {
  const { envVar, source, value } = {
    endpoint: {
      envVar: endpointEnvVar,
      source: auth.endpointSource,
      value: auth.endpoint,
    },
    token: { envVar: tokenEnvVar, source: auth.tokenSource, value: auth.token },
    workspaceId: {
      envVar: workspaceIdEnvVar,
      source: auth.workspaceIdSource,
      value: auth.workspaceId,
    },
  }[setting]

  if (source !== 'env') return
  assertEnvVarUnset(envVar, value, action)
}

export interface LoginOptions {
  endpoint?: string | undefined
  token?: string | undefined
  workspaceId?: string | undefined
}

/**
 * Store the given credentials, validating the token first.
 *
 * The token is stored under the endpoint it will be used with, so a given
 * endpoint is stored and re-resolved before the token key is derived.
 *
 * Validation reaches the network, so a test may inject its own `validate`.
 */
export const login = async (
  { endpoint, token, workspaceId }: LoginOptions,
  config: ConfigStore = getConfigStore(),
  validate: typeof validateToken = validateToken,
): Promise<void> => {
  let auth = resolveAuth(config)

  // Nothing is stored while the environment overrides it, so refuse before
  // storing anything rather than part way through.
  assertMutable(auth, 'token', 'log in')
  if (endpoint != null) assertMutable(auth, 'endpoint', 'select an endpoint')
  if (workspaceId != null) {
    assertMutable(auth, 'workspaceId', 'select a workspace')
  }

  if (endpoint != null) {
    storeEndpoint(endpoint, config)
    auth = resolveAuth(config)
  }

  if (token != null) {
    await validate(token, workspaceId)
    config.set(`${auth.endpoint}.pat`, token)
    config.delete('current_workspace_id')
  }

  if (workspaceId != null) {
    config.set('current_workspace_id', workspaceId)
  }
}

/** Store the token for the current endpoint, e.g., one just prompted for. */
export const storeToken = (
  token: string,
  config: ConfigStore = getConfigStore(),
): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log in')
  config.set(`${auth.endpoint}.pat`, token)
}

/** Remove the stored token and workspace selection. */
export const logout = (config: ConfigStore = getConfigStore()): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log out')
  config.delete(`${auth.endpoint}.pat`)
  // Configs written before tokens were stored per endpoint may still hold an
  // un-namespaced token, so drop that too.
  config.delete('pat')
  config.delete('current_workspace_id')
}

/**
 * Store the endpoint to make requests against.
 *
 * The workspace selection belongs to the previous endpoint, so it is cleared.
 */
export const selectEndpoint = (
  endpoint: string,
  config: ConfigStore = getConfigStore(),
): void => {
  assertMutable(resolveAuth(config), 'endpoint', 'select an endpoint')
  storeEndpoint(endpoint, config)
}

/** Store the workspace requests are made against. */
export const selectWorkspace = (
  workspaceId: string,
  config: ConfigStore = getConfigStore(),
): void => {
  assertMutable(resolveAuth(config), 'workspaceId', 'select a workspace')
  config.set('current_workspace_id', workspaceId)
}

/**
 * Point the CLI at a fake Seam Connect endpoint and store the well-known
 * token it accepts. Returns the generated endpoint URL for reporting.
 */
export const selectFakeEndpoint = ({
  urlSeed = randomBytes(5).toString('hex'),
  config = getConfigStore(),
}: {
  urlSeed?: string
  config?: ConfigStore
} = {}): { endpoint: string; token: string } => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'endpoint', 'select an endpoint')
  assertMutable(auth, 'token', 'log in')

  const endpoint = `https://${urlSeed}.fakeseamconnect.seam.vc`
  const token = 'seam_apikey1_token'
  storeEndpoint(endpoint, config)
  config.set(`${endpoint}.pat`, token)

  return { endpoint, token }
}

/** Store whether API definitions come from the endpoint instead of npm. */
export const setUseRemoteApiDefs = (
  useRemoteApiDefs: boolean,
  config: ConfigStore = getConfigStore(),
): void => {
  config.set('use_remote_api_defs', useRemoteApiDefs)
}

/**
 * Write the endpoint, dropping what belonged to the previous one: the
 * workspace selection, and any value left under the legacy `server` key that
 * {@link resolveAuth} would otherwise still fall back to.
 */
const storeEndpoint = (endpoint: string, config: ConfigStore): void => {
  config.set('endpoint', endpoint)
  config.delete('server')
  config.delete('current_workspace_id')
}
