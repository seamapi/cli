import type { Blueprint } from '@seamapi/blueprint'

import { resolveAuth } from 'lib/context.js'

/**
 * Build a blueprint from the OpenAPI document the current endpoint is running,
 * describing exactly what that endpoint accepts rather than what is published.
 */
export const createRemoteBlueprint = async (): Promise<Blueprint> => {
  const [{ createBlueprint }, { getOpenapiSchema }] = await Promise.all([
    import('@seamapi/blueprint'),
    import('@seamapi/http/connect'),
  ])
  const openapi = await getOpenapiSchema(resolveAuth().endpoint)

  return await createBlueprint({ openapi }, { omitUndocumented: true })
}
