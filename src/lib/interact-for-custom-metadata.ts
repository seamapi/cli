import { getOutput } from './output/get-output.js'
import {
  PromptCancelledError,
  promptSelect,
  promptText,
} from './util/prompt.js'

// Structurally the CustomMetadata of @seamapi/types, spelled out here so the
// published declarations do not depend on a development-only package.
type CustomMetadata = Record<string, string | boolean>

type UpdatedCustomMetadata = {
  [x: string]: string | boolean | null
}

export const interactForCustomMetadata = async (
  customMetadata: CustomMetadata,
) => {
  const updatedCustomMetadata: UpdatedCustomMetadata = { ...customMetadata }
  const output = getOutput()

  const displayCurrentCustomMetadata = () => {
    output.info('custom_metadata:')
    if (Object.keys(updatedCustomMetadata).length > 0) {
      Object.keys(updatedCustomMetadata).forEach((key, index) => {
        output.info(`${index + 1}: ${key}: ${updatedCustomMetadata[key]}`)
      })
    } else {
      output.info('The custom metadata param is empty.')
    }
  }

  let action: string

  do {
    displayCurrentCustomMetadata()

    try {
      action = await promptSelect({
        message: 'Choose an action:',
        choices: [
          { label: 'Add an item to params', value: 'add' },
          { label: 'Remove an item from params', value: 'remove' },
          { label: 'Finish editing params', value: 'done' },
        ],
      })
    } catch (error) {
      if (!(error instanceof PromptCancelledError)) throw error
      // Dismissing the action menu finishes editing, keeping the changes.
      break
    }

    try {
      if (action === 'add') {
        const newKey = await promptText({
          message: 'Enter a key to add or edit:',
        })

        let newValue: string | boolean = await promptText({
          message: 'Enter the new value to add or edit (or null to delete):',
        })
        if (newKey) {
          if (newValue === 'false' || newValue === 'true') {
            newValue = newValue === 'true'
          }
          if (newValue === 'null') {
            updatedCustomMetadata[newKey] = null
          } else {
            updatedCustomMetadata[newKey] = newValue
          }
        }
      } else if (action === 'remove') {
        const customKeyToRemove = await promptSelect({
          message: 'Choose a key-value pair to remove from params:',
          choices: Object.keys(updatedCustomMetadata).map(
            (customMetadataKey) => {
              return {
                label: `${customMetadataKey}: ${updatedCustomMetadata[customMetadataKey]}`,
                value: customMetadataKey,
              }
            },
          ),
        })

        delete updatedCustomMetadata[customKeyToRemove]
      }
    } catch (error) {
      if (!(error instanceof PromptCancelledError)) throw error
      // Dismissing an inner prompt returns to the action menu.
    }
  } while (action !== 'done')

  return updatedCustomMetadata
}
