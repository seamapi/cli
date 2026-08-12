import type { ConfigStore } from './config-store.js'

/** Tokens are stored per endpoint, e.g. `https://connect.getseam.com.pat`. */
const tokenKey = (endpoint: string): `${string}.pat` => `${endpoint}.pat`

/**
 * The CLI's configuration, in the terms the CLI thinks in. Keys are named
 * here alone: a caller says what it wants stored, not where it goes.
 */
export interface CliConfig {
  readonly path: string
  getEndpoint: () => string | null
  setEndpoint: (endpoint: string) => void
  getToken: (endpoint: string) => string | null
  setToken: (endpoint: string, token: string) => void
  unsetToken: (endpoint: string) => void
  getWorkspace: () => string | null
  setWorkspace: (workspaceId: string) => void
  unsetWorkspace: () => void
  getUseRemoteApiDefs: () => boolean | null
  setUseRemoteApiDefs: (useRemoteApiDefs: boolean) => void
}

export const createCliConfig = (store: ConfigStore): CliConfig => ({
  get path() {
    return store.path
  },

  getEndpoint: () =>
    // `server` is what an older CLI called the endpoint.
    readString(store.get('endpoint')) ?? readString(store.get('server')),

  /**
   * Store the endpoint, dropping what belonged to the previous one: the
   * workspace selection, and any value left under the legacy key that
   * {@link CliConfig.getEndpoint} would otherwise still fall back to.
   */
  setEndpoint: (endpoint) => {
    store.set('endpoint', endpoint)
    store.delete('server')
    store.delete('current_workspace_id')
  },

  getToken: (endpoint) => readString(store.get(tokenKey(endpoint))),

  setToken: (endpoint, token) => {
    store.set(tokenKey(endpoint), token)
  },

  unsetToken: (endpoint) => {
    store.delete(tokenKey(endpoint))
    // Configs written before tokens were stored per endpoint may still hold
    // an un-namespaced one.
    store.delete('pat')
  },

  getWorkspace: () => readString(store.get('current_workspace_id')),

  setWorkspace: (workspaceId) => {
    store.set('current_workspace_id', workspaceId)
  },

  unsetWorkspace: () => {
    store.delete('current_workspace_id')
  },

  getUseRemoteApiDefs: () => {
    const useRemoteApiDefs = store.get('use_remote_api_defs')
    return typeof useRemoteApiDefs === 'boolean' ? useRemoteApiDefs : null
  },

  setUseRemoteApiDefs: (useRemoteApiDefs) => {
    store.set('use_remote_api_defs', useRemoteApiDefs)
  },
})

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
