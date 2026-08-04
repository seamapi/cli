import type { ApiBlueprint } from './get-api-blueprint.js'
import type { Interactivity } from './util/cli-args.js'

export interface ContextHelpers {
  blueprint: ApiBlueprint
  interactivity: Interactivity
}
