import { promptAutocomplete } from './util/prompt.js'
import { withLoading } from './util/with-loading.js'

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
  message?: string | undefined
}) => {
  const resources = await withLoading(
    `Fetching ${resourceName.replace(/_/g, ' ')}s...`,
    fetchResources,
  )
  return await promptAutocomplete({
    message,
    choices: resources.map((resource) => {
      const { title, value, description } = toChoice(resource)
      return { label: title, value, hint: description }
    }),
  })
}
