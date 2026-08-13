import type { Parameter } from '@seamapi/blueprint'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { CliContext } from 'lib/context.js'
import { interactForBlueprintObject } from 'lib/interactions/index.js'
import {
  cancelPrompt,
  createMemoryPrompt,
  type MemoryPromptClient,
} from 'lib/memory-prompt.js'
import { setOutput } from 'lib/output/get-output.js'
import { createMemoryOutput } from 'lib/output/memory-output.js'
import { resetPromptClient, setPromptClient, withBackHint } from 'lib/prompt.js'

let memoryPrompt: MemoryPromptClient

/** Replace the prompt client, scripting an answer for each ask in turn. */
const scriptPrompt = (script: unknown[]): MemoryPromptClient => {
  memoryPrompt = createMemoryPrompt(script)
  setPromptClient(memoryPrompt)
  return memoryPrompt
}

beforeEach(() => {
  // Any unscripted review prompt submits immediately.
  scriptPrompt(['done'])
  // Keep the interactive chrome out of the test output.
  setOutput(createMemoryOutput().output)
})

afterEach(resetPromptClient)

const parameters = [
  { name: 'device_id', isRequired: true, format: 'id' },
  { name: 'name', isRequired: false, format: 'string' },
] as unknown as Parameter[]

const ctx = (interactivity: CliContext['interactivity']): CliContext =>
  ({ interactivity, blueprint: {} }) as unknown as CliContext

const args = (params: Record<string, any>) => ({
  command: ['devices', 'get'],
  parameters,
  params,
})

test('interactForBlueprintObject: submits without prompting once every required parameter is given', async () => {
  await expect(
    interactForBlueprintObject(args({ device_id: 'device1' }), ctx('auto')),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(memoryPrompt.questions).toHaveLength(0)
})

test('interactForBlueprintObject: prompts to review given parameters when interactive', async () => {
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(memoryPrompt.questions).toHaveLength(1)
})

test('interactForBlueprintObject: prefills the prompt with the given parameters', async () => {
  await interactForBlueprintObject(
    args({ device_id: 'device1' }),
    ctx('interactive'),
  )

  const { choices } = memoryPrompt.questions[0] as unknown as {
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
  expect(memoryPrompt.questions).toHaveLength(0)
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
  expect(memoryPrompt.questions).toHaveLength(0)
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
    expect(memoryPrompt.questions).toHaveLength(0)
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

  const { choices } = memoryPrompt.questions[0] as unknown as {
    choices: Array<{ value: string; label: string }>
  }
  expect(choices.map(({ value }) => value)).toContain('done')
})

test('interactForBlueprintObject: prompts in auto mode when an empty request has required parameters', async () => {
  scriptPrompt(['name', 'Front Door'])

  await expect(
    interactForBlueprintObject(
      {
        command: ['devices', 'update'],
        parameters: [
          { name: 'name', isRequired: false, format: 'string' },
        ] as unknown as Parameter[],
        params: {},
        hasRequiredParameters: true,
      },
      ctx('auto'),
    ),
  ).resolves.toEqual({ name: 'Front Door' })
  expect(memoryPrompt.questions.map(({ kind }) => kind)).toEqual([
    'autocomplete',
    'text',
  ])
})

test('interactForBlueprintObject: lets a nullable parameter be set to null', async () => {
  const nullableParameters = [
    { name: 'name', isRequired: false, isNullable: true, format: 'string' },
  ] as unknown as Parameter[]
  scriptPrompt(['name', 'null', 'done'])

  await expect(
    interactForBlueprintObject(
      {
        command: ['devices', 'update'],
        parameters: nullableParameters,
        params: {},
      },
      ctx('interactive'),
    ),
  ).resolves.toEqual({ name: null })

  expect(memoryPrompt.questions[1]).toMatchObject({
    kind: 'select',
    choices: expect.arrayContaining([{ label: 'Set to null', value: 'null' }]),
  })
})

test('interactForBlueprintObject: lets a supplied parameter be unset', async () => {
  scriptPrompt(['name', 'unset', 'done'])

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1', name: 'Front Door' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })

  expect(memoryPrompt.questions[1]).toMatchObject({
    kind: 'select',
    choices: expect.arrayContaining([{ label: 'Unset', value: 'unset' }]),
  })
})

// `custom_metadata` and `custom_metadata_has` are both records, a format with
// no branch of its own, so each has to be routed by name.
test.for(['custom_metadata', 'custom_metadata_has'] as const)(
  'interactForBlueprintObject: edits %s with the metadata editor',
  async (name) => {
    // Pick the parameter, finish the metadata editor, then submit.
    scriptPrompt([name, 'done', 'done'])

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

// An object parameter is edited by the same menu one level down, so it has to
// start from the value it was given rather than from nothing.
const objectParameters = [
  {
    name: 'user_identity',
    isRequired: false,
    format: 'object',
    parameters: [
      { name: 'full_name', isRequired: true, format: 'string' },
      { name: 'user_identity_key', isRequired: false, format: 'string' },
    ],
  },
] as unknown as Parameter[]

const userIdentity = {
  full_name: 'Jane Doe',
  user_identity_key: 'jane',
}

const objectArgs = (params: Record<string, any>) => ({
  command: ['access_grants', 'create'],
  parameters: objectParameters,
  params,
})

const editorChoices = (): Array<{ value: string; hint?: string }> => {
  const question = memoryPrompt.questions.find(
    ({ message }) => message === withBackHint('Editing "user_identity"'),
  )
  if (question?.choices == null) throw new Error('The editor was not opened')
  return question.choices as Array<{ value: string; hint?: string }>
}

test('interactForBlueprintObject: prefills an object parameter editor with the given value', async () => {
  // Pick the parameter, choose to enter a value, then leave its editor.
  scriptPrompt(['user_identity', 'value', 'back', 'done'])

  await interactForBlueprintObject(
    objectArgs({ user_identity: { ...userIdentity } }),
    ctx('interactive'),
  )

  expect(
    editorChoices().find(({ value }) => value === 'full_name'),
  ).toMatchObject({ hint: '[Jane Doe]' })
})

test('interactForBlueprintObject: leaving an object parameter editor keeps the given value', async () => {
  scriptPrompt(['user_identity', 'value', 'back', 'done'])

  await expect(
    interactForBlueprintObject(
      objectArgs({ user_identity: { ...userIdentity } }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ user_identity: userIdentity })
})

test('interactForBlueprintObject: dismissing an object parameter editor keeps the given value', async () => {
  scriptPrompt(['user_identity', 'value', cancelPrompt, 'done'])

  await expect(
    interactForBlueprintObject(
      objectArgs({ user_identity: { ...userIdentity } }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ user_identity: userIdentity })
})

test('interactForBlueprintObject: edits an object parameter from the value it was given', async () => {
  // Pick the parameter, enter its editor, edit one sub-property, save.
  scriptPrompt([
    'user_identity',
    'value',
    'user_identity_key',
    'value',
    'jane-2',
    'done',
    'done',
  ])

  await expect(
    interactForBlueprintObject(
      objectArgs({ user_identity: { ...userIdentity } }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({
    user_identity: {
      full_name: userIdentity.full_name,
      user_identity_key: 'jane-2',
    },
  })
})

test('interactForBlueprintObject: an object parameter given nothing starts empty', async () => {
  scriptPrompt(['user_identity', 'full_name', 'Jane Doe', 'done', 'done'])

  await expect(
    interactForBlueprintObject(objectArgs({}), ctx('interactive')),
  ).resolves.toEqual({ user_identity: { full_name: 'Jane Doe' } })
})

// Params read from stdin are passed through as given, so an object parameter
// can arrive as something with no properties to edit.
test.for([['a string', 'nope'] as const, ['a list', ['nope']] as const])(
  'interactForBlueprintObject: an object parameter given %s starts empty',
  async ([, given]) => {
    scriptPrompt(['user_identity', 'value', 'back', 'done'])

    await interactForBlueprintObject(
      objectArgs({ user_identity: given }),
      ctx('interactive'),
    )

    expect(editorChoices().map(({ value }) => value)).toEqual([
      'full_name',
      'user_identity_key',
      'empty',
      'back',
    ])
  },
)

test('interactForBlueprintObject: dismissing the parameter menu leaves the command', async () => {
  scriptPrompt([cancelPrompt])

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toBe('[Back]')
})

test('interactForBlueprintObject: dismissing a value prompt returns to the menu', async () => {
  scriptPrompt(['name', cancelPrompt, 'done'])

  // The parameter is left unset and the command still runs, rather than the
  // dismissal ending the whole command.
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1' })
  expect(
    memoryPrompt.questions.filter(({ kind }) => kind === 'autocomplete'),
  ).toHaveLength(2)
})

test('interactForBlueprintObject: dismissing a value prompt keeps an earlier value', async () => {
  scriptPrompt(['name', cancelPrompt, 'done'])

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1', name: 'Front Door' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1', name: 'Front Door' })
})

test('interactForBlueprintObject: tells the user the parameter menu can be left', async () => {
  await interactForBlueprintObject(
    args({ device_id: 'device1' }),
    ctx('interactive'),
  )

  expect(memoryPrompt.questions[0]).toMatchObject({
    message: withBackHint('[/devices/get] Parameters'),
  })
})

test('interactForBlueprintObject: tells the user a value prompt can be left', async () => {
  scriptPrompt(['name', 'Front Door', 'done'])

  await interactForBlueprintObject(
    args({ device_id: 'device1' }),
    ctx('interactive'),
  )

  expect(memoryPrompt.questions[1]).toMatchObject({
    kind: 'text',
    message: withBackHint('name:'),
  })
})
