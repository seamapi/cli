import chalk from 'chalk'

import { getSeam } from 'lib/http/client.js'
import { getOutput } from 'lib/output/get-output.js'
import { selectResponsePayload } from 'lib/output/select-response-payload.js'

import { withLoading } from '../output/with-loading.js'

export interface RequestSeamApiOptions {
  path: string
  params: Record<string, any>
  /** Response key for the endpoint, used to trim the reported payload. */
  responseKey?: string | null | undefined
}

export const RequestSeamApi = async ({
  path,
  params,
  responseKey,
}: RequestSeamApiOptions) => {
  const seam = await getSeam()
  const output = getOutput()

  output.info(`\n${chalk.green(path)}`)
  output.info(`Request Params:`)
  output.info(formatParams(params))

  const response = await withLoading('Making request...', () =>
    seam.client.post(path, params, {
      validateStatus: () => true,
    }),
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
