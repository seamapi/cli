import { type CliConfig, getConfig } from 'lib/config/index.js'
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

/**
 * Store a token, validating it first.
 *
 * The token is stored under the endpoint it will be used with, which
 * `--endpoint` or the environment may have pointed elsewhere for this one
 * command: logging in to another endpoint stores a token for it without
 * selecting it. The workspace is only what the token is validated against,
 * as a Personal Access Token is meaningless without one.
 *
 * Validation reaches the network, so a test may inject its own `validate`.
 */
export const login = async (
  token: string,
  config: CliConfig = getConfig(),
  validate: typeof validateToken = validateToken,
): Promise<void> => {
  const auth = resolveAuth(config)

  // Nothing is stored while the environment overrides it, so refuse before
  // validating rather than after reaching the network.
  assertMutable(auth, 'token', 'log in')

  await validate(token, auth.workspaceId ?? undefined)

  config.setToken(auth.endpoint, token)
  // The selection belongs to whoever was logged in before.
  config.unsetWorkspace()
}

/** Store the token for the current endpoint, e.g., one just prompted for. */
export const storeToken = (
  token: string,
  config: CliConfig = getConfig(),
): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log in')
  config.setToken(auth.endpoint, token)
}

/** Remove the stored token and workspace selection. */
export const logout = (config: CliConfig = getConfig()): void => {
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
  config: CliConfig = getConfig(),
): void => {
  assertMutable(resolveAuth(config), 'endpoint', 'select an endpoint')
  config.setEndpoint(endpoint)
}

/** Store the workspace requests are made against. */
export const selectWorkspace = (
  workspaceId: string,
  config: CliConfig = getConfig(),
): void => {
  assertMutable(resolveAuth(config), 'workspaceId', 'select a workspace')
  config.setWorkspace(workspaceId)
}

/** Store whether the API schema comes from the endpoint instead of npm. */
export const setUseRemoteSchema = (
  useRemoteSchema: boolean,
  config: CliConfig = getConfig(),
): void => {
  config.setUseRemoteSchema(useRemoteSchema)
}
