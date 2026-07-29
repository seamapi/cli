import type { Parameter } from '@seamapi/blueprint'
import { expect, test } from 'vitest'

import { interactForBlueprintObject } from './interact-for-blueprint-object.js'
import type { ContextHelpers } from './types.js'

const parameters = [
  { name: 'device_id', isRequired: true, format: 'id' },
  { name: 'name', isRequired: false, format: 'string' },
] as unknown as Parameter[]

const nonInteractiveCtx = {
  is_interactive: false,
  blueprint: {},
} as unknown as ContextHelpers

const args = (params: Record<string, any>) => ({
  command: ['devices', 'get'],
  parameters,
  params,
})

test('interactForBlueprintObject: submits given parameters when non-interactive', async () => {
  await expect(
    interactForBlueprintObject(
      args({ device_id: 'device1' }),
      nonInteractiveCtx,
    ),
  ).resolves.toEqual({ device_id: 'device1' })
})

test('interactForBlueprintObject: rejects missing required parameters when non-interactive', async () => {
  await expect(
    interactForBlueprintObject(args({ name: 'Front Door' }), nonInteractiveCtx),
  ).rejects.toThrowError(
    'Missing required parameter for /devices/get: --device-id',
  )
})
