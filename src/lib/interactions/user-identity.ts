import { getSeam } from 'lib/http/client.js'

import { interactForResource } from './resource.js'

export const interactForUserIdentity = async () => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'user_identity',
    fetchResources: () => seam.userIdentities.list(),
    toChoice: (userIdentity) => ({
      title: `${userIdentity.email_address} "${userIdentity.full_name}: ${userIdentity.user_identity_key}`,
      value: userIdentity.user_identity_id,
      description: userIdentity.user_identity_id,
    }),
  })
}
