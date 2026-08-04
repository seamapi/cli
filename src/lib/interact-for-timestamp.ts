import { promptText } from './util/prompt.js'

export const interactForTimestamp = async () => {
  const now = new Date().toISOString()
  const timestamp = await promptText({
    message: 'Enter a timestamp:',
    placeholder: now,
    defaultValue: now,
    // Timestamps are only prompted for from the parameter editing flow,
    // which catches the back error and returns to its menu.
    allowBack: true,
    validate: (value) => {
      if (value == null || value === '') return undefined
      if (Number.isNaN(new Date(value).getTime())) {
        return `Enter a valid timestamp, e.g. ${now}`
      }
      return undefined
    },
  })

  return new Date(timestamp).toISOString()
}
