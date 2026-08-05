import { join } from 'node:path'

import Configstore from 'configstore'
import envPaths from 'env-paths'

import { migrateConfigStore } from './migrate.js'
import { isStateKey, mergeConfig, splitConfig } from './values.js'

const configFileName = 'cli.json'
const legacyConfigStoreId = 'seam-cli'
const paths = envPaths('seam', { suffix: '' })

/**
 * What a config store can do, regardless of where it keeps the values.
 *
 * The CLI reads and writes through this interface so a test may hand code an
 * in-memory store (see `memory-config-store.ts`) instead of the real
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

const createConfigStore = (): PersistentConfigStore => {
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

  return new PersistentConfigStore(settingsStore, stateStore)
}

export class PersistentConfigStore implements ConfigStore {
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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
