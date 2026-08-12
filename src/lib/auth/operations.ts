import { getConfig, type SeamConfig } from 'lib/config/index.js'
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
  config: SeamConfig = getConfig(),
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
    config.setEndpoint(endpoint)
    auth = resolveAuth(config)
  }

  if (token != null) {
    await validate(token, workspaceId)
    config.setToken(auth.endpoint, token)
    config.unsetWorkspace()
  }

  if (workspaceId != null) {
    config.setWorkspace(workspaceId)
  }
}

/** Store the token for the current endpoint, e.g., one just prompted for. */
export const storeToken = (
  token: string,
  config: SeamConfig = getConfig(),
): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log in')
  config.setToken(auth.endpoint, token)
}

/** Remove the stored token and workspace selection. */
export const logout = (config: SeamConfig = getConfig()): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log out')
  config.unsetToken(auth.endpoint)
  config.unsetWorkspace()
}

/**
 * Store the endpoint to make requests against.
 *
 * The workspace selection belongs to the previous endpoint, so it is cleared.
 */
export const selectEndpoint = (
  endpoint: string,
  config: SeamConfig = getConfig(),
): void => {
  assertMutable(resolveAuth(config), 'endpoint', 'select an endpoint')
  config.setEndpoint(endpoint)
}

/** Store the workspace requests are made against. */
export const selectWorkspace = (
  workspaceId: string,
  config: SeamConfig = getConfig(),
): void => {
  assertMutable(resolveAuth(config), 'workspaceId', 'select a workspace')
  config.setWorkspace(workspaceId)
}

/** Store whether API definitions come from the endpoint instead of npm. */
export const setUseRemoteApiDefs = (
  useRemoteApiDefs: boolean,
  config: SeamConfig = getConfig(),
): void => {
  config.setUseRemoteApiDefs(useRemoteApiDefs)
}
