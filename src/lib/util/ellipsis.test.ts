import test from 'ava'

import { ellipsis } from './ellipsis.js'

test('ellipsis: truncates only when over the limit', (t) => {
  t.is(ellipsis('seam', 10), 'seam', 'returns short input unchanged')
  t.is(ellipsis('seam-cli', 6), 'sea...', 'truncates to the limit')
})
