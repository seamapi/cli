import type { Blueprint } from '@seamapi/blueprint'
import type * as SeamTypes from '@seamapi/types/connect'

import { blueprintFileName, readBlueprintFile } from './blueprint-file.js'
import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the server is currently running, so
  // they are always built from the live schema.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  const file = await readBlueprintFile()
  if (file != null) return file.blueprint

  return await createLocalBlueprint()
}

// The published package ships a generated blueprint.json, so @seamapi/types is
// not a runtime dependency: evaluating its API definitions and building the
// blueprint is what made startup slow. This path only runs in a working copy
// where blueprint.json has not been generated yet.
const createLocalBlueprint = async (): Promise<Blueprint> => {
  const [seamTypes, { createBlueprint }] = await Promise.all([
    importSeamTypes(),
    import('@seamapi/blueprint'),
  ])

  return await createBlueprint(seamTypes, { omitUndocumented: true })
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

// @seamapi/types is an optional peer dependency: it is only needed to build a
// blueprint, which the published package does not do for the default path.
const importSeamTypes = async (): Promise<typeof SeamTypes> => {
  try {
    return await import('@seamapi/types/connect')
  } catch {
    throw new Error(
      `Building an API blueprint requires @seamapi/types, which is not installed. Install it alongside the CLI, or use the ${blueprintFileName} generated at build time.`,
    )
  }
}
