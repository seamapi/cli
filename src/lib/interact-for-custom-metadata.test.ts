import { beforeEach, expect, test, vi } from 'vitest'

import { interactForCustomMetadata } from './interact-for-custom-metadata.js'
import { createMemoryOutput } from './output/create-memory-output.js'
import { setOutput } from './output/get-output.js'
import { promptSelect, promptText } from './util/prompt.js'

vi.mock('./util/prompt.js', () => ({
  canPrompt: vi.fn(() => true),
  PromptCancelledError: class extends Error {},
  promptText: vi.fn(),
  promptNumber: vi.fn(),
  promptConfirm: vi.fn(),
  promptSelect: vi.fn(),
  promptAutocomplete: vi.fn(),
  promptAutocompleteMultiselect: vi.fn(),
}))

/** Queues answers in the order the editor asks for them. */
const answerSelects = (...values: string[]): void => {
  const queue = [...values]
  vi.mocked(promptSelect).mockImplementation(async () => queue.shift() as never)
}

const answerTexts = (...values: string[]): void => {
  const queue = [...values]
  vi.mocked(promptText).mockImplementation(async () => queue.shift() as never)
}

beforeEach(() => {
  vi.mocked(promptSelect).mockReset()
  vi.mocked(promptText).mockReset()
  setOutput(createMemoryOutput().output)
})

test('interactForCustomMetadata: adds a key and value', async () => {
  answerSelects('add', 'done')
  answerTexts('floor', '3')

  await expect(interactForCustomMetadata({})).resolves.toEqual({ floor: '3' })
})

test('interactForCustomMetadata: removes a key from the result', async () => {
  answerSelects('remove', 'floor', 'done')

  await expect(
    interactForCustomMetadata({ floor: '3', wing: 'east' }),
  ).resolves.toEqual({ wing: 'east' })
})

test('interactForCustomMetadata: leaves the given metadata unmodified', async () => {
  answerSelects('remove', 'floor', 'done')
  const customMetadata = { floor: '3', wing: 'east' }

  await interactForCustomMetadata(customMetadata)

  expect(customMetadata).toEqual({ floor: '3', wing: 'east' })
})

test.for([['true', true] as const, ['false', false] as const])(
  'interactForCustomMetadata: stores %s as a boolean',
  async ([given, stored]) => {
    answerSelects('add', 'done')
    answerTexts('enabled', given)

    await expect(interactForCustomMetadata({})).resolves.toEqual({
      enabled: stored,
    })
  },
)

test('interactForCustomMetadata: stores null for the null keyword', async () => {
  answerSelects('add', 'done')
  answerTexts('note', 'null')

  await expect(interactForCustomMetadata({})).resolves.toEqual({ note: null })
})
