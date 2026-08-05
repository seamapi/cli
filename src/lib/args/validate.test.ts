import type { Parameter } from '@seamapi/blueprint'
import { expect, test } from 'vitest'

import { assertKnownArgs, assertRequiredParams } from './validate.js'

const parameters = [
  { name: 'device_id', isRequired: true, format: 'id' },
  { name: 'code', isRequired: true, format: 'string' },
  { name: 'name', isRequired: false, format: 'string' },
] as unknown as Parameter[]

test('assertRequiredParams: passes when every required parameter is given', () => {
  expect(() => {
    assertRequiredParams(
      parameters,
      { device_id: 'device1', code: '1234' },
      '/access_codes/create',
    )
  }).not.toThrow()
})

test('assertRequiredParams: names one missing parameter as its argument', () => {
  expect(() => {
    assertRequiredParams(parameters, { code: '1234' }, '/access_codes/create')
  }).toThrow('Missing required parameter for /access_codes/create: --device-id')
})

test('assertRequiredParams: names every missing parameter at once', () => {
  expect(() => {
    assertRequiredParams(parameters, {}, '/access_codes/create')
  }).toThrow(
    'Missing required parameters for /access_codes/create: --device-id --code',
  )
})

test('assertKnownArgs: passes when every argument is accepted', () => {
  expect(() => {
    assertKnownArgs({ limit: 5 }, ['devices', 'list'], {
      accepted: new Set(['limit']),
      isLocal: false,
    })
  }).not.toThrow()
})

test('assertKnownArgs: names an endpoint command by its path', () => {
  expect(() => {
    assertKnownArgs({ limitt: 5 }, ['devices', 'list'], {
      accepted: new Set(['limit']),
      isLocal: false,
    })
  }).toThrow('Unknown parameter for /devices/list: --limitt')
})

test('assertKnownArgs: names a CLI command by its words', () => {
  expect(() => {
    assertKnownArgs({ serverr: 'https://example.com' }, ['select', 'server'], {
      accepted: new Set(['server']),
      isLocal: true,
    })
  }).toThrow('Unknown parameter for select server: --serverr')
})

test('assertKnownArgs: names every unknown argument at once, with a hint', () => {
  try {
    assertKnownArgs({ limitt: 5, n: true }, ['devices', 'list'], {
      accepted: new Set(['limit']),
      isLocal: false,
    })
    expect.unreachable()
  } catch (error: any) {
    expect(error.message).toBe(
      'Unknown parameters for /devices/list: --limitt -n',
    )
    expect(error.hint).toBe(
      "Run 'seam devices list --help' to see what it accepts.",
    )
  }
})
