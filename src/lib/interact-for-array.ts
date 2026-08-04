import { getOutput } from './output/get-output.js'
import { promptNumber, promptSelect, promptText } from './util/prompt.js'

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

    action = await promptSelect({
      message: 'Choose an action:',
      choices: [
        { label: 'Add an item', value: 'add' },
        { label: 'Remove an item', value: 'remove' },
        { label: 'Finish editing', value: 'done' },
      ],
    })

    if (action === 'add') {
      const newItem = await promptText({
        message: 'Enter the new item:',
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
      })
      updatedArray.splice(index - 1, 1)
    }
  } while (action !== 'done')

  return updatedArray
}
