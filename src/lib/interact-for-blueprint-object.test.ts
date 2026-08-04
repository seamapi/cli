import type { Parameter } from '@seamapi/blueprint'
import { beforeEach, expect, test, vi } from 'vitest'

import { interactForBlueprintObject } from './interact-for-blueprint-object.js'
import { createMemoryOutput } from './output/create-memory-output.js'
import { setOutput } from './output/get-output.js'
import type { ContextHelpers } from './types.js'
import {
  promptAutocomplete,
  PromptCancelledError,
  promptSelect,
  promptText,
} from './util/prompt.js'

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
  vi.mocked(promptAutocomplete).mockImplementation(async () => 'done')
  vi.mocked(promptText).mockReset()
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

const falsyParameters = [
  { name: 'enabled', isRequired: true, format: 'boolean' },
] as unknown as Parameter[]

const falsyArgs = (params: Record<string, any>) => ({
  command: ['devices', 'get'],
  parameters: falsyParameters,
  params,
})

// A required parameter is satisfied by being present, not by being truthy:
// `false`, `0` and `''` are values a user can supply.
test.for([
  ['boolean', false] as const,
  ['number', 0] as const,
  ['string', ''] as const,
])(
  'interactForBlueprintObject: accepts a required falsy %s value',
  async ([, value]) => {
    await expect(
      interactForBlueprintObject(falsyArgs({ enabled: value }), ctx('auto')),
    ).resolves.toEqual({ enabled: value })
    expect(promptAutocomplete).not.toHaveBeenCalled()
  },
)

test('interactForBlueprintObject: reports a required parameter as missing only when absent', async () => {
  await expect(
    interactForBlueprintObject(falsyArgs({}), ctx('non-interactive')),
  ).rejects.toThrowError(
    'Missing required parameter for /devices/get: --enabled',
  )
})

test('interactForBlueprintObject: does not report a falsy sub-property value as missing', async () => {
  await expect(
    interactForBlueprintObject(
      {
        ...falsyArgs({ enabled: false }),
        isSubProperty: true,
        subPropertyPath: 'inner',
      },
      ctx('non-interactive'),
    ),
  ).rejects.toThrowError('Cannot prompt for "inner" in non-interactive mode')
})

test('interactForBlueprintObject: offers the submit choice when a required value is falsy', async () => {
  await interactForBlueprintObject(
    falsyArgs({ enabled: false }),
    ctx('interactive'),
  )

  const { choices } = vi.mocked(promptAutocomplete).mock.calls[0]?.[0] as {
    choices: Array<{ value: string; label: string }>
  }
  expect(choices.map(({ value }) => value)).toContain('done')
})

// `custom_metadata` and `custom_metadata_has` are both records, a format with no
// branch of its own, so each has to be routed by name.
test.for(['custom_metadata', 'custom_metadata_has'] as const)(
  'interactForBlueprintObject: edits %s with the metadata editor',
  async (name) => {
    vi.mocked(promptAutocomplete)
      .mockImplementationOnce(async () => name as never)
      .mockImplementationOnce(async () => 'done' as never)
    vi.mocked(promptSelect).mockImplementation(async () => 'done' as never)

    await expect(
      interactForBlueprintObject(
        {
          command: ['devices', 'list'],
          parameters: [
            { name, isRequired: false, format: 'record' },
          ] as unknown as Parameter[],
          params: {},
        },
        ctx('interactive'),
      ),
    ).resolves.toEqual({ [name]: {} })
  },
)

test('interactForBlueprintObject: dismissing the parameter menu leaves the command', async () => {
  vi.mocked(promptAutocomplete).mockRejectedValueOnce(
    new PromptCancelledError(),
  )

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toBe('[Back]')
})

test('interactForBlueprintObject: dismissing a value prompt returns to the menu', async () => {
  vi.mocked(promptAutocomplete)
    .mockImplementationOnce(async () => 'name')
    .mockImplementationOnce(async () => 'done')
  vi.mocked(promptText).mockRejectedValueOnce(new PromptCancelledError())

  // The parameter is left unset and the command still runs, rather than the
  // dismissal ending the whole command.
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(promptAutocomplete).toHaveBeenCalledTimes(2)
})

test('interactForBlueprintObject: dismissing a value prompt keeps an earlier value', async () => {
  vi.mocked(promptAutocomplete)
    .mockImplementationOnce(async () => 'name')
    .mockImplementationOnce(async () => 'done')
  vi.mocked(promptText).mockRejectedValueOnce(new PromptCancelledError())

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1', name: 'Front Door' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1', name: 'Front Door' })
})
