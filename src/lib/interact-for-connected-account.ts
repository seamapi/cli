import { getSeam } from './get-seam.js'
import { interactForResource } from './interact-for-resource.js'
export const interactForConnectedAccount = async () => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'connected_account',
    fetchResources: () => seam.connectedAccounts.list(),
    toChoice: (connectedAccount) => {
      const identifiers = Object.values(
        connectedAccount.user_identifier ?? {},
      ).filter((value): value is string => typeof value === 'string')

      return {
        title:
          connectedAccount.user_identifier?.email ??
          identifiers[0] ??
          '<No Name>',
        value: connectedAccount.connected_account_id,
        description: `${connectedAccount.account_type} ${connectedAccount.connected_account_id}`,
      }
    },
  })
}
