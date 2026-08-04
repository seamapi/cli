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
    questionList.map((question) => ({
      ...question,
      // Search a list by any part of a name, rather than only by what it
      // starts with, which is all prompts does for itself.
      ...(question.type === 'autocomplete' && question.suggest == null
        ? { suggest: searchChoices }
        : {}),
      stdout: process.stderr,
    })),
    options,
  )
}

export interface SearchableChoice {
  title?: string | undefined
  description?: string | undefined
}

/**
 * Filter choices by every whitespace separated term of the input, matched
 * case insensitively against the title and the description.
 */
export const searchChoices = async <Choice extends SearchableChoice>(
  input: string,
  choices: Choice[],
): Promise<Choice[]> => {
  const terms = input
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0)

  if (terms.length === 0) return choices

  return choices.filter((choice) => {
    const searchable = `${choice.title ?? ''} ${choice.description ?? ''}`
      .toLowerCase()
      .trim()
    return terms.every((term) => searchable.includes(term))
  })
}
