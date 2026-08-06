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
export type AuthSetting = 'server' | 'token' | 'workspaceId'

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
    server: {
      envVar: endpointEnvVar,
      source: auth.serverSource,
      value: auth.server,
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
  server?: string | undefined
  token?: string | undefined
  workspaceId?: string | undefined
}

/**
 * Store the given credentials, validating the token first.
 *
 * The token is stored under the server it will be used with, so a given
 * server is stored and re-resolved before the token key is derived.
 *
 * Validation reaches the network, so a test may inject its own `validate`.
 */
export const login = async (
  { server, token, workspaceId }: LoginOptions,
  config: ConfigStore = getConfigStore(),
  validate: typeof validateToken = validateToken,
): Promise<void> => {
  let auth = resolveAuth(config)

  // Nothing is stored while the environment overrides it, so refuse before
  // storing anything rather than part way through.
  assertMutable(auth, 'token', 'log in')
  if (server != null) assertMutable(auth, 'server', 'select a server')
  if (workspaceId != null) {
    assertMutable(auth, 'workspaceId', 'select a workspace')
  }

  if (server != null) {
    config.set('server', server)
    config.delete('current_workspace_id')
    auth = resolveAuth(config)
  }

  if (token != null) {
    await validate(token, workspaceId)
    config.set(`${auth.server}.pat`, token)
    config.delete('current_workspace_id')
  }

  if (workspaceId != null) {
    config.set('current_workspace_id', workspaceId)
  }
}

/** Store the token for the current server, e.g., one just prompted for. */
export const storeToken = (
  token: string,
  config: ConfigStore = getConfigStore(),
): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log in')
  config.set(`${auth.server}.pat`, token)
}

/** Remove the stored token and workspace selection. */
export const logout = (config: ConfigStore = getConfigStore()): void => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'token', 'log out')
  config.delete(`${auth.server}.pat`)
  // Configs written before tokens were stored per server may still hold an
  // un-namespaced token, so drop that too.
  config.delete('pat')
  config.delete('current_workspace_id')
}

/**
 * Store the server to make requests against.
 *
 * The workspace selection belongs to the previous server, so it is cleared.
 */
export const selectServer = (
  server: string,
  config: ConfigStore = getConfigStore(),
): void => {
  assertMutable(resolveAuth(config), 'server', 'select a server')
  config.set('server', server)
  config.delete('current_workspace_id')
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
 * Point the CLI at a fake Seam Connect server and store the well-known
 * token it accepts. Returns the generated server URL for reporting.
 */
export const selectFakeServer = ({
  urlSeed = randomBytes(5).toString('hex'),
  config = getConfigStore(),
}: {
  urlSeed?: string
  config?: ConfigStore
} = {}): { server: string; token: string } => {
  const auth = resolveAuth(config)
  assertMutable(auth, 'server', 'select a server')
  assertMutable(auth, 'token', 'log in')

  const server = `https://${urlSeed}.fakeseamconnect.seam.vc`
  const token = 'seam_apikey1_token'
  config.set('server', server)
  config.set(`${server}.pat`, token)
  config.delete('current_workspace_id')

  return { server, token }
}

/** Store whether API definitions come from the server instead of npm. */
export const setUseRemoteApiDefs = (
  useRemoteApiDefs: boolean,
  config: ConfigStore = getConfigStore(),
): void => {
  config.set('use_remote_api_defs', useRemoteApiDefs)
}
