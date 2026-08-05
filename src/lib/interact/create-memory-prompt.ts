import { PromptCancelledError } from '../errors.js'
import type {
  PromptChoice,
  PromptClient,
  PromptConfirmOptions,
  PromptNumberOptions,
  PromptSelectOptions,
  PromptTextOptions,
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

  text = async ({ message }: PromptTextOptions): Promise<string> =>
    this.answer({ kind: 'text', message }) as string

  number = async ({ message }: PromptNumberOptions): Promise<number> =>
    this.answer({ kind: 'number', message }) as number

  confirm = async ({ message }: PromptConfirmOptions): Promise<boolean> =>
    this.answer({ kind: 'confirm', message }) as boolean

  select = async <Value>({
    message,
    choices,
  }: PromptSelectOptions<Value>): Promise<Value> =>
    this.answer({ kind: 'select', message, choices }) as Value

  autocomplete = async <Value>({
    message,
    choices,
  }: PromptSelectOptions<Value>): Promise<Value> =>
    this.answer({ kind: 'autocomplete', message, choices }) as Value

  autocompleteMultiselect = async <Value>({
    message,
    choices,
  }: PromptSelectOptions<Value>): Promise<Value[]> =>
    this.answer({
      kind: 'autocompleteMultiselect',
      message,
      choices,
    }) as Value[]

  private answer(question: PromptQuestion): unknown {
    this.questions.push(question)
    if (this.answers.length === 0) throw new PromptCancelledError()
    const value = this.answers.shift()
    if (value === cancelPrompt) throw new PromptCancelledError()
    return value
  }
}

export const createMemoryPrompt = (script: unknown[] = []): MemoryPromptClient =>
  new MemoryPromptClient(script)
