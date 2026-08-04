import { getCommandBlueprintDef } from './get-command-blueprint-def.js'
import type { ContextHelpers } from './types.js'

/**
 * The top level response key documented for a command,
 * e.g., `devices` for `seam devices list`.
 *
 * Returns null when the command is not in the blueprint,
 * or when it does not respond with a resource.
 */
export const getResponseKey = (
  command: string[],
  ctx: ContextHelpers,
): string | null => {
  let endpoint
  try {
    endpoint = getCommandBlueprintDef(command, ctx)
  } catch {
    return null
  }

  if (endpoint.response.responseType === 'void') return null

  return endpoint.response.responseKey
}
