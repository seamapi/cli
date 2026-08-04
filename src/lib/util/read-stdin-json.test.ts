import { Readable } from 'node:stream'

import { expect, test } from 'vitest'

import { parseJsonParams, readStdinJson } from './read-stdin-json.js'

const streamOf = (...chunks: string[]): Readable => Readable.from(chunks)

test('readStdinJson: reads params piped in', async () => {
  const params = await readStdinJson(streamOf('{"device_id":', '"abc"}'))

  expect(params).toEqual({ device_id: 'abc' })
})

test('readStdinJson: returns null for a terminal', async () => {
  const stdin = streamOf('{"device_id":"abc"}') as Readable & {
    isTTY?: boolean
  }
  stdin.isTTY = true

  expect(await readStdinJson(stdin)).toBe(null)
})

test('readStdinJson: returns null when nothing is piped in', async () => {
  expect(await readStdinJson(streamOf())).toBe(null)
  expect(await readStdinJson(streamOf('\n  '))).toBe(null)
})

test('readStdinJson: reports invalid json', async () => {
  await expect(readStdinJson(streamOf('nope'))).rejects.toThrow(
    /Could not parse JSON from stdin/,
  )
})

test('parseJsonParams: rejects json that is not an object of params', () => {
  expect(() => parseJsonParams('[1, 2]', '--json')).toThrow(
    /Expected a JSON object of request params from --json, got an array/,
  )
  expect(() => parseJsonParams('42', 'stdin')).toThrow(
    /Expected a JSON object of request params from stdin, got number/,
  )
})

test('parseJsonParams: returns null when there is nothing to parse', () => {
  expect(parseJsonParams('', '--json')).toBe(null)
})
