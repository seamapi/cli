import type { SeamHttp } from '@seamapi/http/connect'

import type { AuthContext } from '../context.js'
import { getSeam } from './client.js'

export interface SeamApiResponse {
  status: number
  data: unknown
}

/**
 * The one method the blueprint-driven CLI needs from the Seam API: post
 * params to an endpoint path and read back the status and body.
 *
 * Tests fake at this port with `createMemorySeamApi()` — the in-process
 * mirror of the e2e suite's HTTP server — so nothing in-process ever
 * imitates the SDK's own surface.
 */
export interface SeamApi {
  post: (
    path: string,
    params: Record<string, unknown>,
  ) => Promise<SeamApiResponse>
}

/** The only place `SeamHttp` appears for raw requests. */
export class SeamHttpApi implements SeamApi {
  constructor(private readonly seam: SeamHttp) {}

  post = async (
    path: string,
    params: Record<string, unknown>,
  ): Promise<SeamApiResponse> => {
    const { status, data } = await this.seam.client.post(path, params, {
      validateStatus: () => true,
    })
    return { status, data }
  }
}

export const createSeamApi = async (auth?: AuthContext): Promise<SeamApi> =>
  new SeamHttpApi(await getSeam(auth))
