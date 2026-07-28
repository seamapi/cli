import type { ContextHelpers } from './types.js'
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
