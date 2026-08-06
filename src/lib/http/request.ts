import {
  isSeamHttpApiError,
  type SeamHttpApiError,
} from '@seamapi/http/connect'
import chalk from 'chalk'

import type { Output } from 'lib/output/output.js'
import { selectResponsePayload } from 'lib/output/select-response-payload.js'
import { withLoading } from 'lib/output/with-loading.js'

import type { SeamApi } from './api.js'

export interface RequestSeamApiOptions {
  path: string
  params: Record<string, any>
  /** Response key for the endpoint, used to trim the reported payload. */
  responseKey?: string | null | undefined
}

export interface RequestSeamApiDependencies {
  api: SeamApi
  output: Output
}

/**
 * Make a request and report the result: the request URL and params go to
 * stderr, the trimmed payload to stdout. An API error reports its status
 * and payload and sets the exit code. Returns the response body, or `null`
 * when the API reported an error.
 */
export const requestSeamApi = async (
  options: RequestSeamApiOptions,
  { api, output }: RequestSeamApiDependencies,
): Promise<unknown> => {
  const request = api.createRequest(options)

  output.info(`\n${chalk.green(request.url.toString())}`)
  output.info(`Request Params:`)
  output.info(formatParams(options.params))

  let body: unknown
  try {
    body = await withLoading('Making request...', async () => {
      return await request.fetchResponse()
    })
  } catch (error) {
    if (!isSeamHttpApiError(error)) throw error

    output.warn(chalk.red(`[${error.statusCode}]`))
    process.exitCode = 1
    output.data({ error: toErrorPayload(error) })
    return null
  }

  output.data(selectResponsePayload(body, { responseKey: options.responseKey }))

  return body
}

const toErrorPayload = (
  error: SeamHttpApiError,
): { type: string; message: string; data?: unknown } => ({
  type: error.code,
  message: error.message,
  ...(error.data === undefined ? {} : { data: error.data }),
})

const formatParams = (params: Record<string, any>): string =>
  JSON.stringify(params, null, 2)
