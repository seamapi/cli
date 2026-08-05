import { getSeam } from '../http/client.js'
import { interactForResource } from './interact-for-resource.js'

export const interactForAcsEntrance = async () => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'ACS entrance',
    fetchResources: () => seam.acs.entrances.list(),
    toChoice: (entrance) => ({
      title: entrance.display_name ?? '<No Name>',
      value: entrance.acs_entrance_id,
      description: entrance.acs_entrance_id,
    }),
  })
}
