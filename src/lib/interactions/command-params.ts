import { getCommandBlueprintDef } from 'lib/blueprint/endpoint.js'
import type { CliContext } from 'lib/context.js'

import { interactForBlueprintObject } from './blueprint-object.js'

export const interactForCommandParams = async (
  args: {
    command: string[]
    params: Record<string, any>
  },
  ctx: CliContext,
): Promise<any> => {
  const endpoint = getCommandBlueprintDef(args.command, ctx)

  return interactForBlueprintObject(
    {
      command: args.command,
      params: args.params,
      parameters: endpoint.request.parameters,
    },
    ctx,
  )
}
