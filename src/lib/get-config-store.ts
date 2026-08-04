import { join } from 'node:path'

import Configstore from 'configstore'
import envPaths from 'env-paths'

import {
  isRecord,
  isStateKey,
  mergeConfig,
  splitConfig,
} from './config-store-utils.js'
import { migrateConfigStore } from './migrate-config-store.js'

const configFileName = 'cli.json'
const legacyConfigStoreId = 'seam-cli'
const paths = envPaths('seam', { suffix: '' })

export const getConfigStore = () => {
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

const getConfigPath = (): string => {
  return join(paths.config, configFileName)
}

const getStateConfigPath = (): string => {
  return join(paths.log, configFileName)
}

