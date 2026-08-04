import { existsSync, rmSync } from 'node:fs'

import Configstore from 'configstore'

import { mergeConfig, splitConfig } from './config-store.js'

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
