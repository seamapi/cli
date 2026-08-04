import { promptText, withBackHint } from './prompt.js'

export const interactForTimestamp = async () => {
  const now = new Date().toISOString()
  const timestamp = await promptText({
    message: withBackHint('Enter a timestamp:'),
    placeholder: now,
    defaultValue: now,
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
