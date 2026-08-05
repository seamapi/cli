import type { EventEmitter } from 'node:events'
import type { Key } from 'node:readline'

import {
  autocomplete,
  autocompleteMultiselect,
  confirm,
  isCancel,
  type Option,
  select,
  text,
} from '@clack/prompts'
import chalk from 'chalk'

import { NonInteractiveError, PromptCancelledError } from 'lib/errors.js'

export interface PromptChoice<Value> {
  label: string
  value: Value
  hint?: string | undefined
}

export interface PromptTextOptions {
  message: string
  placeholder?: string
  defaultValue?: string
  validate?: (value: string | undefined) => string | undefined
}

export interface PromptNumberOptions {
  message: string
  validate?: (value: number) => string | undefined
}

export interface PromptConfirmOptions {
  message: string
  initialValue?: boolean
  active?: string
  inactive?: string
}

export interface PromptSelectOptions<Value> {
  message: string
  choices: Array<PromptChoice<Value>>
}

/**
 * The terminal edge behind the prompt functions: whether questions can be
 * asked, and how to ask each kind.
 *
 * A test replaces this with an in-memory client (see
 * `memory-prompt.ts`) via {@link setPromptClient} — the code under
 * test keeps calling `promptText` and friends as usual.
 */
export interface PromptClient {
  canPrompt: () => boolean
  text: (options: PromptTextOptions) => Promise<string>
  number: (options: PromptNumberOptions) => Promise<number>
  confirm: (options: PromptConfirmOptions) => Promise<boolean>
  select: <Value>(options: PromptSelectOptions<Value>) => Promise<Value>
  autocomplete: <Value>(options: PromptSelectOptions<Value>) => Promise<Value>
  autocompleteMultiselect: <Value>(
    options: PromptSelectOptions<Value>,
  ) => Promise<Value[]>
}

/**
 * Note on a prompt message that dismissing it returns to the previous step.
 *
 * Only for prompts whose caller catches the dismissal: elsewhere it still
 * stops the CLI, and saying otherwise would mislead. The note goes in the
 * message because clack renders its own keyboard hints from a hardcoded list
 * that a caller cannot add to.
 */
export const withBackHint = (message: string): string =>
  `${message} ${chalk.dim('· Esc: go back')}`

/**
 * The arrow keypress an Emacs-style control keypress stands for, or
 * undefined for any other key: ctrl-p is up and ctrl-n is down.
 */
export const arrowKeyFor = (key: Key | undefined): Key | undefined => {
  if (key?.ctrl !== true || key.meta === true || key.shift === true) {
    return undefined
  }
  const base = { ctrl: false, meta: false, shift: false }
  if (key.name === 'p') return { ...base, name: 'up', sequence: '\x1B[A' }
  if (key.name === 'n') return { ...base, name: 'down', sequence: '\x1B[B' }
  return undefined
}

/**
 * Re-emit Emacs-style control keypresses as the arrow keys they stand for.
 *
 * Clack navigates on the readline key name, so a synthetic arrow keypress
 * moves the cursor in every prompt kind. Its own alias table cannot express
 * this: aliases match bare key names, unaware of ctrl, and are ignored by
 * prompts that track typed input, such as autocomplete.
 */
export const emitArrowKeyAliases = (input: EventEmitter): void => {
  input.on('keypress', (_char, key: Key | undefined) => {
    const arrowKey = arrowKeyFor(key)
    if (arrowKey !== undefined) input.emit('keypress', undefined, arrowKey)
  })
}

let arrowKeyAliasesInstalled = false

// Keypress events only flow while a prompt has stdin in raw mode, so the
// listener is inert the rest of the time and never holds the process open.
const installArrowKeyAliases = (): void => {
  if (arrowKeyAliasesInstalled) return
  arrowKeyAliasesInstalled = true
  emitArrowKeyAliases(process.stdin)
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

export class TerminalPromptClient implements PromptClient {
  /**
   * Prompts read raw keypresses and render an interface, so they need a
   * terminal on both ends: when stdin is a pipe or a file it holds request
   * params, not answers, and when stderr is redirected nobody sees the
   * question.
   */
  canPrompt = (): boolean =>
    process.stdin.isTTY === true && process.stderr.isTTY === true

  text = async (options: PromptTextOptions): Promise<string> => {
    installArrowKeyAliases()
    return unwrap(await text({ ...options, output }))
  }

  number = async (options: PromptNumberOptions): Promise<number> => {
    installArrowKeyAliases()
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

  confirm = async (options: PromptConfirmOptions): Promise<boolean> => {
    installArrowKeyAliases()
    return unwrap(await confirm({ ...options, output }))
  }

  select = async <Value>(options: PromptSelectOptions<Value>): Promise<Value> => {
    installArrowKeyAliases()
    return unwrap(
      await select<Value>({
        message: options.message,
        options: toOptions(options.choices),
        output,
      }),
    )
  }

  autocomplete = async <Value>(
    options: PromptSelectOptions<Value>,
  ): Promise<Value> => {
    installArrowKeyAliases()
    return unwrap(
      await autocomplete<Value>({
        message: options.message,
        options: toOptions(options.choices),
        // Search a list by any part of a name or hint, rather than only by
        // the label, which is all clack matches for itself.
        filter: searchChoices,
        output,
      }),
    )
  }

  autocompleteMultiselect = async <Value>(
    options: PromptSelectOptions<Value>,
  ): Promise<Value[]> => {
    installArrowKeyAliases()
    return unwrap(
      await autocompleteMultiselect<Value>({
        message: options.message,
        options: toOptions(options.choices),
        filter: searchChoices,
        output,
      }),
    )
  }
}

const terminalPromptClient = new TerminalPromptClient()

let client: PromptClient = terminalPromptClient

export const setPromptClient = (promptClient: PromptClient): void => {
  client = promptClient
}

export const resetPromptClient = (): void => {
  client = terminalPromptClient
}

/** Whether the CLI can ask the user a question. */
export const canPrompt = (): boolean => client.canPrompt()

const ensureInteractive = (): void => {
  if (!client.canPrompt()) {
    throw new NonInteractiveError(
      'Cannot prompt without a terminal: pass the missing arguments, or pipe them in as JSON',
    )
  }
}

export const promptText = async (
  options: PromptTextOptions,
): Promise<string> => {
  ensureInteractive()
  return await client.text(options)
}

export const promptNumber = async (
  options: PromptNumberOptions,
): Promise<number> => {
  ensureInteractive()
  return await client.number(options)
}

export const promptConfirm = async (
  options: PromptConfirmOptions,
): Promise<boolean> => {
  ensureInteractive()
  return await client.confirm(options)
}

export const promptSelect = async <Value>(
  options: PromptSelectOptions<Value>,
): Promise<Value> => {
  ensureInteractive()
  return await client.select(options)
}

export const promptAutocomplete = async <Value>(
  options: PromptSelectOptions<Value>,
): Promise<Value> => {
  ensureInteractive()
  return await client.autocomplete(options)
}

export const promptAutocompleteMultiselect = async <Value>(
  options: PromptSelectOptions<Value>,
): Promise<Value[]> => {
  ensureInteractive()
  return await client.autocompleteMultiselect(options)
}

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
