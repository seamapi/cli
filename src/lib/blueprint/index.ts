import type { Blueprint } from '@seamapi/blueprint'

import { getBlueprint } from './source-npm.js'
import { createRemoteBlueprint } from './source-remote.js'

export type ApiBlueprint = Blueprint

export interface GetApiBlueprintOptions {
  /**
   * Build from the OpenAPI document the configured endpoint is currently
   * running, instead of the published npm types.
   */
  useRemoteDefinitions?: boolean
  /** Force an update of the cached Seam API definitions. */
  update?: boolean
}

export const getApiBlueprint = async ({
  useRemoteDefinitions = false,
  update = false,
}: GetApiBlueprintOptions = {}): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the endpoint is currently running, so
  // build them directly from that endpoint's OpenAPI document.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  return await getBlueprint({ update })
}
