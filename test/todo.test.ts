import test from 'ava'

import { todo } from '@seamapi/cli'

test('todo: returns argument', (t) => {
  t.is(todo('todo'), 'todo', 'returns input')
})
