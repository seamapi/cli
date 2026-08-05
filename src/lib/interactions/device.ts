import { getSeam } from 'lib/http/client.js'

import { interactForResource } from './resource.js'
export const interactForDevice = async () => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: 'device',
    fetchResources: () => seam.devices.list(),
    toChoice: (device) => ({
      title: device.properties.name ?? '<No Name>',
      value: device.device_id,
      description: `${device.device_type} ${device.device_id}`,
    }),
  })
}
