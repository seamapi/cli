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

test('getInteractivity: prompts only for what is missing by default', () => {
  expect(getInteractivity(parse(['devices', 'list']))).toBe('auto')
})

test('getInteractivity: --interactive and -i always prompt', () => {
  expect(getInteractivity(parse(['devices', 'list', '--interactive']))).toBe(
    'interactive',
  )
  expect(getInteractivity(parse(['devices', 'list', '-i']))).toBe('interactive')
})

test('getInteractivity: --non-interactive and -y never prompt', () => {
  expect(
    getInteractivity(parse(['devices', 'list', '--non-interactive'])),
  ).toBe('non-interactive')
  expect(getInteractivity(parse(['devices', 'list', '-y']))).toBe(
    'non-interactive',
  )
})

test('getInteractivity: --non-interactive wins over --interactive', () => {
  expect(getInteractivity(parse(['devices', 'list', '-i', '-y']))).toBe(
    'non-interactive',
  )
})

test('getInteractivity: -n is reserved and does not affect interactivity', () => {
  expect(getInteractivity(parse(['devices', 'list', '-n']))).toBe('auto')
})

test('parseCliArgs: interactivity flags do not consume the next argument', () => {
  const args = parse(['devices', 'get', '-y', '-i', '--device-id', 'foo'])
  expect(args['device_id']).toBe('foo')
  expect(args._).toEqual(['devices', 'get'])
})

test('toArgName: renders a parameter as its argument', () => {
  expect(toArgName('device_id')).toBe('--device-id')
  expect(toArgName('code')).toBe('--code')
})
