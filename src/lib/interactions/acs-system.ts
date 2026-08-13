import { getSeam } from 'lib/http/client.js'

import { interactForResource } from './resource.js'

export const interactForAcsSystem = async ({
  message,
  initialValue,
}: {
  message?: string | undefined
  initialValue?: string | undefined
} = {}) => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'ACS system',
    fetchResources: () => seam.acs.systems.list(),
    message,
    initialValue,
    toChoice: (system) => ({
      title: `${system.name} ${system.external_type_display_name}`,
      value: system.acs_system_id,
      description: system.acs_system_id,
    }),
  })
}
