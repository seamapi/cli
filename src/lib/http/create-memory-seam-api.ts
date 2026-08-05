import type { SeamApi, SeamApiResponse } from './api.js'

/**
 * A real {@link SeamApi} answering from a routes table and recording every
 * request, for tests: the in-process mirror of the e2e suite's HTTP server.
 */
export class MemorySeamApi implements SeamApi {
  /** Every request made, in order — assert on the outbound messages. */
  readonly requests: Array<{ path: string; params: Record<string, unknown> }> =
    []

  constructor(private readonly routes: Record<string, SeamApiResponse>) {}

  post = async (
    path: string,
    params: Record<string, unknown>,
  ): Promise<SeamApiResponse> => {
    this.requests.push({ path, params })
    return (
      this.routes[path] ?? {
        status: 404,
        data: { error: { type: 'not_found' } },
      }
    )
  }
}

export const createMemorySeamApi = (
  routes: Record<string, SeamApiResponse>,
): MemorySeamApi => new MemorySeamApi(routes)
