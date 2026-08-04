import { expect, test } from 'vitest'

import { selectResponsePayload } from './select-response-payload.js'

test('selectResponsePayload: keeps the response key and pagination', () => {
  const payload = selectResponsePayload(
    {
      devices: [{ device_id: 'abc' }],
      pagination: { has_next_page: false },
      ok: true,
    },
    { responseKey: 'devices' },
  )

  expect(payload).toEqual({
    devices: [{ device_id: 'abc' }],
    pagination: { has_next_page: false },
  })
})

test('selectResponsePayload: drops top level fields outside the response key', () => {
  const payload = selectResponsePayload(
    { device: { device_id: 'abc' }, ok: true, warnings: [] },
    { responseKey: 'device' },
  )

  expect(payload).toEqual({ device: { device_id: 'abc' } })
})

test('selectResponsePayload: drops meta fields without a known response key', () => {
  const payload = selectResponsePayload({
    device: { device_id: 'abc' },
    ok: true,
  })

  expect(payload).toEqual({ device: { device_id: 'abc' } })
})

test('selectResponsePayload: falls back when the response key is absent', () => {
  const payload = selectResponsePayload(
    { health: { ok: true }, ok: true },
    { responseKey: 'devices' },
  )

  expect(payload).toEqual({ health: { ok: true } })
})

test('selectResponsePayload: reports only the error for a failed request', () => {
  const payload = selectResponsePayload(
    {
      error: { type: 'invalid_input', message: 'Bad request' },
      ok: false,
      request_id: 'req_1',
    },
    { responseKey: 'devices' },
  )

  expect(payload).toEqual({
    error: { type: 'invalid_input', message: 'Bad request' },
  })
})

test('selectResponsePayload: passes through non object bodies', () => {
  expect(selectResponsePayload('Bad Gateway')).toBe('Bad Gateway')
  expect(selectResponsePayload(null)).toBe(null)
  expect(selectResponsePayload([1, 2])).toEqual([1, 2])
})
