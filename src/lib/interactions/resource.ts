import { promptAutocomplete, withBackHint } from './prompt.js'
import { withLoading } from 'lib/output/with-loading.js'

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
    // Resource pickers are only reached from the parameter flow, which
    // returns to its menu when one is dismissed.
    message: withBackHint(message),
    choices: resources.map((resource) => {
      const { title, value, description } = toChoice(resource)
      return { label: title, value, hint: description }
    }),
  })
}
