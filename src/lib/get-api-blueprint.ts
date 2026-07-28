import { type Blueprint, createBlueprint } from '@seamapi/blueprint'
import { getOpenapiSchema } from '@seamapi/http/connect'
import * as seamTypes from '@seamapi/types/connect'

import { getServer } from './get-server.js'

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean,
): Promise<ApiBlueprint> => {
  const typesModule = useRemoteDefinitions
    ? { ...seamTypes, openapi: await getOpenapiSchema(getServer()) }
    : seamTypes

  return createBlueprint(typesModule, { omitUndocumented: true })
}
