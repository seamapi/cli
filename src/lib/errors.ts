import chalk from 'chalk'

import { EnvVarOverrideError } from './env.js'
import type { Output } from './output/create-output.js'

/**
 * Thrown when the CLI needs input it cannot prompt for.
 */
export class NonInteractiveError extends Error {
  override name = 'NonInteractiveError'
}

/**
 * Thrown when the user dismisses a prompt with ctrl-c or escape instead of
 * answering it.
 */
export class PromptCancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

/**
 * Thrown when the arguments do not name something the CLI can run.
 */
export class UsageError extends Error {
  override name = 'UsageError'

  /** What to run instead, reported after the message. */
  readonly hint: string

  constructor(message: string, { hint = '' }: { hint?: string } = {}) {
    super(message)
    this.hint = hint
  }
}

/**
 * Report a failure and set the exit code: usage mistakes read as one line
 * with a hint, environment overrides without a stack trace, and anything
 * else as an unexpected CLI error.
 */
export const reportErrorAndExit = (e: unknown, output: Output): void => {
  process.exitCode = 1

  if (e instanceof UsageError) {
    output.error(chalk.red(e.message))
    if (e.hint !== '') output.error(e.hint)
    return
  }

  if (e instanceof NonInteractiveError || e instanceof EnvVarOverrideError) {
    output.error(chalk.red(e.message))
    return
  }

  // Dismissing a prompt is the user stopping the CLI, not the CLI failing:
  // note it quietly, without the alarm of an error.
  if (e instanceof PromptCancelledError) {
    output.error(chalk.gray(e.message))
    return
  }

  const error = e instanceof Error ? e : new Error(String(e))
  output.error(chalk.red(`CLI Error: ${error.message}`))
  if (error.stack != null) output.error(chalk.gray(error.stack))
}
