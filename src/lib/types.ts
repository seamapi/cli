import type { Interactivity } from './args/parse.js'
import type { ApiBlueprint } from './blueprint/index.js'

export interface ContextHelpers {
  blueprint: ApiBlueprint
  interactivity: Interactivity
}
