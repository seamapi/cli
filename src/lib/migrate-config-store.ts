import { existsSync, rmSync } from 'node:fs'

import type Configstore from 'configstore'

const currentWorkspaceIdKey = 'current_workspace_id'
const patKey = 'pat'

export const migrateConfigStore = (
  settingsStore: Configstore,
  stateStore: Configstore,
  legacyStore: Configstore,
): void => {
  if (!existsSync(legacyStore.path)) return

  migrateLegacyConfig(settingsStore, stateStore, legacyStore.all)

  rmSync(legacyStore.path, { force: true })
}

const migrateLegacyConfig = (
  settingsStore: Configstore,
  stateStore: Configstore,
  legacyConfig: Record<string, unknown>,
): void => {
  if (Object.keys(legacyConfig).length === 0) return

  const { settings, state } = splitConfig(legacyConfig)

  writeIfChanged(settingsStore, mergeConfig(settings, settingsStore.all))
  writeIfChanged(stateStore, mergeConfig(state, stateStore.all))
}

const writeIfChanged = (
  store: Configstore,
  nextConfig: Record<string, unknown>,
): void => {
  if (JSON.stringify(store.all) !== JSON.stringify(nextConfig)) {
    store.all = nextConfig
  }
}

const splitConfig = (
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

const mergeConfig = (
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

const isStateKey = (key: string): boolean => {
  return (
    key === currentWorkspaceIdKey ||
    key === patKey ||
    key.endsWith(`.${patKey}`)
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
