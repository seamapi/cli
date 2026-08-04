import { expect, test } from 'vitest'

import { type SearchableChoice, searchChoices } from './prompt.js'

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
