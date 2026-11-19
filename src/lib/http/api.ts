import {
  type SeamHttp,
  SeamHttpRequest,
  type SeamHttpRequestOptions,
} from '@seamapi/http'

import type { AuthContext } from 'lib/context.js'

import { getSeam } from './client.js'

export interface ApiRequestOptions extends Pick<
  SeamHttpRequestOptions,
  'waitForActionAttempt'
> {
  path: string
  params: Record<string, unknown>
  /** Response key documented for the endpoint, e.g., `devices`. */
  responseKey?: string | null | undefined
}

/**
 * A prepared call to the Seam API: inspectable before it is sent, e.g., to
 * report the URL, then executed through the SDK.
 */
export interface SeamApiRequest {
  readonly url: URL
  readonly method: string
  readonly body: unknown
  /** Return the full response body without automatic waiting. */
  fetchResponse: () => Promise<unknown>
  /** Return the response resource with SDK automatic action-attempt waiting. */
  execute: () => Promise<unknown>
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
    waitForActionAttempt,
  }: ApiRequestOptions): SeamApiRequest =>
    new SeamHttpRequest<Record<string, unknown>, string | undefined>(
      this.seam,
      {
        pathname: path,
        method: 'POST',
        body: params,
        responseKey: responseKey ?? undefined,
        options:
          waitForActionAttempt === undefined ? {} : { waitForActionAttempt },
        actionAttempts: {
          get: (params) =>
            this.seam.actionAttempts.get(params, {
              waitForActionAttempt: false,
            }),
        },
      },
    )
}

export const createSeamApi = async (auth?: AuthContext): Promise<SeamApi> => {
  const seam = await getSeam(auth)
  return new HttpSeamApi(seam)
}
