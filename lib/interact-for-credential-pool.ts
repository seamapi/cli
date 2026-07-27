import { getSeam } from "./get-seam"
import { interactForAcsSystem } from "./interact-for-acs-system"
import { interactForResource } from "./interact-for-resource"

export const interactForCredentialPool = async () => {
  const seam = await getSeam()

  const acs_system_id = await interactForAcsSystem(
    "What acs_system does the credential pool belong to?"
  )
  return interactForResource({
    resourceName: "ACS credential pool",
    fetchResources: () => seam.acs.credentialPools.list({ acs_system_id }),
    toChoice: (credentialPool) => ({
      title: `${credentialPool.display_name} ${credentialPool.external_type_display_name}`,
      value: credentialPool.acs_credential_pool_id,
      description: credentialPool.acs_credential_pool_id,
    }),
  })
}
