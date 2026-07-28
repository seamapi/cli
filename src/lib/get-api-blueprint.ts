import { readFile } from 'node:fs/promises'

import type { Blueprint } from '@seamapi/blueprint'
import type * as SeamTypes from '@seamapi/types/connect'

import seamapiBlueprint from './blueprint.js'
import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  // Remote definitions describe whatever the server is currently running, so
  // they are always built from the live schema.
  if (useRemoteDefinitions) return await createRemoteBlueprint()

  if (seamapiBlueprint != null) return seamapiBlueprint

  return await readDevelopmentBlueprint()
}

const readDevelopmentBlueprint = async (): Promise<Blueprint> => {
  // This module runs from src/lib under tsx and from lib after a development
  // build. The packed module never takes this path because its blueprint is
  // injected by prepack.ts.
  const candidates = ['../../tmp/blueprint.json', '../tmp/blueprint.json']

  for (const candidate of candidates) {
    try {
      return JSON.parse(
        await readFile(new URL(candidate, import.meta.url), 'utf8'),
      ) as Blueprint
    } catch {
      // Try the path for the other execution mode.
    }
  }

  throw new Error(
    'Missing tmp/blueprint.json. Run `npm run generate:blueprint` to generate it.',
  )
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
