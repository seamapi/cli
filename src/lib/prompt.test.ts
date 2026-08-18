import { EventEmitter } from 'node:events'
import type { Key } from 'node:readline'

import { expect, test } from 'vitest'

import {
  arrowKeyFor,
  emitArrowKeyAliases,
  offeredValue,
  offeredValues,
  type SearchableChoice,
  searchChoices,
} from 'lib/prompt.js'

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
  const endpoints = [
    { label: 'http://localhost:3020' },
    { label: 'https://connect.getseam.com' },
  ]

  expect(search('seam', endpoints)).toEqual([endpoints[1]])
})

test('searchChoices: offers every choice until something is typed', () => {
  expect(search('', workspaces)).toEqual(workspaces)
  expect(search('  ', workspaces)).toEqual(workspaces)
})

const ctrl = (name: string): Key => ({
  name,
  ctrl: true,
  meta: false,
  shift: false,
  sequence: String.fromCharCode(name.charCodeAt(0) - 96),
})

test('arrowKeyFor: maps ctrl-p and ctrl-n to the arrow keys', () => {
  expect(arrowKeyFor(ctrl('p'))?.name).toBe('up')
  expect(arrowKeyFor(ctrl('n'))?.name).toBe('down')
})

test('arrowKeyFor: leaves every other key alone', () => {
  expect(arrowKeyFor(undefined)).toBeUndefined()
  expect(arrowKeyFor(ctrl('c'))).toBeUndefined()
  expect(arrowKeyFor({ name: 'p', sequence: 'p' })).toBeUndefined()
  expect(arrowKeyFor({ name: 'n', sequence: 'n' })).toBeUndefined()
  expect(arrowKeyFor({ ...ctrl('p'), meta: true })).toBeUndefined()
  expect(arrowKeyFor({ ...ctrl('n'), shift: true })).toBeUndefined()
  expect(arrowKeyFor({ name: 'up', sequence: '\x1B[A' })).toBeUndefined()
})

test('emitArrowKeyAliases: re-emits control keypresses as arrow keys', () => {
  const input = new EventEmitter()
  emitArrowKeyAliases(input)

  const keypresses: Array<[string | undefined, Key | undefined]> = []
  input.on('keypress', (char, key) => keypresses.push([char, key]))

  input.emit('keypress', '\x10', ctrl('p'))
  input.emit('keypress', 'a', { name: 'a', sequence: 'a' })

  // The synthetic arrow key arrives first: the re-emit is synchronous,
  // and the alias listener runs before any listener attached after it.
  expect(keypresses).toEqual([
    [
      undefined,
      {
        name: 'up',
        ctrl: false,
        meta: false,
        shift: false,
        sequence: '\x1B[A',
      },
    ],
    ['\x10', ctrl('p')],
    ['a', { name: 'a', sequence: 'a' }],
  ])
})

const choices = [
  { label: 'Sandbox', value: 'ws_1' },
  { label: 'Production', value: 'ws_2' },
]

test('offeredValue: keeps a value the list offers', () => {
  expect(offeredValue(choices, 'ws_2')).toBe('ws_2')
})

// A value can come from an argument naming something the list does not hold:
// a deleted device, or a resource on another page of results.
test('offeredValue: drops a value the list does not offer', () => {
  expect(offeredValue(choices, 'ws_3')).toBeUndefined()
  expect(offeredValue(choices, undefined)).toBeUndefined()
  expect(offeredValue([], 'ws_1')).toBeUndefined()
})

test('offeredValues: keeps only the values the list offers', () => {
  expect(offeredValues(choices, ['ws_3', 'ws_1'])).toEqual(['ws_1'])
  expect(offeredValues(choices, undefined)).toEqual([])
})
