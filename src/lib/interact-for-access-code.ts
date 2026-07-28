import { getSeam } from './get-seam.js'
import { interactForDevice } from './interact-for-device.js'
import { interactForResource } from './interact-for-resource.js'

export const interactForAccessCode = async ({
  device_id,
}: {
  device_id?: string
}) => {
  const seam = await getSeam()

  if (!device_id) {
    device_id = await interactForDevice()
  }

  return interactForResource({
    resourceName: 'access_code',
    fetchResources: () => seam.accessCodes.list({ device_id }),
    toChoice: (accessCode) => ({
      title: accessCode.name ?? '<No Name>',
      value: accessCode.access_code_id,
      description: `${accessCode.type} ${accessCode.access_code_id}`,
    }),
  })
}
