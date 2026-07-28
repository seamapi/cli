import { createSpinner } from 'nanospinner'

import { getOutput } from 'lib/output/get-output.js'

export const withLoading = async <T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> => {
  if (!shouldSpin()) return await fn()

  // Progress is not a command result, so it is rendered to stderr.
  const spinner = createSpinner(message, { stream: process.stderr }).start()
  try {
    const result = await fn()
    spinner.success()
    return result
  } catch (error) {
    spinner.error()
    throw error
  }
}

const shouldSpin = (): boolean =>
  getOutput().format === 'text' && process.stderr.isTTY === true
