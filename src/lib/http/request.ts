import chalk from 'chalk'

import type { Output } from '../output/create-output.js'
import { selectResponsePayload } from '../output/select-response-payload.js'
import { withLoading } from '../output/with-loading.js'
import type { SeamApi, SeamApiResponse } from './api.js'

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
 * Make a request and report the result: the request banner and status go to
 * stderr, the trimmed payload to stdout, and an error status sets the exit
 * code. The transport itself is behind the injected {@link SeamApi}.
 */
export const requestSeamApi = async (
  { path, params, responseKey }: RequestSeamApiOptions,
  { api, output }: RequestSeamApiDependencies,
): Promise<SeamApiResponse> => {
  output.info(`\n${chalk.green(path)}`)
  output.info(`Request Params:`)
  output.info(formatParams(params))

  const response = await withLoading('Making request...', async () =>
    api.post(path, params),
  )

  if (response.status >= 400) {
    output.warn(chalk.red(`[${response.status}]`))
    process.exitCode = 1
  } else {
    output.info(chalk.green(`[${response.status}]`))
  }

  output.data(selectResponsePayload(response.data, { responseKey }))

  return response
}

const formatParams = (params: Record<string, any>): string =>
  JSON.stringify(params, null, 2)
