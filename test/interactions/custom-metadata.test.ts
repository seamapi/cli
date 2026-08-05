import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryOutput } from 'lib/output/memory-output.js'
import { setOutput } from 'lib/output/get-output.js'
import { createMemoryPrompt } from 'lib/interactions/memory-prompt.js'
import { interactForCustomMetadata } from 'lib/interactions/custom-metadata.js'
import { resetPromptClient, setPromptClient } from 'lib/interactions/prompt.js'

/** Scripts an answer for each ask, in the order the editor asks. */
const scriptPrompt = (script: unknown[]): void => {
  setPromptClient(createMemoryPrompt(script))
}

beforeEach(() => {
  // Keep the interactive chrome out of the test output.
  setOutput(createMemoryOutput().output)
})

afterEach(resetPromptClient)

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

test('interactForCustomMetadata: stores null for the null keyword', async () => {
  scriptPrompt(['add', 'note', 'null', 'done'])

  await expect(interactForCustomMetadata({})).resolves.toEqual({ note: null })
})
