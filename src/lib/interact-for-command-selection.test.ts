import { beforeEach, expect, test, vi } from 'vitest'

import { interactForCommandSelection } from './interact-for-command-selection.js'
import type { ContextHelpers } from './types.js'
import type * as PromptModule from './util/prompt.js'
import { promptAutocomplete, withBackHint } from './util/prompt.js'

vi.mock('./util/prompt.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PromptModule>()),
  promptAutocomplete: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(promptAutocomplete).mockReset()
})

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
} as unknown as ContextHelpers

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
} as unknown as ContextHelpers

test('interactForCommandSelection: tells the user a sub-command menu can be left', async () => {
  vi.mocked(promptAutocomplete).mockImplementationOnce(async () => 'list')

  await interactForCommandSelection(['devices'], interactiveCtx)

  expect(vi.mocked(promptAutocomplete).mock.calls[0]?.[0]).toMatchObject({
    message: withBackHint('Select a command: /devices'),
  })
})

// Escape stops the CLI at the top level, so promising a way back would lie.
test('interactForCommandSelection: says nothing about going back at the top level', async () => {
  vi.mocked(promptAutocomplete)
    .mockImplementationOnce(async () => 'devices')
    .mockImplementationOnce(async () => 'list')

  await interactForCommandSelection([], interactiveCtx)

  expect(vi.mocked(promptAutocomplete).mock.calls[0]?.[0]).toMatchObject({
    message: 'Select a command: /',
  })
})
