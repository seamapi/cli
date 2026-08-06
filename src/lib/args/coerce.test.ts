import type { Parameter } from '@seamapi/blueprint'
import { expect, test } from 'vitest'

import { coerceArgParams, coerceParam } from './coerce.js'

const parameter = (shape: Record<string, unknown>): Parameter =>
  shape as unknown as Parameter

const boolean = parameter({ name: 'is_managed', format: 'boolean' })
const number = parameter({ name: 'limit', format: 'number' })
const string = parameter({ name: 'code', format: 'string' })
const id = parameter({ name: 'device_id', format: 'id' })
const datetime = parameter({ name: 'since', format: 'datetime' })
const enumParam = parameter({
  name: 'device_type',
  format: 'enum',
  values: [{ name: 'august_lock' }, { name: 'schlage_lock' }],
})
const list = parameter({
  name: 'accepted_providers',
  format: 'list',
  itemFormat: 'string',
})
const numberList = parameter({
  name: 'limits',
  format: 'list',
  itemFormat: 'number',
})
const enumList = parameter({
  name: 'device_types',
  format: 'list',
  itemFormat: 'enum',
  itemEnumValues: [{ name: 'august_lock' }, { name: 'schlage_lock' }],
})
const object = parameter({ name: 'custom_metadata', format: 'object' })

test.each([
  [boolean, 'true', true],
  [boolean, 'false', false],
  [boolean, true, true],
  [boolean, '1', true],
  [boolean, 0, false],
  [number, 5, 5],
  [number, '5', 5],
  [number, '0.5', 0.5],
  [string, '0123', '0123'],
  [string, 'a,b', 'a,b'],
  [id, 'device1', 'device1'],
  [datetime, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
  [enumParam, 'august_lock', 'august_lock'],
  [list, 'a,b', ['a', 'b']],
  [list, 'a', ['a']],
  [list, ['a', 'b'], ['a', 'b']],
  [list, 5, ['5']],
  [numberList, '1,2', [1, 2]],
  [enumList, 'august_lock,schlage_lock', ['august_lock', 'schlage_lock']],
  [object, '{"floor":2}', { floor: 2 }],
] as Array<[Parameter, unknown, unknown]>)(
  'coerceParam: %o given %o becomes %o',
  (param, given, value) => {
    expect(coerceParam(param, given)).toEqual({ value })
  },
)

test.each([
  [boolean, 'maybe', 'true or false'],
  [boolean, 2, 'true or false'],
  [number, 'five', 'a number'],
  [number, '', 'a number'],
  [number, true, 'a number'],
  [enumParam, 'bogus', 'one of august_lock, schlage_lock'],
  [numberList, '1,two', 'a list of numbers'],
  [enumList, 'august_lock,bogus', 'a list of august_lock, schlage_lock'],
  [object, 'not json', 'a JSON object'],
  [object, '[1]', 'a JSON object'],
  [string, ['a', 'b'], 'a single value'],
] as Array<[Parameter, unknown, string]>)(
  'coerceParam: %o rejects %o expecting %s',
  (param, given, issue) => {
    expect(coerceParam(param, given)).toEqual({ issue })
  },
)

test('coerceArgParams: coerces each argument by its own parameter', () => {
  const { params, issues } = coerceArgParams([boolean, number, string], {
    is_managed: 'true',
    limit: '5',
    code: '0123',
  })

  expect(issues).toEqual([])
  expect(params).toEqual({ is_managed: true, limit: 5, code: '0123' })
})

test('coerceArgParams: passes unknown arguments through unchanged', () => {
  const { params, issues } = coerceArgParams([number], { nope: 'x' })

  expect(issues).toEqual([])
  expect(params).toEqual({ nope: 'x' })
})

test('coerceArgParams: collects every issue at once', () => {
  const { issues } = coerceArgParams([boolean, number], {
    is_managed: 'maybe',
    limit: 'five',
  })

  expect(issues).toEqual([
    { name: 'is_managed', given: 'maybe', expected: 'true or false' },
    { name: 'limit', given: 'five', expected: 'a number' },
  ])
})
