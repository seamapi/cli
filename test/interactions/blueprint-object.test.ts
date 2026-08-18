import type { Parameter } from '@seamapi/blueprint'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { CliContext } from 'lib/context.js'
import { interactForBlueprintObject } from 'lib/interactions/index.js'
import {
  cancelPrompt,
  createMemoryPrompt,
  type MemoryPromptClient,
  type PromptQuestion,
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

/** The question of a kind the user was asked, for a flow that asks one. */
const questionOfKind = (kind: PromptQuestion['kind']): PromptQuestion => {
  const question = memoryPrompt.questions.find(
    (question) => question.kind === kind,
  )
  if (question == null) throw new Error(`No ${kind} prompt was asked`)
  return question
}

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

// Every editor opens on the value the parameter already has — from an
// argument, from the JSON piped in, or from an earlier trip through the menu —
// so that changing a value is an edit and not a retype.

test('interactForBlueprintObject: opens a text prompt on the value the parameter has', async () => {
  scriptPrompt(['name', 'value', 'Back Door', 'done'])

  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1', name: 'Front Door' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_id: 'device1', name: 'Back Door' })

  expect(questionOfKind('text')).toMatchObject({
    message: withBackHint('name:'),
    initialValue: 'Front Door',
  })
})

test('interactForBlueprintObject: opens a text prompt empty for a parameter with no value', async () => {
  scriptPrompt(['name', 'Front Door', 'done'])

  await interactForBlueprintObject(
    args({ device_id: 'device1' }),
    ctx('interactive'),
  )

  expect(questionOfKind('text').initialValue).toBeUndefined()
})

// Params are passed through as given, so a value need not match the format
// its parameter documents: the JSON piped in is arbitrary JSON.
test('interactForBlueprintObject: opens a text prompt empty for a value that is not text', async () => {
  scriptPrompt(['name', 'value', 'Front Door', 'done'])

  await interactForBlueprintObject(
    args({ device_id: 'device1', name: 3 }),
    ctx('interactive'),
  )

  expect(questionOfKind('text').initialValue).toBeUndefined()
})

const numberParameters = [
  { name: 'limit', isRequired: false, format: 'number' },
] as unknown as Parameter[]

test('interactForBlueprintObject: opens a number prompt on the value the parameter has', async () => {
  scriptPrompt(['limit', 'value', 50, 'done'])

  await expect(
    interactForBlueprintObject(
      {
        command: ['devices', 'list'],
        parameters: numberParameters,
        params: { limit: 25 },
      },
      ctx('interactive'),
    ),
  ).resolves.toEqual({ limit: 50 })

  expect(questionOfKind('number').initialValue).toBe(25)
})

const enumParameters = [
  {
    name: 'sort_direction',
    isRequired: false,
    format: 'enum',
    values: [{ name: 'asc' }, { name: 'desc' }],
  },
] as unknown as Parameter[]

test('interactForBlueprintObject: opens an enum list on the value the parameter has', async () => {
  scriptPrompt(['sort_direction', 'value', 'asc', 'done'])

  await expect(
    interactForBlueprintObject(
      {
        command: ['devices', 'list'],
        parameters: enumParameters,
        params: { sort_direction: 'desc' },
      },
      ctx('interactive'),
    ),
  ).resolves.toEqual({ sort_direction: 'asc' })

  // The action menu is a select too, so the enum list is the second one.
  expect(
    memoryPrompt.questions.filter(({ kind }) => kind === 'select')[1],
  ).toMatchObject({ initialValue: 'desc' })
})

const booleanParameters = [
  { name: 'enabled', isRequired: false, format: 'boolean' },
] as unknown as Parameter[]

// A boolean confirm opens on `true` for a parameter with no value, so a value
// of `false` is exactly the one a prefill has to carry.
test.for([true, false] as const)(
  'interactForBlueprintObject: opens a confirm on the value %s the parameter has',
  async (given) => {
    scriptPrompt(['enabled', 'value', given, 'done'])

    await interactForBlueprintObject(
      {
        command: ['devices', 'list'],
        parameters: booleanParameters,
        params: { enabled: given },
      },
      ctx('interactive'),
    )

    expect(questionOfKind('confirm').initialValue).toBe(given)
  },
)

const enumListParameters = [
  {
    name: 'device_types',
    isRequired: false,
    format: 'list',
    itemFormat: 'enum',
    itemEnumValues: [{ name: 'august_lock' }, { name: 'schlage_lock' }],
  },
] as unknown as Parameter[]

test('interactForBlueprintObject: opens an enum list editor with the values the parameter has selected', async () => {
  scriptPrompt(['device_types', 'value', ['schlage_lock'], 'done'])

  await expect(
    interactForBlueprintObject(
      {
        command: ['devices', 'list'],
        parameters: enumListParameters,
        params: { device_types: ['august_lock'] },
      },
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_types: ['schlage_lock'] })

  expect(questionOfKind('autocompleteMultiselect').initialValues).toEqual([
    'august_lock',
  ])
})

const listParameters = [
  { name: 'device_ids', isRequired: false, format: 'list' },
] as unknown as Parameter[]

const listArgs = (params: Record<string, any>) => ({
  command: ['devices', 'list'],
  parameters: listParameters,
  params,
})

test('interactForBlueprintObject: opens the list editor on the list the parameter has', async () => {
  // Pick the parameter, enter its editor, finish editing, then submit.
  scriptPrompt(['device_ids', 'value', 'done', 'done'])

  await expect(
    interactForBlueprintObject(
      listArgs({ device_ids: ['device1', 'device2'] }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_ids: ['device1', 'device2'] })
})

// The list editor spreads what it is given, so a value that is not a list
// would be edited one character at a time.
test('interactForBlueprintObject: opens the list editor empty for a value that is not a list', async () => {
  scriptPrompt(['device_ids', 'value', 'done', 'done'])

  await expect(
    interactForBlueprintObject(
      listArgs({ device_ids: 'device1' }),
      ctx('interactive'),
    ),
  ).resolves.toEqual({ device_ids: [] })
})

// A timestamp parameter is routed by name, ahead of the format branches.
test('interactForBlueprintObject: opens the timestamp prompt on the value the parameter has', async () => {
  scriptPrompt(['starts_at', 'value', '2026-08-13T00:00:00.000Z', 'done'])

  await interactForBlueprintObject(
    {
      command: ['access_codes', 'create'],
      parameters: [
        { name: 'starts_at', isRequired: false, format: 'datetime' },
      ] as unknown as Parameter[],
      params: { starts_at: '2026-08-12T00:00:00.000Z' },
    },
    ctx('interactive'),
  )

  expect(questionOfKind('text').initialValue).toBe('2026-08-12T00:00:00.000Z')
})

// An object parameter is edited by this same menu one level down, so it has to
// be given the value it is editing rather than an empty params object: the
// object the menu returns is the request body, so anything it drops is sent
// missing.
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

const userIdentity = { full_name: 'Jane Doe', user_identity_key: 'jane' }

const objectArgs = (params: Record<string, any>) => ({
  command: ['access_grants', 'create'],
  parameters: objectParameters,
  params,
})

const objectEditorChoices = (): Array<{ value: string; hint?: string }> => {
  const question = memoryPrompt.questions.find(
    ({ message }) => message === withBackHint('Editing "user_identity"'),
  )
  if (question?.choices == null) throw new Error('The editor was not opened')
  return question.choices as Array<{ value: string; hint?: string }>
}

test('interactForBlueprintObject: opens an object editor on the value the parameter has', async () => {
  // Pick the parameter, choose to enter a value, then leave its editor.
  scriptPrompt(['user_identity', 'value', 'back', 'done'])

  await interactForBlueprintObject(
    objectArgs({ user_identity: { ...userIdentity } }),
    ctx('interactive'),
  )

  expect(
    objectEditorChoices().find(({ value }) => value === 'full_name'),
  ).toMatchObject({ hint: '[Jane Doe]' })
})

test.for([['leaving', 'back'] as const, ['dismissing', cancelPrompt] as const])(
  'interactForBlueprintObject: %s an object editor keeps the value the parameter has',
  async ([, answer]) => {
    scriptPrompt(['user_identity', 'value', answer, 'done'])

    await expect(
      interactForBlueprintObject(
        objectArgs({ user_identity: { ...userIdentity } }),
        ctx('interactive'),
      ),
    ).resolves.toEqual({ user_identity: userIdentity })
  },
)

test('interactForBlueprintObject: edits one sub-property of the value the parameter has', async () => {
  // Pick the parameter, enter its editor, edit one sub-property, save, submit.
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
    user_identity: { full_name: 'Jane Doe', user_identity_key: 'jane-2' },
  })

  expect(questionOfKind('text').initialValue).toBe('jane')
})

test('interactForBlueprintObject: opens an object editor empty for a parameter with no value', async () => {
  scriptPrompt(['user_identity', 'full_name', 'Jane Doe', 'done', 'done'])

  await expect(
    interactForBlueprintObject(objectArgs({}), ctx('interactive')),
  ).resolves.toEqual({ user_identity: { full_name: 'Jane Doe' } })
})

test.for([['text', 'nope'] as const, ['a list', ['nope']] as const])(
  'interactForBlueprintObject: opens an object editor empty for a value that is %s',
  async ([, given]) => {
    scriptPrompt(['user_identity', 'value', 'back', 'done'])

    await interactForBlueprintObject(
      objectArgs({ user_identity: given }),
      ctx('interactive'),
    )

    expect(objectEditorChoices().map(({ value }) => value)).toEqual([
      'full_name',
      'user_identity_key',
      'empty',
      'back',
    ])
  },
)

test('interactForBlueprintObject: leaves the given params unmodified', async () => {
  scriptPrompt(['user_identity', 'value', 'full_name', 'value', 'Ada', 'done'])
  const params = { user_identity: { ...userIdentity } }

  await interactForBlueprintObject(objectArgs(params), ctx('interactive'))

  expect(params).toEqual({ user_identity: userIdentity })
})

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
