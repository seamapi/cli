import { PromptCancelledError } from 'lib/errors.js'
import type {
  PromptChoice,
  PromptClient,
  PromptConfirmOptions,
  PromptMultiselectOptions,
  PromptNumberOptions,
  PromptSelectOptions,
  PromptTextOptions,
} from 'lib/prompt.js'

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
  /** What the question was seeded with — what the user sees to edit. */
  initialValue?: unknown
  initialValues?: unknown[] | undefined
}

/** Scripted in place of an answer to dismiss that prompt. */
export const cancelPrompt = Symbol('cancel-prompt')

/**
 * A real {@link PromptClient} that answers from a script instead of a
 * terminal, and records every question it was asked.
 *
 * Each ask consumes the next scripted answer in turn. Scripting
 * {@link cancelPrompt} dismisses that prompt, and an exhausted script
 * dismisses every prompt after it, exactly as a user cancelling would.
 */
export class MemoryPromptClient implements PromptClient {
  /** Every question asked, in order — assert on what the user was offered. */
  readonly questions: PromptQuestion[] = []

  private readonly answers: unknown[]

  constructor(script: unknown[] = []) {
    this.answers = [...script]
  }

  canPrompt = (): boolean => true

  text = async ({
    message,
    initialValue,
  }: PromptTextOptions): Promise<string> =>
    this.answer({ kind: 'text', message, initialValue }) as string

  number = async ({
    message,
    initialValue,
  }: PromptNumberOptions): Promise<number> =>
    this.answer({ kind: 'number', message, initialValue }) as number

  confirm = async ({
    message,
    initialValue,
  }: PromptConfirmOptions): Promise<boolean> =>
    this.answer({ kind: 'confirm', message, initialValue }) as boolean

  select = async <Value>({
    message,
    choices,
    initialValue,
  }: PromptSelectOptions<Value>): Promise<Value> =>
    this.answer({ kind: 'select', message, choices, initialValue }) as Value

  autocomplete = async <Value>({
    message,
    choices,
    initialValue,
  }: PromptSelectOptions<Value>): Promise<Value> =>
    this.answer({
      kind: 'autocomplete',
      message,
      choices,
      initialValue,
    }) as Value

  autocompleteMultiselect = async <Value>({
    message,
    choices,
    initialValues,
  }: PromptMultiselectOptions<Value>): Promise<Value[]> =>
    this.answer({
      kind: 'autocompleteMultiselect',
      message,
      choices,
      initialValues,
    }) as Value[]

  private answer(question: PromptQuestion): unknown {
    this.questions.push(question)
    if (this.answers.length === 0) throw new PromptCancelledError()
    const value = this.answers.shift()
    if (value === cancelPrompt) throw new PromptCancelledError()
    return value
  }
}

export const createMemoryPrompt = (
  script: unknown[] = [],
): MemoryPromptClient => new MemoryPromptClient(script)
