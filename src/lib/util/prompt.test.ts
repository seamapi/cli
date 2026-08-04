import { expect, test } from 'vitest'

import { searchChoices } from './prompt.js'

const workspaces = [
  { title: 'Sandbox', description: 'ws_1' },
  { title: 'Production Europe', description: 'ws_2' },
  { title: 'Production US', description: 'ws_3' },
]

test('searchChoices: matches every term against the title and description', async () => {
  await expect(searchChoices('prod us', workspaces)).resolves.toEqual([
    workspaces[2],
  ])
  await expect(searchChoices('WS_1', workspaces)).resolves.toEqual([
    workspaces[0],
  ])
  await expect(searchChoices('nope', workspaces)).resolves.toEqual([])
})

test('searchChoices: matches any part of a name, not only its start', async () => {
  const servers = [
    { title: 'http://localhost:3020' },
    { title: 'https://connect.getseam.com' },
    { title: 'https://fakeseamconnect.seam.vc' },
  ]

  await expect(searchChoices('fake', servers)).resolves.toEqual([servers[2]])
})

test('searchChoices: offers every choice until something is typed', async () => {
  await expect(searchChoices('', workspaces)).resolves.toEqual(workspaces)
  await expect(searchChoices('  ', workspaces)).resolves.toEqual(workspaces)
})
