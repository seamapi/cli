import prompts from "prompts"
import { withLoading } from "./util/with-loading"

export interface ResourceChoice {
  title: string
  value: string
  description?: string
}

export const interactForResource = async <Resource>({
  resourceName,
  fetchResources,
  toChoice,
  message = `Select a ${resourceName}:`,
}: {
  resourceName: string
  fetchResources: () => Promise<Resource[]>
  toChoice: (resource: Resource) => ResourceChoice
  message?: string
}) => {
  const resources = await withLoading(
    `Fetching ${resourceName.replace(/_/g, " ")}s...`,
    fetchResources
  )
  const { resourceId } = await prompts({
    name: "resourceId",
    type: "autocomplete",
    message,
    choices: resources.map(toChoice),
  })

  return resourceId as string
}
