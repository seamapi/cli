import type { ConfigStore } from './config-store.js'

/**
 * A real {@link ConfigStore} held in memory, for tests.
 *
 * Keys are flat: the file-backed store nests dotted keys, but nothing reads
 * a value back by a different spelling than it was written with.
 */
export class MemoryConfigStore implements ConfigStore {
  readonly path = '/memory/cli.json'

  private readonly values: Map<string, unknown>

  constructor(initialValues: Record<string, unknown> = {}) {
    this.values = new Map(Object.entries(initialValues))
  }

  get all(): Record<string, unknown> {
    return Object.fromEntries(this.values)
  }

  set all(newValues: Record<string, unknown>) {
    this.values.clear()
    for (const [key, value] of Object.entries(newValues)) {
      this.values.set(key, value)
    }
  }

  get size(): number {
    return this.values.size
  }

  get(key: string): unknown {
    return this.values.get(key)
  }

  set(key: string | Record<string, unknown>, value?: unknown): void {
    if (typeof key === 'string') {
      this.values.set(key, value)
      return
    }
    for (const [configKey, configValue] of Object.entries(key)) {
      this.values.set(configKey, configValue)
    }
  }

  has(key: string): boolean {
    return this.values.has(key)
  }

  delete(key: string): void {
    this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}

export const createMemoryConfigStore = (
  initialValues: Record<string, unknown> = {},
): ConfigStore => new MemoryConfigStore(initialValues)
