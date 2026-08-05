import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemorySeamApi } from 'lib/http/create-memory-seam-api.js'
import { requestSeamApi } from 'lib/http/request.js'
import { createMemoryOutput } from 'lib/output/create-memory-output.js'

let exitCodeBefore: number | string | undefined

beforeEach(() => {
  exitCodeBefore = process.exitCode ?? undefined
})

afterEach(() => {
  process.exitCode = exitCodeBefore
})

test('requestSeamApi: sends the params and reports the trimmed payload', async () => {
  const { api, requests } = createMemorySeamApi({
    '/devices/list': {
      status: 200,
      data: {
        devices: [{ device_id: 'device1' }],
        pagination: { has_next_page: false },
        ok: true,
      },
    },
  })
  const memory = createMemoryOutput({ format: 'json' })

  const response = await requestSeamApi(
    { path: '/devices/list', params: { limit: 5 }, responseKey: 'devices' },
    { api, output: memory.output },
  )

  // Boundary interaction: the outbound message IS the behavior.
  expect(requests).toEqual([{ path: '/devices/list', params: { limit: 5 } }])
  expect(response.status).toBe(200)
  expect(JSON.parse(memory.stdout())).toEqual({
    devices: [{ device_id: 'device1' }],
    pagination: { has_next_page: false },
  })
  expect(process.exitCode).toBe(exitCodeBefore)
})

test('requestSeamApi: reports an error payload and sets the exit code', async () => {
  const { api, requests } = createMemorySeamApi({
    '/devices/list': {
      status: 400,
      data: { error: { type: 'invalid_input' }, ok: false },
    },
  })
  const memory = createMemoryOutput({ format: 'json' })

  await requestSeamApi(
    { path: '/devices/list', params: { limit: 5 } },
    { api, output: memory.output },
  )

  expect(requests).toEqual([{ path: '/devices/list', params: { limit: 5 } }])
  expect(memory.stdout()).toContain('invalid_input')
  expect(memory.stderr()).toContain('[400]')
  expect(process.exitCode).toBe(1)
})

test('requestSeamApi: keeps the request banner out of stdout', async () => {
  const { api } = createMemorySeamApi({
    '/devices/list': { status: 200, data: { devices: [], ok: true } },
  })
  const memory = createMemoryOutput({ format: 'text' })

  await requestSeamApi(
    { path: '/devices/list', params: {}, responseKey: 'devices' },
    { api, output: memory.output },
  )

  expect(memory.stderr()).toContain('/devices/list')
  expect(memory.stderr()).toContain('Request Params:')
  expect(memory.stdout()).not.toContain('Request Params:')
})
