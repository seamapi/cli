import { afterEach, expect, test } from 'vitest'

import type { CliContext } from '../context.js'
import { createMemoryPrompt } from './create-memory-prompt.js'
import { interactForCommandSelection } from './interact-for-command-selection.js'
import { resetPromptClient, setPromptClient, withBackHint } from './prompt.js'

afterEach(resetPromptClient)

const ctx = {
  interactivity: 'non-interactive',
  blueprint: {
    routes: [
      {
        endpoints: [
          { path: '/devices/get' },
          { path: '/devices/list' },
          { path: '/devices/unmanaged/list' },
        ],
      },
    ],
  },
} as unknown as CliContext

test('interactForCommandSelection: resolves a complete command', async () => {
  await expect(
    interactForCommandSelection(['devices', 'list'], ctx),
  ).resolves.toEqual(['devices', 'list'])
})

test('interactForCommandSelection: rejects an incomplete command when non-interactive', async () => {
  await expect(
    interactForCommandSelection(['devices'], ctx),
  ).rejects.toThrowError(
    'Incomplete command "seam devices": expected one of list, get, unmanaged',
  )
})

test('interactForCommandSelection: rejects a missing command when non-interactive', async () => {
  await expect(interactForCommandSelection([], ctx)).rejects.toThrowError(
    /^Missing command: expected one of /,
  )
})

const interactiveCtx = {
  ...ctx,
  interactivity: 'interactive',
} as unknown as CliContext

test('interactForCommandSelection: tells the user a sub-command menu can be left', async () => {
  const memoryPrompt = createMemoryPrompt(['list'])
  setPromptClient(memoryPrompt.client)

  await interactForCommandSelection(['devices'], interactiveCtx)

  expect(memoryPrompt.questions[0]).toMatchObject({
    message: withBackHint('Select a command: /devices'),
  })
})

// Escape stops the CLI at the top level, so promising a way back would lie.
test('interactForCommandSelection: says nothing about going back at the top level', async () => {
  const memoryPrompt = createMemoryPrompt(['devices', 'list'])
  setPromptClient(memoryPrompt.client)

  await interactForCommandSelection([], interactiveCtx)

  expect(memoryPrompt.questions[0]).toMatchObject({
    message: 'Select a command: /',
  })
})
