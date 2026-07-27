import { getOpenapiSchema } from "@seamapi/http/connect"
import { createBlueprint, type Blueprint } from "@seamapi/blueprint"
import * as seamTypes from "@seamapi/types/connect"
import { getServer } from "./get-server"

export type ApiBlueprint = Blueprint

export const getApiBlueprint = async (
  useRemoteDefinitions: boolean
): Promise<ApiBlueprint> => {
  const typesModule = useRemoteDefinitions
    ? { ...seamTypes, openapi: await getOpenapiSchema(getServer()) }
    : seamTypes

  return createBlueprint(typesModule, { omitUndocumented: true })
}
