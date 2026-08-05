import { join } from 'node:path'

import Configstore from 'configstore'
import envPaths from 'env-paths'

import { migrateConfigStore } from './migrate.js'

const configFileName = 'cli.json'
const legacyConfigStoreId = 'seam-cli'
const currentWorkspaceIdKey = 'current_workspace_id'
const patKey = 'pat'
const paths = envPaths('seam', { suffix: '' })

/**
 * What a config store can do, regardless of where it keeps the values.
 *
 * The CLI reads and writes through this interface so a test may hand code an
 * in-memory store (see `create-memory-config-store.ts`) instead of the real
 * file-backed one.
 */
export interface ConfigStore {
  readonly path: string
  all: Record<string, unknown>
  readonly size: number
  get: (key: string) => unknown
  set: (key: string | Record<string, unknown>, value?: unknown) => void
  has: (key: string) => boolean
  delete: (key: string) => void
  clear: () => void
}

let configStore: ConfigStore | null = null

export const getConfigStore = (): ConfigStore => {
  configStore ??= createConfigStore()
  return configStore
}

/** Replace the store, e.g., with an in-memory one for a test. */
export const setConfigStore = (store: ConfigStore): void => {
  configStore = store
}

/** Drop the current store so the next read builds the real one. */
export const resetConfigStore = (): void => {
  configStore = null
}

const createConfigStore = (): SeamConfigStore => {
  const settingsStore = new Configstore(legacyConfigStoreId, undefined, {
    configPath: getConfigPath(),
  })
  const stateStore = new Configstore(legacyConfigStoreId, undefined, {
    configPath: getStateConfigPath(),
  })

  migrateConfigStore(
    settingsStore,
    stateStore,
    new Configstore(legacyConfigStoreId),
  )

  return new SeamConfigStore(settingsStore, stateStore)
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

export class SeamConfigStore implements ConfigStore {
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

const getConfigPath = (): string => {
  return join(paths.config, configFileName)
}

const getStateConfigPath = (): string => {
  return join(paths.log, configFileName)
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
