import { expect, test } from 'vitest'

import { ellipsis, firstSentence, toPlainText } from './text.js'

test('ellipsis: truncates only when over the limit', () => {
  expect(ellipsis('seam', 10)).toBe('seam')
  expect(ellipsis('seam-cli', 6)).toBe('sea...')
})

test('toPlainText: reduces markdown to one line', () => {
  expect(toPlainText('Returns all [devices](https://docs.seam.co).')).toBe(
    'Returns all devices.',
  )
  expect(toPlainText('Uses `code`\nand **bold**.')).toBe('Uses code and bold.')
  expect(toPlainText("Keeps the device's colon: intact.")).toBe(
    "Keeps the device's colon: intact.",
  )
})

test('firstSentence: stops at the first sentence break', () => {
  expect(firstSentence('First sentence. Second sentence.')).toBe(
    'First sentence.',
  )
  expect(firstSentence('No break here')).toBe('No break here')
})
