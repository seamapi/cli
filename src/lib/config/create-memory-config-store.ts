import type { ConfigStore } from './config-store.js'

/**
 * A real {@link ConfigStore} held in memory, for tests.
 *
 * Keys are flat: the file-backed store nests dotted keys, but nothing reads
 * a value back by a different spelling than it was written with.
 */
export const createMemoryConfigStore = (
  initialValues: Record<string, unknown> = {},
): ConfigStore => {
  const values = new Map<string, unknown>(Object.entries(initialValues))

  return {
    path: '/memory/cli.json',
    get all() {
      return Object.fromEntries(values)
    },
    set all(newValues: Record<string, unknown>) {
      values.clear()
      for (const [key, value] of Object.entries(newValues)) {
        values.set(key, value)
      }
    },
    get size() {
      return values.size
    },
    get: (key) => values.get(key),
    set: (key, value) => {
      if (typeof key === 'string') {
        values.set(key, value)
        return
      }
      for (const [configKey, configValue] of Object.entries(key)) {
        values.set(configKey, configValue)
      }
    },
    has: (key) => values.has(key),
    delete: (key) => {
      values.delete(key)
    },
    clear: () => {
      values.clear()
    },
  }
}
