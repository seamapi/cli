import type { Blueprint } from '@seamapi/blueprint'

import { readCachedBlueprint, writeCachedBlueprint } from './blueprint-cache.js'
import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  // Remote definitions can change without any package version changing, so
  // they are always built fresh.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  const cached = await readCachedBlueprint()
  if (cached != null) return cached

  const blueprint = await createLocalBlueprint()
  await writeCachedBlueprint(blueprint)

  return blueprint
}

// @seamapi/types and @seamapi/blueprint are imported dynamically so that a
// cache hit never pays to evaluate them: between them, loading the API
// definitions and building the Blueprint dominates CLI startup.
const createLocalBlueprint = async (): Promise<Blueprint> => {
  const [seamTypes, { createBlueprint }] = await Promise.all([
    import('@seamapi/types/connect'),
    import('@seamapi/blueprint'),
  ])

  return await createBlueprint(seamTypes, { omitUndocumented: true })
}

const createRemoteBlueprint = async (): Promise<Blueprint> => {
  const [seamTypes, { createBlueprint }, { getOpenapiSchema }] =
    await Promise.all([
      import('@seamapi/types/connect'),
      import('@seamapi/blueprint'),
      import('@seamapi/http/connect'),
    ])

  const openapi = await getOpenapiSchema(getServer())

  return await createBlueprint(
    { ...seamTypes, openapi },
    { omitUndocumented: true },
  )
}
