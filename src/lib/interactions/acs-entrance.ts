import { getSeam } from 'lib/http/client.js'

import { interactForResource } from './resource.js'

export const interactForAcsEntrance = async (initialValue?: string) => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'ACS entrance',
    fetchResources: () => seam.acs.entrances.list(),
    initialValue,
    toChoice: (entrance) => ({
      title: entrance.display_name ?? '<No Name>',
      value: entrance.acs_entrance_id,
      description: entrance.acs_entrance_id,
    }),
  })
}
