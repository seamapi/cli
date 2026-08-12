/**
 * Config values as whole trees: merging two trees into one view, and
 * splitting one tree into the settings file and the state file by key.
 * Pure transforms shared by the persistent store and the legacy migration.
 */

export const endpointKey = 'endpoint'

/** What the endpoint was called before, still read by `getEndpoint`. */
export const legacyEndpointKey = 'server'

export const currentWorkspaceIdKey = 'current_workspace_id'

export const patKey = 'pat'

export const useRemoteApiDefsKey = 'use_remote_api_defs'

/** Tokens are stored per endpoint, e.g. `https://connect.getseam.com.pat`. */
export const getTokenKey = (endpoint: string): string => `${endpoint}.${patKey}`

/** Whether a key holds auth state rather than a setting. */
export const isStateKey = (key: string): boolean => {
  return (
    key === currentWorkspaceIdKey ||
    key === patKey ||
    key.endsWith(`.${patKey}`)
  )
}

export const mergeConfig = (
  baseConfig: Record<string, unknown>,
  overrideConfig: Record<string, unknown>,
): Record<string, unknown> => {
  const mergedConfig = { ...baseConfig }

  for (const [key, value] of Object.entries(overrideConfig)) {
    const baseValue = mergedConfig[key]
    mergedConfig[key] =
      isRecord(baseValue) && isRecord(value)
        ? mergeConfig(baseValue, value)
        : value
  }

  return mergedConfig
}

export const splitConfig = (
  config: Record<string, unknown>,
): {
  settings: Record<string, unknown>
  state: Record<string, unknown>
} => {
  const settings: Record<string, unknown> = {}
  const state: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (isStateKey(key)) {
      state[key] = value
      continue
    }

    if (isRecord(value)) {
      const splitValue = splitConfig(value)
      if (Object.keys(splitValue.settings).length > 0) {
        settings[key] = splitValue.settings
      }

      if (Object.keys(splitValue.state).length > 0) {
        state[key] = splitValue.state
      }

      continue
    }

    settings[key] = value
  }

  return { settings, state }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
