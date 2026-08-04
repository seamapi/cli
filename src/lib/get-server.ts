import { getConfigStore } from './config/index.js'
import { getEndpointFromEnv } from './env.js'

const defaultServer = 'https://connect.getseam.com'

/**
 * The Seam API server requests are made against.
 *
 * `SEAM_CLI_ENDPOINT` wins over the server stored by `seam select server`.
 */
export const getServer = (): string => {
  const endpoint = getEndpointFromEnv()
  if (endpoint != null) return endpoint

  const config = getConfigStore()

  const server = config.get('server')

  return typeof server === 'string' ? server : defaultServer
}
