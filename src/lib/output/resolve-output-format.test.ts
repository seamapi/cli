import { expect, test } from 'vitest'

import { resolveOutputFormat } from './resolve-output-format.js'

test('resolveOutputFormat: writes json when piped or redirected', () => {
  expect(resolveOutputFormat(['devices', 'list'], { isTty: false })).toBe(
    'json',
  )
})

test('resolveOutputFormat: pretty prints at a terminal', () => {
  expect(resolveOutputFormat(['devices', 'list'], { isTty: true })).toBe('text')
})

test('resolveOutputFormat: --json wins at a terminal', () => {
  expect(
    resolveOutputFormat(['devices', 'list', '--json'], { isTty: true }),
  ).toBe('json')
})

test('resolveOutputFormat: --no-json wins when piped', () => {
  expect(
    resolveOutputFormat(['devices', 'list', '--no-json'], { isTty: false }),
  ).toBe('text')
})

test('resolveOutputFormat: the last flag wins', () => {
  expect(
    resolveOutputFormat(['devices', 'list', '--json', '--no-json'], {
      isTty: true,
    }),
  ).toBe('text')
})

test('resolveOutputFormat: ignores a --json-like parameter value', () => {
  expect(
    resolveOutputFormat(['devices', 'list', '--name', '--no-json-x'], {
      isTty: true,
    }),
  ).toBe('text')
})
