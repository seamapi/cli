import type { Blueprint } from '@seamapi/blueprint'

import { getBlueprint } from './source-npm.js'
import { createRemoteBlueprint } from './source-remote.js'

export type ApiBlueprint = Blueprint

export interface GetApiBlueprintOptions {
  /**
   * Build from the OpenAPI document the configured endpoint is currently
   * running, instead of the published npm types.
   */
  useRemoteSchema?: boolean
  /** Force an update of the cached Seam API schema. */
  update?: boolean
}

export const getApiBlueprint = async ({
  useRemoteSchema = false,
  update = false,
}: GetApiBlueprintOptions = {}): Promise<ApiBlueprint> => {
  // The remote schema describes whatever the endpoint is currently running, so
  // build it directly from that endpoint's OpenAPI document.
  if (useRemoteSchema) return await createRemoteBlueprint()

  return await getBlueprint({ update })
}
