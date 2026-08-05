import type { SeamApi, SeamApiResponse } from './api.js'

export interface MemorySeamApi {
  api: SeamApi
  /** Every request made, in order — assert on the outbound messages. */
  requests: Array<{ path: string; params: Record<string, unknown> }>
}

/**
 * A real {@link SeamApi} answering from a routes table and recording every
 * request, for tests: the in-process mirror of the e2e suite's HTTP server.
 */
export const createMemorySeamApi = (
  routes: Record<string, SeamApiResponse>,
): MemorySeamApi => {
  const requests: Array<{ path: string; params: Record<string, unknown> }> = []

  const api: SeamApi = {
    post: async (path, params) => {
      requests.push({ path, params })
      return (
        routes[path] ?? { status: 404, data: { error: { type: 'not_found' } } }
      )
    },
  }

  return { api, requests }
}
