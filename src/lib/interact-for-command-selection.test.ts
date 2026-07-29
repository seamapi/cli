import { expect, test } from 'vitest'

import { interactForCommandSelection } from './interact-for-command-selection.js'
import type { ContextHelpers } from './types.js'

const ctx = {
  is_interactive: false,
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
