import type { Parameter } from '@seamapi/blueprint'
import { beforeEach, expect, test, vi } from 'vitest'

import { interactForBlueprintObject } from './interact-for-blueprint-object.js'
import { createMemoryOutput } from './output/create-memory-output.js'
import { setOutput } from './output/get-output.js'
import type { ContextHelpers } from './types.js'
import { promptAutocomplete } from './util/prompt.js'

vi.mock('./util/prompt.js', () => ({
  canPrompt: vi.fn(() => true),
  PromptCancelledError: class extends Error {},
  promptText: vi.fn(),
  promptNumber: vi.fn(),
  promptConfirm: vi.fn(),
  promptSelect: vi.fn(),
  promptAutocomplete: vi.fn(async () => 'done'),
  promptAutocompleteMultiselect: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(promptAutocomplete).mockClear()
  // Keep the interactive chrome out of the test output.
  setOutput(createMemoryOutput().output)
})

const parameters = [
  { name: 'device_id', isRequired: true, format: 'id' },
  { name: 'name', isRequired: false, format: 'string' },
] as unknown as Parameter[]

const ctx = (interactivity: ContextHelpers['interactivity']): ContextHelpers =>
  ({ interactivity, blueprint: {} }) as unknown as ContextHelpers

const args = (params: Record<string, any>) => ({
  command: ['devices', 'get'],
  parameters,
  params,
})

test('interactForBlueprintObject: submits without prompting once every required parameter is given', async () => {
  await expect(
    interactForBlueprintObject(args({ device_id: 'device1' }), ctx('auto')),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(promptAutocomplete).not.toHaveBeenCalled()
})

test('interactForBlueprintObject: prompts to review given parameters when interactive', async () => {
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(promptAutocomplete).toHaveBeenCalledTimes(1)
})

test('interactForBlueprintObject: prefills the prompt with the given parameters', async () => {
  await interactForBlueprintObject(
    args({ device_id: 'device1' }),
    ctx('interactive'),
  )

  const { choices } = vi.mocked(promptAutocomplete).mock.calls[0]?.[0] as {
    choices: Array<{ value: string; hint?: string }>
  }
  expect(choices.find(({ value }) => value === 'device_id')).toMatchObject({
    hint: '[device1]',
  })
})

test('interactForBlueprintObject: submits without prompting when non-interactive', async () => {
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('non-interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(promptAutocomplete).not.toHaveBeenCalled()
})

test('interactForBlueprintObject: rejects missing required parameters when non-interactive', async () => {
  await expect(
    interactForBlueprintObject(
      args({ name: 'Front Door' }),
      ctx('non-interactive'),
    ),
  ).rejects.toThrowError(
    'Missing required parameter for /devices/get: --device-id',
  )
  expect(promptAutocomplete).not.toHaveBeenCalled()
})
