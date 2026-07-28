import { getConfigStore } from './get-config-store.js'

export const getServer = (): string => {
  const config = getConfigStore()

  const server = config.get('server')

  return typeof server === 'string' ? server : 'https://connect.getseam.com'
}
