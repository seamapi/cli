import type { ParsedArgs } from 'minimist'
import { expect, test } from 'vitest'

import { getInteractivity, parseCliArgs, toArgName } from './cli-args.js'

// The CLI normalizes argument keys before checking them.
const parse = (argv: string[]): ParsedArgs => {
  const args = parseCliArgs(argv)
  for (const k in args) {
    if (k === '_') continue
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }
  return args
}

test('getInteractivity: interactive by default', () => {
  expect(getInteractivity(parse(['devices', 'list']))).toBe('interactive')
})

test('getInteractivity: --non-interactive and -n never prompt', () => {
  expect(
    getInteractivity(parse(['devices', 'list', '--non-interactive'])),
  ).toBe('non-interactive')
  expect(getInteractivity(parse(['devices', 'list', '-n']))).toBe(
    'non-interactive',
  )
})

test('getInteractivity: --yes and -y only skip the parameter prompt', () => {
  expect(getInteractivity(parse(['devices', 'list', '--yes']))).toBe(
    'auto-submit',
  )
  expect(getInteractivity(parse(['devices', 'list', '-y']))).toBe('auto-submit')
})

test('getInteractivity: --non-interactive wins over -y', () => {
  expect(getInteractivity(parse(['devices', 'list', '-y', '-n']))).toBe(
    'non-interactive',
  )
})

test('parseCliArgs: --non-interactive does not consume the next argument', () => {
  const args = parse(['devices', 'get', '-n', '--device-id', 'foo'])
  expect(args['device_id']).toBe('foo')
  expect(args._).toEqual(['devices', 'get'])
})

test('toArgName: renders a parameter as its argument', () => {
  expect(toArgName('device_id')).toBe('--device-id')
  expect(toArgName('code')).toBe('--code')
})
