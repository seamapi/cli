import { expect, test } from 'vitest'

import { createMemoryOutput } from './create-memory-output.js'

test('createOutput: writes data to stdout as json', () => {
  const { output, stdout, stderr } = createMemoryOutput({ format: 'json' })

  output.data({ devices: [{ device_id: 'abc' }] })

  expect(JSON.parse(stdout())).toEqual({ devices: [{ device_id: 'abc' }] })
  expect(stderr()).toBe('')
})

test('createOutput: pretty prints data as text', () => {
  const { output, stdout } = createMemoryOutput({ format: 'text' })

  output.data({ devices: [{ device_id: 'abc' }] })

  expect(stdout()).toBe("{ devices: [ { device_id: 'abc' } ] }\n")
})

test('createOutput: writes plain text results to stdout verbatim', () => {
  const json = createMemoryOutput({ format: 'json' })
  const text = createMemoryOutput({ format: 'text' })

  json.output.text('1.2.3')
  text.output.text('1.2.3')

  expect(json.stdout()).toBe('1.2.3\n')
  expect(text.stdout()).toBe('1.2.3\n')
})

test('createOutput: keeps info off stdout', () => {
  const { output, stdout, stderr } = createMemoryOutput({ format: 'text' })

  output.info('Making request...')

  expect(stdout()).toBe('')
  expect(stderr()).toBe('Making request...\n')
})

test('createOutput: suppresses info in the json format', () => {
  const { output, stdout, stderr } = createMemoryOutput({ format: 'json' })

  output.info('Making request...')

  expect(stdout()).toBe('')
  expect(stderr()).toBe('')
})

test('createOutput: always reports warnings and errors on stderr', () => {
  const { output, stdout, stderr } = createMemoryOutput({ format: 'json' })

  output.warn('[400]')
  output.error('CLI Error: Network Error')

  expect(stdout()).toBe('')
  expect(stderr()).toBe('[400]\nCLI Error: Network Error\n')
})

test('createOutput: ignores undefined data', () => {
  const { output, stdout } = createMemoryOutput({ format: 'json' })

  output.data(undefined)

  expect(stdout()).toBe('')
})

test('createOutput: defaults to the text format', () => {
  const { output } = createMemoryOutput()

  expect(output.format).toBe('text')
})
