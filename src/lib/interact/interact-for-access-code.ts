import { getSeam } from '../http/client.js'
import { interactForDevice } from './interact-for-device.js'
import { interactForResource } from './interact-for-resource.js'

export const interactForAccessCode = async ({
  // The key is a Seam API parameter name: callers pass the blueprint params
  // bag through as-is, so only the binding may be camelCase.
  device_id: deviceId,
}: {
  device_id?: string
}) => {
  const seam = await getSeam()

  if (!deviceId) {
    deviceId = await interactForDevice()
  }

  return interactForResource({
    resourceName: 'access_code',
    fetchResources: () => seam.accessCodes.list({ device_id: deviceId }),
    toChoice: (accessCode) => ({
      title: accessCode.name ?? '<No Name>',
      value: accessCode.access_code_id,
      description: `${accessCode.type} ${accessCode.access_code_id}`,
    }),
  })
}
