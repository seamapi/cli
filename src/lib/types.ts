import { ApiBlueprint } from "./get-api-blueprint"

export interface ContextHelpers {
  blueprint: ApiBlueprint
  is_interactive: boolean
}
