const currentWorkspaceIdKey = 'current_workspace_id'
const patKey = 'pat'

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

export const isStateKey = (key: string): boolean => {
  return (
    key === currentWorkspaceIdKey ||
    key === patKey ||
    key.endsWith(`.${patKey}`)
  )
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
