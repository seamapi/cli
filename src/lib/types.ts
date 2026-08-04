import type { Interactivity } from './args/parse.js'
import type { ApiBlueprint } from './get-api-blueprint.js'

export interface ContextHelpers {
  blueprint: ApiBlueprint
  interactivity: Interactivity
}
