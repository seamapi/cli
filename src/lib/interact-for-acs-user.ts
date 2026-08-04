import { getSeam } from './get-seam.js'
import { interactForAcsSystem } from './interact-for-acs-system.js'
import { interactForResource } from './interact-for-resource.js'

export const interactForAcsUser = async () => {
  const seam = await getSeam()

  const acsSystemId = await interactForAcsSystem(
    'What acs_system does the acs_user belong to?',
  )

  return interactForResource({
    resourceName: 'ACS user',
    fetchResources: () => seam.acs.users.list({ acs_system_id: acsSystemId }),
    toChoice: (user) => ({
      title: `${user.display_name} ${user.email_address}`,
      value: user.acs_user_id,
      description: user.acs_user_id,
    }),
  })
}
