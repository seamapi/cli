import {
  SeamHttp,
  SeamHttpApiError,
  SeamHttpInvalidInputError,
} from '@seamapi/http'

import { HttpSeamApi } from './api.js'

export interface MemorySeamApiResponse {
  status: number
  data: unknown
}

type MemoryRoute = MemorySeamApiResponse | MemorySeamApiResponse[] | Error

/**
 * The real API adapter over an in-memory wire: exercises the SDK's request
 * cache and action-attempt resolver without HTTP or a second polling loop.
 */
export class MemorySeamApi extends HttpSeamApi {
  /** Every request sent, in order — assert on the outbound messages. */
  readonly requests: Array<{ path: string; params: Record<string, unknown> }> =
    []

  constructor(routes: Record<string, MemoryRoute>) {
    const seam = new SeamHttp({
      endpoint: 'https://memory.seam.example',
      apiKey: 'seam_memory',
    })
    super(seam)

    seam.client.defaults.adapter = async (config) => {
      const path = config.url ?? ''
      const params =
        config.params ??
        (typeof config.data === 'string'
          ? JSON.parse(config.data)
          : config.data) ??
        {}
      this.requests.push({ path, params })

      const configured = routes[path]
      const route = (Array.isArray(configured)
        ? configured.length > 1
          ? configured.shift()
          : configured[0]
        : configured) ?? {
        status: 404,
        data: { error: { type: 'not_found', message: 'Not Found' } },
      }

      if (route instanceof Error) throw route
      if (route.status >= 400) throw toSeamHttpError(route)
      return {
        data: route.data,
        status: route.status,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
  }
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
  routes: Record<string, MemoryRoute>,
): MemorySeamApi => new MemorySeamApi(routes)
