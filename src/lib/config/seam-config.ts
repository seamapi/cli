import type { ConfigStore } from './config-store.js'
import {
  currentWorkspaceIdKey,
  endpointKey,
  getTokenKey,
  legacyEndpointKey,
  patKey,
  useRemoteApiDefsKey,
} from './values.js'

/**
 * The CLI's configuration, in the terms the CLI thinks in.
 *
 * Every key lives in `values.ts` and is used here alone: a caller says what
 * it wants stored, not where it goes or what it is called.
 */
export interface SeamConfig {
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

export const createSeamConfig = (store: ConfigStore): SeamConfig => ({
  get path() {
    return store.path
  },

  getEndpoint: () =>
    readString(store.get(endpointKey)) ??
    readString(store.get(legacyEndpointKey)),

  /**
   * Store the endpoint, dropping what belonged to the previous one: the
   * workspace selection, and any value left under the legacy key that
   * {@link SeamConfig.getEndpoint} would otherwise still fall back to.
   */
  setEndpoint: (endpoint) => {
    store.set(endpointKey, endpoint)
    store.delete(legacyEndpointKey)
    store.delete(currentWorkspaceIdKey)
  },

  /** Tokens are stored per endpoint, so one is never sent to another. */
  getToken: (endpoint) => readString(store.get(getTokenKey(endpoint))),

  setToken: (endpoint, token) => {
    store.set(getTokenKey(endpoint), token)
  },

  unsetToken: (endpoint) => {
    store.delete(getTokenKey(endpoint))
    // Configs written before tokens were stored per endpoint may still hold
    // an un-namespaced one.
    store.delete(patKey)
  },

  getWorkspace: () => readString(store.get(currentWorkspaceIdKey)),

  setWorkspace: (workspaceId) => {
    store.set(currentWorkspaceIdKey, workspaceId)
  },

  unsetWorkspace: () => {
    store.delete(currentWorkspaceIdKey)
  },

  getUseRemoteApiDefs: () => {
    const useRemoteApiDefs = store.get(useRemoteApiDefsKey)
    return typeof useRemoteApiDefs === 'boolean' ? useRemoteApiDefs : null
  },

  setUseRemoteApiDefs: (useRemoteApiDefs) => {
    store.set(useRemoteApiDefsKey, useRemoteApiDefs)
  },
})

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
