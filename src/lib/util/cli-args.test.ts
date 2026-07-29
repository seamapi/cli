import type { ParsedArgs } from 'minimist'
import { expect, test } from 'vitest'

import { isInteractive, parseCliArgs, toArgName } from './cli-args.js'

// The CLI normalizes argument keys before checking them.
const parse = (argv: string[]): ParsedArgs => {
  const args = parseCliArgs(argv)
  for (const k in args) {
    if (k === '_') continue
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }
  return args
}

test('isInteractive: interactive by default', () => {
  expect(isInteractive(parse(['devices', 'list']))).toBe(true)
})

test('isInteractive: --non-interactive and -y never prompt', () => {
  expect(isInteractive(parse(['devices', 'list', '--non-interactive']))).toBe(
    false,
  )
  expect(isInteractive(parse(['devices', 'list', '-y']))).toBe(false)
})

test('isInteractive: -n is reserved and does not affect interactivity', () => {
  expect(isInteractive(parse(['devices', 'list', '-n']))).toBe(true)
})

test('parseCliArgs: --non-interactive does not consume the next argument', () => {
  const args = parse(['devices', 'get', '-y', '--device-id', 'foo'])
  expect(args['device_id']).toBe('foo')
  expect(args._).toEqual(['devices', 'get'])
})

test('toArgName: renders a parameter as its argument', () => {
  expect(toArgName('device_id')).toBe('--device-id')
  expect(toArgName('code')).toBe('--code')
})
