import { getSeam } from "./get-seam"
import { interactForResource } from "./interact-for-resource"

export const interactForAcsSystem = async (message?: string) => {
  const seam = await getSeam()

  return interactForResource({
    resourceName: "ACS system",
    fetchResources: () => seam.acs.systems.list(),
    message,
    toChoice: (system) => ({
      title: `${system.name} ${system.external_type_display_name}`,
      value: system.acs_system_id,
      description: system.acs_system_id,
    }),
  })
}
