import prompts, { type Answers, type Options, type PromptObject } from 'prompts'

/**
 * Whether the CLI can ask the user a question.
 *
 * Prompts read raw keypresses, so they need a terminal on stdin:
 * when stdin is a pipe or a file it holds request params, not answers.
 */
export const canPrompt = (): boolean => process.stdin.isTTY === true

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
    throw new Error(
      'Cannot prompt because stdin is not a terminal. Pass params as flags or pipe them in as JSON.',
    )
  }

  const questionList = Array.isArray(questions) ? questions : [questions]

  return await prompts(
    questionList.map((question) => ({ ...question, stdout: process.stderr })),
    options,
  )
}
