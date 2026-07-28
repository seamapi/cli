import { prompt } from './util/prompt.js'
export const interactForTimestamp = async () => {
  const { timestamp } = await prompt({
    name: 'timestamp',
    type: 'date',
    message: 'Enter a timestamp:',
  })

  return timestamp.toISOString()
}
