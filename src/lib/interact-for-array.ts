import { getOutput } from './output/get-output.js'
import {
  PromptBackError,
  promptNumber,
  promptSelect,
  promptText,
} from './util/prompt.js'

export const interactForArray = async (
  array: string[],
  message: string,
): Promise<string[]> => {
  const updatedArray = [...array]
  const output = getOutput()

  const displayList = () => {
    output.info(`${message} Current list:`)
    if (updatedArray.length > 0) {
      updatedArray.forEach((item, index) => {
        output.info(`${index + 1}: ${item}`)
      })
    } else {
      output.info('The list is currently empty.')
    }
  }

  let action: string
  do {
    displayList()

    try {
      action = await promptSelect({
        message: 'Choose an action:',
        choices: [
          { label: 'Add an item', value: 'add' },
          { label: 'Remove an item', value: 'remove' },
          { label: 'Finish editing', value: 'done' },
        ],
        allowBack: true,
      })
    } catch (error) {
      if (!(error instanceof PromptBackError)) throw error
      // Going back at the action menu finishes editing, keeping changes.
      break
    }

    try {
      if (action === 'add') {
        const newItem = await promptText({
          message: 'Enter the new item:',
          allowBack: true,
        })
        if (newItem) {
          updatedArray.push(newItem)
        }
      } else if (action === 'remove') {
        const index = await promptNumber({
          message: 'Enter the index of the item to remove:',
          validate: (value) =>
            value > 0 && value <= updatedArray.length
              ? undefined
              : 'Invalid index',
          allowBack: true,
        })
        updatedArray.splice(index - 1, 1)
      }
    } catch (error) {
      if (!(error instanceof PromptBackError)) throw error
      // Going back at an inner prompt returns to the action menu.
    }
  } while (action !== 'done')

  return updatedArray
}
