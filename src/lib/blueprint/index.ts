import type { Blueprint } from '@seamapi/blueprint'

import { getBlueprint } from './source-npm.js'
import { createRemoteBlueprint } from './source-remote.js'

export type ApiBlueprint = Blueprint

export interface GetApiBlueprintOptions {
  update?: boolean
}

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
  options: GetApiBlueprintOptions = {},
): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the server is currently running, so
  // build them directly from the server's OpenAPI document.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  return await getBlueprint(options)
}
