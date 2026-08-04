import type { ParsedArgs } from 'minimist'
import { expect, test } from 'vitest'

import {
  getInteractivity,
  parseCliArgs,
  toArgName,
  toGivenArgName,
  toParameterName,
} from './cli-args.js'

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

test('getInteractivity: --interactive and --non-interactive cannot be combined', () => {
  expect(() =>
    getInteractivity(parse(['devices', 'list', '-i', '-y'])),
  ).toThrow(
    'The --interactive and --non-interactive flags cannot be used together',
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

test('parseCliArgs: reads a page cursor exactly as given', () => {
  // Cursors are opaque, so anything that looks like a number must survive.
  expect(
    parse(['devices', 'list', '--page-cursor', '0755'])['page_cursor'],
  ).toBe('0755')
  expect(
    parse(['devices', 'list', '--page-cursor', '1e5'])['page_cursor'],
  ).toBe('1e5')
  expect(
    parse(['devices', 'list', '--page-cursor=eyJrIjoxfQ=='])['page_cursor'],
  ).toBe('eyJrIjoxfQ==')
  expect(
    parse(['devices', 'list', '--page_cursor', '0755'])['page_cursor'],
  ).toBe('0755')
})

test('toArgName: renders a parameter as its argument', () => {
  expect(toArgName('device_id')).toBe('--device-id')
  expect(toArgName('code')).toBe('--code')
})

test('toParameterName: reads an argument key as the parameter it names', () => {
  expect(toParameterName('page-cursor')).toBe('page_cursor')
  expect(toParameterName('page_cursor')).toBe('page_cursor')
  expect(toParameterName('PAGE-CURSOR')).toBe('page_cursor')
  expect(toParameterName('limit')).toBe('limit')
})

test('toGivenArgName: renders a one letter key as a short argument', () => {
  expect(toGivenArgName('n')).toBe('-n')
  expect(toGivenArgName('page_cursor')).toBe('--page-cursor')
})

test('getInteractivity: never prompts without a terminal', () => {
  expect(
    getInteractivity(parse(['devices', 'list']), { canPrompt: false }),
  ).toBe('non-interactive')
})

test('getInteractivity: an explicit --interactive still prompts', () => {
  expect(
    getInteractivity(parse(['devices', 'list', '-i']), { canPrompt: false }),
  ).toBe('interactive')
})
