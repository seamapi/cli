import type { ContextHelpers } from '../types.js'

export const getCommandBlueprintDef = (
  cmd: string[],
  helpers: ContextHelpers,
) => {
  const path = `/${cmd.join('/').replace(/-/g, '_')}`
  const def = helpers.blueprint.routes
    .flatMap((route) => route.endpoints)
    .find((endpoint) => endpoint.path === path)
  if (!def) {
    throw new Error(`No definition for path ${path}`)
  }

  return def
}

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
