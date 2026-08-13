import { afterEach, beforeEach, expect, test } from 'vitest'

import { interactForCustomMetadata } from 'lib/interactions/index.js'
import {
  createMemoryPrompt,
  type MemoryPromptClient,
  type PromptQuestion,
} from 'lib/memory-prompt.js'
import { setOutput } from 'lib/output/get-output.js'
import { createMemoryOutput } from 'lib/output/memory-output.js'
import { resetPromptClient, setPromptClient } from 'lib/prompt.js'

let memoryPrompt: MemoryPromptClient

/** Scripts an answer for each ask, in the order the editor asks. */
const scriptPrompt = (script: unknown[]): void => {
  memoryPrompt = createMemoryPrompt(script)
  setPromptClient(memoryPrompt)
}

beforeEach(() => {
  // Keep the interactive chrome out of the test output.
  setOutput(createMemoryOutput().output)
})

afterEach(resetPromptClient)

/** The last value the editor asked for: it asks for a key, then a value. */
const valueQuestion = (): PromptQuestion => {
  const question = memoryPrompt.questions
    .filter(({ kind }) => kind === 'text')
    .at(-1)
  if (question == null) throw new Error('No value was asked for')
  return question
}

test('interactForCustomMetadata: adds a key and value', async () => {
  scriptPrompt(['add', 'floor', '3', 'done'])

  await expect(interactForCustomMetadata({})).resolves.toEqual({ floor: '3' })
})

test('interactForCustomMetadata: removes a key from the result', async () => {
  scriptPrompt(['remove', 'floor', 'done'])

  await expect(
    interactForCustomMetadata({ floor: '3', wing: 'east' }),
  ).resolves.toEqual({ wing: 'east' })
})

test('interactForCustomMetadata: leaves the given metadata unmodified', async () => {
  scriptPrompt(['remove', 'floor', 'done'])
  const customMetadata = { floor: '3', wing: 'east' }

  await interactForCustomMetadata(customMetadata)

  expect(customMetadata).toEqual({ floor: '3', wing: 'east' })
})

test.for([['true', true] as const, ['false', false] as const])(
  'interactForCustomMetadata: stores %s as a boolean',
  async ([given, stored]) => {
    scriptPrompt(['add', 'enabled', given, 'done'])

    await expect(interactForCustomMetadata({})).resolves.toEqual({
      enabled: stored,
    })
  },
)

// The same prompt adds a key and edits one, so editing has to open on the
// value that key has rather than blank.
test.for([['3', '3'] as const, [true, 'true'] as const])(
  'interactForCustomMetadata: opens the value prompt on the value %s a key has',
  async ([stored, shown]) => {
    scriptPrompt(['add', 'floor', '4', 'done'])

    await interactForCustomMetadata({ floor: stored })

    expect(valueQuestion()).toMatchObject({ initialValue: shown })
  },
)

test('interactForCustomMetadata: opens the value prompt empty for a new key', async () => {
  scriptPrompt(['add', 'wing', 'east', 'done'])

  await interactForCustomMetadata({ floor: '3' })

  expect(valueQuestion().initialValue).toBeUndefined()
})

test('interactForCustomMetadata: stores null for the null keyword', async () => {
  scriptPrompt(['add', 'note', 'null', 'done'])

  await expect(interactForCustomMetadata({})).resolves.toEqual({ note: null })
})
