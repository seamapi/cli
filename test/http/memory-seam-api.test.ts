import { expect, test } from 'vitest'

import { createMemorySeamApi } from 'lib/http/memory-seam-api.js'

test('memory wire consumes responses in order and repeats the last response', async () => {
  const first = { devices: [{ device_id: 'first' }], ok: true }
  const last = { devices: [{ device_id: 'last' }], ok: true }
  const api = createMemorySeamApi({
    '/devices/list': [
      { status: 200, data: first },
      { status: 200, data: last },
    ],
  })

  const responses = []
  for (let index = 0; index < 3; index++) {
    responses.push(
      await api
        .createRequest({ path: '/devices/list', params: {} })
        .fetchResponse(),
    )
  }
  expect(responses).toEqual([first, last, last])
  expect(api.requests).toHaveLength(3)
})

test.each([{}, { '/devices/list': [] }])(
  'memory wire retains missing/empty-route 404 fallback: %j',
  async (routes) => {
    const api = createMemorySeamApi(routes)
    await expect(
      api.createRequest({ path: '/devices/list', params: {} }).fetchResponse(),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'not_found',
      message: 'Not Found',
    })
  },
)
