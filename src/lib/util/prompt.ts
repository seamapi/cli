import {
  autocomplete,
  autocompleteMultiselect,
  confirm,
  isCancel,
  type Option,
  select,
  text,
} from '@clack/prompts'

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

/** The user dismissed a prompt with ctrl-c or escape instead of answering. */
export class PromptCancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

export interface PromptChoice<Value> {
  label: string
  value: Value
  hint?: string | undefined
}

const ensureInteractive = (): void => {
  if (!canPrompt()) {
    throw new NonInteractiveError(
      'Cannot prompt without a terminal: pass the missing arguments, or pipe them in as JSON',
    )
  }
}

const unwrap = <Value>(value: Value | symbol): Value => {
  if (isCancel(value)) throw new PromptCancelledError()
  return value as Value
}

// Prompts are rendered to stderr: a selection is not a command result,
// so it must not end up in stdout when the CLI is piped.
const output = process.stderr

const toOptions = <Value>(
  choices: Array<PromptChoice<Value>>,
): Array<Option<Value>> =>
  choices.map(
    ({ label, value, hint }) =>
      (hint === undefined
        ? { label, value }
        : { label, value, hint }) as Option<Value>,
  )

export const promptText = async (options: {
  message: string
  placeholder?: string
  defaultValue?: string
  validate?: (value: string | undefined) => string | undefined
}): Promise<string> => {
  ensureInteractive()
  return unwrap(await text({ ...options, output }))
}

export const promptNumber = async (options: {
  message: string
  validate?: (value: number) => string | undefined
}): Promise<number> => {
  ensureInteractive()
  const value = unwrap(
    await text({
      message: options.message,
      validate: (value) => {
        if (value == null || value.trim() === '') return 'Enter a number'
        const parsed = Number(value)
        if (Number.isNaN(parsed)) return 'Enter a number'
        return options.validate?.(parsed)
      },
      output,
    }),
  )
  return Number(value)
}

export const promptConfirm = async (options: {
  message: string
  initialValue?: boolean
  active?: string
  inactive?: string
}): Promise<boolean> => {
  ensureInteractive()
  return unwrap(await confirm({ ...options, output }))
}

export const promptSelect = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
}): Promise<Value> => {
  ensureInteractive()
  return unwrap(
    await select<Value>({
      message: options.message,
      options: toOptions(options.choices),
      output,
    }),
  )
}

export const promptAutocomplete = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
}): Promise<Value> => {
  ensureInteractive()
  return unwrap(
    await autocomplete<Value>({
      message: options.message,
      options: toOptions(options.choices),
      output,
    }),
  )
}

export const promptAutocompleteMultiselect = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
}): Promise<Value[]> => {
  ensureInteractive()
  return unwrap(
    await autocompleteMultiselect<Value>({
      message: options.message,
      options: toOptions(options.choices),
      output,
    }),
  )
}
