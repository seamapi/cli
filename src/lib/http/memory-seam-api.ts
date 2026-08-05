import {
  SeamHttpApiError,
  SeamHttpInvalidInputError,
} from '@seamapi/http/connect'

import type { ApiRequestOptions, SeamApi, SeamApiRequest } from './api.js'

export interface MemorySeamApiResponse {
  status: number
  data: unknown
}

/**
 * A real {@link SeamApi} answering from a routes table and recording every
 * request, for tests: the in-process mirror of the e2e suite's HTTP server.
 * Error statuses reject with the SDK's own error classes, exactly as the
 * real transport does.
 */
export class MemorySeamApi implements SeamApi {
  /** Every request sent, in order — assert on the outbound messages. */
  readonly requests: Array<{ path: string; params: Record<string, unknown> }> =
    []

  constructor(private readonly routes: Record<string, MemorySeamApiResponse>) {}

  createRequest = ({ path, params }: ApiRequestOptions): SeamApiRequest => ({
    url: new URL(`https://memory.seam.example${path}`),
    method: 'POST',
    body: params,
    fetchResponse: async () => {
      this.requests.push({ path, params })

      const route = this.routes[path] ?? {
        status: 404,
        data: { error: { type: 'not_found', message: 'Not Found' } },
      }

      if (route.status >= 400) {
        throw toSeamHttpError(route)
      }
      return route.data
    },
  })
}

const toSeamHttpError = (route: MemorySeamApiResponse): SeamHttpApiError => {
  const error = (route.data as { error: { type: string; message: string } })
    .error
  if (error.type === 'invalid_input') {
    return new SeamHttpInvalidInputError(error, route.status, 'request_memory')
  }
  return new SeamHttpApiError(error, route.status, 'request_memory')
}

export const createMemorySeamApi = (
  routes: Record<string, MemorySeamApiResponse>,
): MemorySeamApi => new MemorySeamApi(routes)
