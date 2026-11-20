import { getSeam } from 'lib/http/client.js'

import { interactForResource } from './resource.js'
export const interactForConnectedAccount = async (initialValue?: string) => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'connected_account',
    fetchResources: () => seam.connectedAccounts.list(),
    initialValue,
    toChoice: (connectedAccount) => {
      return {
        title: connectedAccount.display_name || '<No Name>',
        value: connectedAccount.connected_account_id,
        description: `${connectedAccount.account_type} ${connectedAccount.connected_account_id}`,
      }
    },
  })
}
