import type { Blueprint } from '@seamapi/blueprint'
import type * as SeamTypes from '@seamapi/types/connect'

import getBlueprint from './blueprint.js'
import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the server is currently running, so
  // they are always built from the live schema.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  return await getBlueprint()
}

const createRemoteBlueprint = async (): Promise<Blueprint> => {
  const [seamTypes, { createBlueprint }, { getOpenapiSchema }] =
    await Promise.all([
      importSeamTypes(),
      import('@seamapi/blueprint'),
      import('@seamapi/http/connect'),
    ])

  const openapi = await getOpenapiSchema(getServer())

  return await createBlueprint(
    { ...seamTypes, openapi },
    { omitUndocumented: true },
  )
}

// @seamapi/types is an optional peer dependency: it is only needed when remote
// definitions are enabled. The default blueprint is embedded in the package.
const importSeamTypes = async (): Promise<typeof SeamTypes> => {
  try {
    return await import('@seamapi/types/connect')
  } catch {
    throw new Error(
      'Remote API definitions require @seamapi/types, which is not installed. Install it alongside the CLI or disable remote API definitions.',
    )
  }
}
