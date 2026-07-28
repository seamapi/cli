import { getCommandBlueprintDef } from './get-command-blueprint-def.js'
import { interactForBlueprintObject } from './interact-for-blueprint-object.js'
import type { ContextHelpers } from './types.js'

export const interactForCommandParams = async (
  args: {
    command: string[]
    params: Record<string, any>
  },
  ctx: ContextHelpers,
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
