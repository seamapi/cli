import { PassThrough } from 'node:stream'

import { afterEach, expect, test } from 'vitest'

import {
  promptAutocomplete,
  PromptBackError,
  PromptCancelledError,
  promptSelect,
  promptText,
  type SearchableChoice,
  searchChoices,
  setPromptIoForTesting,
} from './prompt.js'

const workspaces = [
  { label: 'Sandbox', hint: 'ws_1' },
  { label: 'Production Europe', hint: 'ws_2' },
  { label: 'Production US', hint: 'ws_3' },
]

const search = <Choice extends SearchableChoice>(
  input: string,
  choices: Choice[],
) => choices.filter((choice) => searchChoices(input, choice))

test('searchChoices: matches every term against the label and hint', () => {
  expect(search('prod us', workspaces)).toEqual([workspaces[2]])
  expect(search('WS_1', workspaces)).toEqual([workspaces[0]])
  expect(search('nope', workspaces)).toEqual([])
})

test('searchChoices: matches any part of a name, not only its start', () => {
  const servers = [
    { label: 'http://localhost:3020' },
    { label: 'https://connect.getseam.com' },
    { label: 'https://fakeseamconnect.seam.vc' },
  ]

  expect(search('fake', servers)).toEqual([servers[2]])
})

test('searchChoices: offers every choice until something is typed', () => {
  expect(search('', workspaces)).toEqual(workspaces)
  expect(search('  ', workspaces)).toEqual(workspaces)
})

// The tests below drive real clack prompts over fake terminal streams,
// writing the bytes a terminal in raw mode would send.

const fakeTerminal = (): PassThrough & {
  isTTY: boolean
  setRawMode: () => void
} => {
  const stdin = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: () => {},
  })
  const output = Object.assign(new PassThrough(), { isTTY: true })
  output.on('data', () => {})
  setPromptIoForTesting({ stdin, output })
  return stdin
}

afterEach(() => {
  setPromptIoForTesting({ stdin: process.stdin, output: process.stderr })
})

const choices = [
  { label: 'alpha', value: 'alpha' },
  { label: 'beta', value: 'beta' },
  { label: 'gamma', value: 'gamma' },
  { label: 'delta', value: 'delta' },
]

test('promptSelect: ctrl-n, ctrl-j, ctrl-p, and ctrl-k move the cursor', async () => {
  const stdin = fakeTerminal()
  const answer = promptSelect({ message: 'pick', choices })
  stdin.write('\x0E') // ctrl-n: beta
  stdin.write('\x0A') // ctrl-j: gamma
  stdin.write('\x0E') // ctrl-n: delta
  stdin.write('\x10') // ctrl-p: gamma
  stdin.write('\x0B') // ctrl-k: beta
  stdin.write('\r')
  expect(await answer).toBe('beta')
})

test('promptSelect: the right arrow submits the focused choice', async () => {
  const stdin = fakeTerminal()
  const answer = promptSelect({ message: 'pick', choices })
  stdin.write('\x0E')
  stdin.write('\x1B[C')
  expect(await answer).toBe('beta')
})

test('promptSelect: the left arrow goes back when allowed', async () => {
  const stdin = fakeTerminal()
  const answer = promptSelect({ message: 'pick', choices, allowBack: true })
  stdin.write('\x1B[D')
  await expect(answer).rejects.toBeInstanceOf(PromptBackError)
})

test('promptSelect: the left arrow does nothing without back support', async () => {
  const stdin = fakeTerminal()
  const answer = promptSelect({ message: 'pick', choices })
  stdin.write('\x1B[D')
  stdin.write('\r')
  expect(await answer).toBe('alpha')
})

test('promptSelect: escape still cancels', async () => {
  const stdin = fakeTerminal()
  const answer = promptSelect({ message: 'pick', choices })
  stdin.write('\x1B')
  await expect(answer).rejects.toBeInstanceOf(PromptCancelledError)
})

test('promptAutocomplete: ctrl-j navigates the matches without clearing the filter', async () => {
  const stdin = fakeTerminal()
  const answer = promptAutocomplete({ message: 'pick', choices })
  stdin.write('e') // filters to beta, delta
  stdin.write('\x0A') // ctrl-j: delta (gamma when the filter is lost)
  stdin.write('\r')
  expect(await answer).toBe('delta')
})

test('promptAutocomplete: the left arrow only goes back until a filter is typed', async () => {
  const stdin = fakeTerminal()
  const answer = promptAutocomplete({
    message: 'pick',
    choices,
    allowBack: true,
  })
  stdin.write('e')
  stdin.write('\x1B[D') // moves the caret instead of going back
  stdin.write('\x7F') // erase the filter
  stdin.write('\x1B[D')
  await expect(answer).rejects.toBeInstanceOf(PromptBackError)
})

test('promptText: left and right move the caret in typed text', async () => {
  const stdin = fakeTerminal()
  const answer = promptText({ message: 'value', allowBack: true })
  stdin.write('ac')
  stdin.write('\x1B[D')
  stdin.write('b')
  stdin.write('\r')
  expect(await answer).toBe('abc')
})

test('promptText: the left arrow goes back while nothing is typed', async () => {
  const stdin = fakeTerminal()
  const answer = promptText({ message: 'value', allowBack: true })
  stdin.write('\x1B[D')
  await expect(answer).rejects.toBeInstanceOf(PromptBackError)
})

test('prompts: sequential prompts each read the terminal in turn', async () => {
  const stdin = fakeTerminal()

  const first = promptSelect({ message: 'pick', choices })
  stdin.write('\x0E')
  stdin.write('\r')
  expect(await first).toBe('beta')

  const second = promptText({ message: 'value' })
  stdin.write('hello')
  stdin.write('\r')
  expect(await second).toBe('hello')
})
