import { afterEach, expect, test } from 'vitest'

import { createMemoryPrompt } from 'lib/interact/create-memory-prompt.js'
import { interactForCommandSelection } from 'lib/interact/interact-for-command-selection.js'
import { resetPromptClient, setPromptClient, withBackHint } from 'lib/interact/prompt.js'

afterEach(resetPromptClient)

const helpers = {
  interactivity: 'non-interactive',
  commands: [
    ['devices', 'get'],
    ['devices', 'list'],
    ['devices', 'unmanaged', 'list'],
  ],
} as const

test('interactForCommandSelection: resolves a complete command', async () => {
  await expect(
    interactForCommandSelection(['devices', 'list'], {
      ...helpers,
      commands: [...helpers.commands.map((path) => [...path])],
    }),
  ).resolves.toEqual(['devices', 'list'])
})

test('interactForCommandSelection: rejects an incomplete command when non-interactive', async () => {
  await expect(
    interactForCommandSelection(['devices'], {
      ...helpers,
      commands: [...helpers.commands.map((path) => [...path])],
    }),
  ).rejects.toThrowError(
    'Incomplete command "seam devices": expected one of list, get, unmanaged',
  )
})

test('interactForCommandSelection: rejects a missing command when non-interactive', async () => {
  await expect(
    interactForCommandSelection([], {
      ...helpers,
      commands: [...helpers.commands.map((path) => [...path])],
    }),
  ).rejects.toThrowError(/^Missing command: expected one of /)
})

const interactiveHelpers = () => ({
  ...helpers,
  interactivity: 'interactive' as const,
  commands: [...helpers.commands.map((path) => [...path])],
})

test('interactForCommandSelection: tells the user a sub-command menu can be left', async () => {
  const memoryPrompt = createMemoryPrompt(['list'])
  setPromptClient(memoryPrompt.client)

  await interactForCommandSelection(['devices'], interactiveHelpers())

  expect(memoryPrompt.questions[0]).toMatchObject({
    message: withBackHint('Select a command: /devices'),
  })
})

// Escape stops the CLI at the top level, so promising a way back would lie.
test('interactForCommandSelection: says nothing about going back at the top level', async () => {
  const memoryPrompt = createMemoryPrompt(['devices', 'list'])
  setPromptClient(memoryPrompt.client)

  await interactForCommandSelection([], interactiveHelpers())

  expect(memoryPrompt.questions[0]).toMatchObject({
    message: 'Select a command: /',
  })
})
