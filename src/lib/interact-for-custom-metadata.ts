import { getOutput } from './output/get-output.js'
import { prompt } from './util/prompt.js'

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

    const response = await prompt({
      type: 'select',
      name: 'action',
      message: 'Choose an action:',
      choices: [
        { title: 'Add an item to params', value: 'add' },
        { title: 'Remove an item from params', value: 'remove' },
        { title: 'Finish editing params', value: 'done' },
      ],
    })

    action = response.action

    if (action === 'add') {
      const { newKey } = await prompt({
        type: 'text',
        name: 'newKey',
        message: 'Enter a key to add or edit:',
      })

      let { newValue } = await prompt({
        type: 'text',
        name: 'newValue',
        message: 'Enter the new value to add or edit (or null to delete):',
      })
      if (newKey) {
        if (newValue === 'false' || newValue === 'true') {
          newValue = Boolean(newValue)
        }
        if (newValue === 'null') {
          updatedCustomMetadata[newKey] = null
        } else {
          updatedCustomMetadata[newKey] = newValue
        }
      }
    } else if (action === 'remove') {
      const { customKeyToRemove } = await prompt({
        type: 'select',
        name: 'customKeyToRemove',
        message: 'Choose a key-value pair to remove from params:',
        choices: Object.keys(updatedCustomMetadata).map((customMetadataKey) => {
          return {
            title: `${customMetadataKey}: ${updatedCustomMetadata[customMetadataKey]}`,
            value: customMetadataKey,
          }
        }),
      })

      if (customKeyToRemove) {
        delete customMetadata[customKeyToRemove]
      }
    }
  } while (action !== 'done')

  return updatedCustomMetadata
}
