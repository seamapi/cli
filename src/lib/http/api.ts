import { type SeamHttp, SeamHttpRequest } from '@seamapi/http'

import type { AuthContext } from 'lib/context.js'

import { getSeam } from './client.js'

export interface ApiRequestOptions {
  path: string
  params: Record<string, unknown>
  /** Response key documented for the endpoint, e.g., `devices`. */
  responseKey?: string | null | undefined
}

/**
 * A prepared call to the Seam API: inspectable before it is sent, e.g., to
 * report the URL, then sent with {@link SeamApiRequest.fetchResponse}.
 *
 * The real implementation is the SDK's own `SeamHttpRequest`; sending one
 * rejects with a `SeamHttpApiError` when the API reports an error.
 */
export interface SeamApiRequest {
  readonly url: URL
  readonly method: string
  readonly body: unknown
  /** Send the request and return the full response body. */
  fetchResponse: () => Promise<unknown>
}

/**
 * How the blueprint-driven CLI reaches the Seam API: prepare a request for
 * an endpoint path. Tests fake at this port with `createMemorySeamApi()` —
 * the in-process mirror of the e2e suite's HTTP server.
 */
export interface SeamApi {
  createRequest: (options: ApiRequestOptions) => SeamApiRequest
}

/** The only place `SeamHttp` appears for raw requests. */
export class HttpSeamApi implements SeamApi {
  constructor(private readonly seam: SeamHttp) {}

  createRequest = ({
    path,
    params,
    responseKey,
  }: ApiRequestOptions): SeamApiRequest =>
    new SeamHttpRequest<Record<string, unknown>, string | undefined>(
      this.seam,
      {
        pathname: path,
        method: 'POST',
        body: params,
        responseKey: responseKey ?? undefined,
      },
    )
}

export const createSeamApi = async (auth?: AuthContext): Promise<SeamApi> => {
  const seam = await getSeam(auth)
  return new HttpSeamApi(seam)
}
