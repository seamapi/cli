import type { ParsedArgs } from 'minimist'
import { expect, test } from 'vitest'

import { isInteractive, parseCliArgs } from './cli-args.js'

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

test('isInteractive: --non-interactive and its aliases opt out', () => {
  expect(isInteractive(parse(['devices', 'list', '--non-interactive']))).toBe(
    false,
  )
  expect(isInteractive(parse(['devices', 'list', '-n']))).toBe(false)
  expect(isInteractive(parse(['devices', 'list', '-y']))).toBe(false)
})

test('parseCliArgs: --non-interactive does not consume the next argument', () => {
  const args = parse(['devices', 'get', '-n', '--device-id', 'foo'])
  expect(args['device_id']).toBe('foo')
  expect(args._).toEqual(['devices', 'get'])
})
