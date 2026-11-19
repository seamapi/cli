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
 * report the URL, then sent with {@link SeamApiRequest.fetchResponse}.
 *
 * Uses the SDK's cached request and resolver, retaining the response wrapper.
 * HTTP failures reject with `SeamHttpApiError`; action failures and timeouts
 * reject with the SDK's action-attempt errors before returning any payload.
 */
export interface SeamApiRequest {
  readonly url: URL
  readonly method: string
  readonly body: unknown
  /** Send once, wait if applicable, and return the full response body. */
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
    waitForActionAttempt,
  }: ApiRequestOptions): SeamApiRequest => {
    const request = new SeamHttpRequest<
      Record<string, unknown>,
      string | undefined
    >(this.seam, {
      pathname: path,
      method: 'POST',
      body: params,
      responseKey: responseKey ?? undefined,
      options:
        waitForActionAttempt === undefined ? {} : { waitForActionAttempt },
      actionAttempts: {
        get: (params) =>
          this.seam.actionAttempts.get(params, { waitForActionAttempt: false }),
      },
    })

    return {
      url: request.url,
      method: request.method,
      body: request.body,
      fetchResponse: async () => {
        const response = await request.fetchResponse()
        if (
          responseKey !== 'action_attempt' ||
          waitForActionAttempt === false
        ) {
          return response
        }
        // execute() reuses the cached submission and runs the SDK resolver.
        return { ...response, action_attempt: await request.execute() }
      },
    }
  }
}

export const createSeamApi = async (auth?: AuthContext): Promise<SeamApi> => {
  const seam = await getSeam(auth)
  return new HttpSeamApi(seam)
}
