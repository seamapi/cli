import prompts, { type Answers, type Options, type PromptObject } from 'prompts'

import { NonInteractiveError } from './cli-args.js'

/**
 * Whether the CLI can ask the user a question.
 *
 * Prompts read raw keypresses and render an interface, so they need a
 * terminal on both ends: when stdin is a pipe or a file it holds request
 * params, not answers, and when stderr is redirected nobody sees the
 * question.
 */
export const canPrompt = (): boolean =>
  process.stdin.isTTY === true && process.stderr.isTTY === true

/**
 * Ask the user a question.
 *
 * Prompts are rendered to stderr: a selection is not a command result,
 * so it must not end up in stdout when the CLI is piped.
 */
export const prompt = async <T extends string = string>(
  questions: PromptObject<T> | Array<PromptObject<T>>,
  options?: Options,
): Promise<Answers<T>> => {
  if (!canPrompt()) {
    throw new NonInteractiveError(
      'Cannot prompt without a terminal: pass the missing arguments, or pipe them in as JSON',
    )
  }

  const questionList = Array.isArray(questions) ? questions : [questions]

  return await prompts(
    questionList.map((question) => ({ ...question, stdout: process.stderr })),
    options,
  )
}
