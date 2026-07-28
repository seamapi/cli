import { expect, test } from 'vitest'

import { ellipsis } from './ellipsis.js'

test('ellipsis: truncates only when over the limit', () => {
  expect(ellipsis('seam', 10)).toBe('seam')
  expect(ellipsis('seam-cli', 6)).toBe('sea...')
})
