import {
  PromptCancelledError,
  type PromptChoice,
  type PromptClient,
  type PromptSelectOptions,
} from './prompt.js'

/** A question a {@link PromptClient} was asked, as a test sees it. */
export interface PromptQuestion {
  kind:
    | 'text'
    | 'number'
    | 'confirm'
    | 'select'
    | 'autocomplete'
    | 'autocompleteMultiselect'
  message: string
  choices?: Array<PromptChoice<unknown>>
}

/** Scripted in place of an answer to dismiss that prompt. */
export const cancelPrompt = Symbol('cancel-prompt')

export interface MemoryPrompt {
  client: PromptClient
  /** Every question asked, in order — assert on what the user was offered. */
  questions: PromptQuestion[]
}

/**
 * A real {@link PromptClient} that answers from a script instead of a
 * terminal, and records every question it was asked.
 *
 * Each ask consumes the next scripted answer in turn. Scripting
 * {@link cancelPrompt} dismisses that prompt, and an exhausted script
 * dismisses every prompt after it, exactly as a user cancelling would.
 */
export const createMemoryPrompt = (script: unknown[] = []): MemoryPrompt => {
  const questions: PromptQuestion[] = []
  const answers = [...script]

  const answer = (question: PromptQuestion): unknown => {
    questions.push(question)
    if (answers.length === 0) throw new PromptCancelledError()
    const value = answers.shift()
    if (value === cancelPrompt) throw new PromptCancelledError()
    return value
  }

  const client: PromptClient = {
    canPrompt: () => true,
    text: async ({ message }) => answer({ kind: 'text', message }) as string,
    number: async ({ message }) =>
      answer({ kind: 'number', message }) as number,
    confirm: async ({ message }) =>
      answer({ kind: 'confirm', message }) as boolean,
    select: async <Value>({ message, choices }: PromptSelectOptions<Value>) =>
      answer({ kind: 'select', message, choices }) as Value,
    autocomplete: async <Value>({
      message,
      choices,
    }: PromptSelectOptions<Value>) =>
      answer({ kind: 'autocomplete', message, choices }) as Value,
    autocompleteMultiselect: async <Value>({
      message,
      choices,
    }: PromptSelectOptions<Value>) =>
      answer({
        kind: 'autocompleteMultiselect',
        message,
        choices,
      }) as Value[],
  }

  return { client, questions }
}
