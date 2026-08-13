import { promptText, withBackHint } from 'lib/prompt.js'

export const interactForTimestamp = async (currentValue?: string) => {
  const now = new Date().toISOString()
  const timestamp = await promptText({
    message: withBackHint('Enter a timestamp:'),
    placeholder: now,
    defaultValue: now,
    // A timestamp already given is offered for editing, rather than making
    // the user type it out again to shift it by an hour.
    initialValue: currentValue,
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
