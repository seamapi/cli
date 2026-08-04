import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import Configstore from 'configstore'

const configFileName = 'cli.json'
const configDirectoryName = 'seam'
const legacyConfigStoreId = 'seam-cli'
const currentWorkspaceIdKey = 'current_workspace_id'
const patKey = 'pat'

const getConfigPath = (): string => {
  return join(
    process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'),
    configDirectoryName,
    configFileName,
  )
}

const getStateConfigPath = (): string => {
  return join(
    process.env['XDG_STATE_HOME'] ?? join(homedir(), '.local', 'state'),
    configDirectoryName,
    configFileName,
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const isStateKey = (key: string): boolean => {
  return (
    key === currentWorkspaceIdKey || key === patKey || key.endsWith(`.${patKey}`)
  )
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

const writeIfChanged = (
  store: Configstore,
  nextConfig: Record<string, unknown>,
): void => {
  if (JSON.stringify(store.all) !== JSON.stringify(nextConfig)) {
    store.all = nextConfig
  }
}

const migrateConfig = (
  settingsStore: Configstore,
  stateStore: Configstore,
  legacyStore: Configstore,
): void => {
  if (!existsSync(legacyStore.path)) return

  const legacyConfig = legacyStore.all

  if (Object.keys(legacyConfig).length > 0) {
    const { settings, state } = splitConfig(legacyConfig)

    writeIfChanged(settingsStore, mergeConfig(settings, settingsStore.all))
    writeIfChanged(stateStore, mergeConfig(state, stateStore.all))
  }

  rmSync(legacyStore.path, { force: true })
}

class SeamConfigStore {
  readonly path: string

  constructor(
    private readonly settingsStore: Configstore,
    private readonly stateStore: Configstore,
  ) {
    this.path = settingsStore.path
  }

  get all(): Record<string, unknown> {
    return mergeConfig(this.settingsStore.all, this.stateStore.all)
  }

  set all(value: Record<string, unknown>) {
    const { settings, state } = splitConfig(value)
    this.settingsStore.all = settings
    this.stateStore.all = state
  }

  get size(): number {
    return Object.keys(this.all).length
  }

  get(key: string): unknown {
    return this.getStore(key).get(key)
  }

  set(key: string | Record<string, unknown>, value?: unknown): void {
    if (isRecord(key)) {
      for (const [configKey, configValue] of Object.entries(key)) {
        this.set(configKey, configValue)
      }

      return
    }

    this.getStore(key).set(key, value)
  }

  has(key: string): boolean {
    return this.getStore(key).has(key)
  }

  delete(key: string): void {
    this.getStore(key).delete(key)
  }

  clear(): void {
    this.settingsStore.clear()
    this.stateStore.clear()
  }

  private getStore(key: string): Configstore {
    return isStateKey(key) ? this.stateStore : this.settingsStore
  }
}

export const getConfigStore = () => {
  const settingsStore = new Configstore(legacyConfigStoreId, undefined, {
    configPath: getConfigPath(),
  })
  const stateStore = new Configstore(legacyConfigStoreId, undefined, {
    configPath: getStateConfigPath(),
  })

  migrateConfig(settingsStore, stateStore, new Configstore(legacyConfigStoreId))

  return new SeamConfigStore(settingsStore, stateStore)
}
