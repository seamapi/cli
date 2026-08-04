import type { Writable } from 'node:stream'

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
import {
  attachPromptInput,
  type PromptInputKind,
  type PromptInputSource,
  type PromptInputStream,
} from './prompt-input.js'

interface PromptIo {
  stdin: PromptInputSource
  output: Writable & { isTTY?: boolean | undefined }
}

// Prompts are rendered to stderr: a selection is not a command result,
// so it must not end up in stdout when the CLI is piped.
let io: PromptIo = { stdin: process.stdin, output: process.stderr }

/** Redirect prompt IO to fake streams so tests can drive real prompts. */
export const setPromptIoForTesting = (overrides: PromptIo): void => {
  io = overrides
}

/**
 * Whether the CLI can ask the user a question.
 *
 * Prompts read raw keypresses and render an interface, so they need a
 * terminal on both ends: when stdin is a pipe or a file it holds request
 * params, not answers, and when stderr is redirected nobody sees the
 * question.
 */
export const canPrompt = (): boolean =>
  io.stdin.isTTY === true && io.output.isTTY === true

/** The user dismissed a prompt with ctrl-c or escape instead of answering. */
export class PromptCancelledError extends Error {
  constructor() {
    super('Cancelled')
  }
}

/**
 * The user pressed the left arrow to return to the previous prompt without
 * answering. Only prompts called with allowBack throw this, and their
 * callers are expected to catch it: one that escapes is a bug.
 */
export class PromptBackError extends Error {
  constructor() {
    super('Back')
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

const runPrompt = async <Value>(
  options: { kind: PromptInputKind; allowBack?: boolean | undefined },
  prompt: (input: PromptInputStream) => Promise<Value | symbol>,
): Promise<Value> => {
  ensureInteractive()
  const handle = attachPromptInput(
    { kind: options.kind, allowBack: options.allowBack ?? false },
    io.stdin,
  )
  try {
    const value = await prompt(handle.stream)
    if (isCancel(value)) {
      throw handle.wentBack()
        ? new PromptBackError()
        : new PromptCancelledError()
    }
    return value as Value
  } finally {
    handle.detach()
  }
}

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
  allowBack?: boolean
}): Promise<string> => {
  const { allowBack, ...textOptions } = options
  return await runPrompt(
    { kind: 'text', allowBack },
    async (input) => await text({ ...textOptions, input, output: io.output }),
  )
}

export const promptNumber = async (options: {
  message: string
  validate?: (value: number) => string | undefined
  allowBack?: boolean
}): Promise<number> => {
  const value = await runPrompt(
    { kind: 'text', allowBack: options.allowBack },
    async (input) =>
      await text({
        message: options.message,
        validate: (value) => {
          if (value == null || value.trim() === '') return 'Enter a number'
          const parsed = Number(value)
          if (Number.isNaN(parsed)) return 'Enter a number'
          return options.validate?.(parsed)
        },
        input,
        output: io.output,
      }),
  )
  return Number(value)
}

export const promptConfirm = async (options: {
  message: string
  initialValue?: boolean
  active?: string
  inactive?: string
}): Promise<boolean> =>
  await runPrompt(
    { kind: 'confirm' },
    async (input) => await confirm({ ...options, input, output: io.output }),
  )

export const promptSelect = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
  allowBack?: boolean
}): Promise<Value> =>
  await runPrompt(
    { kind: 'choice', allowBack: options.allowBack },
    async (input) =>
      await select<Value>({
        message: options.message,
        options: toOptions(options.choices),
        input,
        output: io.output,
      }),
  )

export const promptAutocomplete = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
  allowBack?: boolean
}): Promise<Value> =>
  await runPrompt(
    { kind: 'choice', allowBack: options.allowBack },
    async (input) =>
      await autocomplete<Value>({
        message: options.message,
        options: toOptions(options.choices),
        // Search a list by any part of a name or hint, rather than only by
        // the label, which is all clack matches for itself.
        filter: searchChoices,
        input,
        output: io.output,
      }),
  )

export const promptAutocompleteMultiselect = async <Value>(options: {
  message: string
  choices: Array<PromptChoice<Value>>
  allowBack?: boolean
}): Promise<Value[]> =>
  await runPrompt(
    { kind: 'choice', allowBack: options.allowBack },
    async (input) =>
      await autocompleteMultiselect<Value>({
        message: options.message,
        options: toOptions(options.choices),
        filter: searchChoices,
        input,
        output: io.output,
      }),
  )

export interface SearchableChoice {
  label?: string | undefined
  hint?: string | undefined
}

/**
 * Match a choice by every whitespace separated term of the input, matched
 * case insensitively against the label and the hint.
 */
export const searchChoices = (
  input: string,
  choice: SearchableChoice,
): boolean => {
  const terms = input
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0)

  if (terms.length === 0) return true

  const searchable = `${choice.label ?? ''} ${choice.hint ?? ''}`
    .toLowerCase()
    .trim()
  return terms.every((term) => searchable.includes(term))
}
