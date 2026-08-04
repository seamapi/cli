import type { Blueprint } from '@seamapi/blueprint'

import getBlueprint from './blueprint.js'
import { getServer } from './get-server.js'

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

const createRemoteBlueprint = async (): Promise<Blueprint> => {
  const [{ createBlueprint }, { getOpenapiSchema }] = await Promise.all([
    import('@seamapi/blueprint'),
    import('@seamapi/http/connect'),
  ])
  const openapi = await getOpenapiSchema(getServer())

  return await createBlueprint({ openapi }, { omitUndocumented: true })
}
