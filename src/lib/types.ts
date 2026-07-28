import type { ApiBlueprint } from './get-api-blueprint.js'

export interface ContextHelpers {
  blueprint: ApiBlueprint
  is_interactive: boolean
}
