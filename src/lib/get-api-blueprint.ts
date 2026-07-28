import type { Blueprint } from '@seamapi/blueprint'

import getBlueprint from './blueprint.js'
import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the server is currently running, so
  // build them directly from the server's OpenAPI document. This runtime path
  // does not load @seamapi/types.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  return await getBlueprint()
}

const createRemoteBlueprint = async (): Promise<Blueprint> => {
  const [{ createBlueprint }, { getOpenapiSchema }] = await Promise.all([
    import('@seamapi/blueprint'),
    import('@seamapi/http/connect'),
  ])
  const openapi = await getOpenapiSchema(getServer())

  return await createBlueprint({ openapi }, { omitUndocumented: true })
}
