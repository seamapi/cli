import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getActionAttemptWaitOptions, parseCliArgs } from 'lib/args/parse.js'
import { reportErrorAndExit } from 'lib/errors.js'
import { createMemorySeamApi } from 'lib/http/memory-seam-api.js'
import { requestSeamApi } from 'lib/http/request.js'
import { createMemoryOutput } from 'lib/output/memory-output.js'
import {
  failedActionAttempt as failed,
  pendingActionAttempt as pending,
  successfulActionAttempt as success,
} from 'test/fixtures/action-attempt.js'

let exitCodeBefore: number | string | undefined

beforeEach(() => {
  exitCodeBefore = process.exitCode ?? undefined
})

afterEach(() => {
  process.exitCode = exitCodeBefore
  vi.useRealTimers()
})

const response = (actionAttempt: unknown) => ({
  status: 200,
  data: { action_attempt: actionAttempt, ok: true },
})
const actionOptions = {
  path: '/locks/unlock_door',
  params: { device_id: 'device1' },
  responseKey: 'action_attempt',
}

test.each([undefined, true])(
  'requestSeamApi: waits before its sole output with wait=%s, SDK 1s polling',
  async (waitForActionAttempt) => {
    vi.useFakeTimers()
    const api = createMemorySeamApi({
      '/locks/unlock_door': response(pending),
      '/action_attempts/get': [response(pending), response(success)],
    })
    const memory = createMemoryOutput({ format: 'json' })
    const result = requestSeamApi(
      {
        ...actionOptions,
        ...(waitForActionAttempt === undefined ? {} : { waitForActionAttempt }),
      },
      { api, output: memory.output },
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(memory.stdout()).toBe('')
    expect(api.requests).toEqual([
      { path: '/locks/unlock_door', params: { device_id: 'device1' } },
    ])
    await vi.advanceTimersByTimeAsync(999)
    expect(api.requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(memory.stdout()).toBe('')
    await vi.advanceTimersByTimeAsync(1000)
    expect(await result).toEqual({ action_attempt: success, ok: true })
    expect(JSON.parse(memory.stdout())).toEqual({ action_attempt: success })
    expect(memory.stderr()).toBe('')
    expect(api.requests).toEqual([
      { path: '/locks/unlock_door', params: { device_id: 'device1' } },
      {
        path: '/action_attempts/get',
        params: { action_attempt_id: 'attempt1' },
      },
      {
        path: '/action_attempts/get',
        params: { action_attempt_id: 'attempt1' },
      },
    ])
  },
)

test('requestSeamApi: immediate success preserves the full AA and wrapper without polling', async () => {
  const api = createMemorySeamApi({ '/locks/unlock_door': response(success) })
  const memory = createMemoryOutput({ format: 'json' })
  await requestSeamApi(actionOptions, { api, output: memory.output })
  expect(JSON.parse(memory.stdout())).toEqual({ action_attempt: success })
  expect(api.requests).toHaveLength(1)
})

test.each([pending, failed])(
  'requestSeamApi: opt-out returns HTTP-successful $status AA without polling',
  async (initial) => {
    const api = createMemorySeamApi({ '/locks/unlock_door': response(initial) })
    const memory = createMemoryOutput({ format: 'json' })
    await requestSeamApi(
      { ...actionOptions, waitForActionAttempt: false },
      { api, output: memory.output },
    )
    expect(JSON.parse(memory.stdout())).toEqual({ action_attempt: initial })
    expect(api.requests).toHaveLength(1)
    expect(process.exitCode).toBe(exitCodeBefore)
  },
)

test.each([false, true])(
  'requestSeamApi: terminal AA error has stderr only/exit1 (polled=%s)',
  async (polled) => {
    vi.useFakeTimers()
    const api = createMemorySeamApi({
      '/locks/unlock_door': response(polled ? pending : failed),
      '/action_attempts/get': response(failed),
    })
    const memory = createMemoryOutput({ format: 'json' })
    const result = requestSeamApi(actionOptions, {
      api,
      output: memory.output,
    }).catch((error) => reportErrorAndExit(error, memory.output))
    await vi.runAllTimersAsync()
    await result
    expect(memory.stdout()).toBe('')
    expect(memory.stderr()).toContain('The device is offline')
    expect(process.exitCode).toBe(1)
    expect(
      api.requests.filter(({ path }) => path === '/locks/unlock_door'),
    ).toHaveLength(1)
  },
)

test.each([
  [[], 10_000, 1000],
  [
    [
      '--action-attempt-timeout',
      '.1',
      '--action-attempt-polling-interval',
      '.04',
    ],
    100,
    40,
  ],
])(
  'requestSeamApi: timeout budget %j uses one resolver and never resubmits',
  async (flags, timeout, interval) => {
    vi.useFakeTimers()
    const api = createMemorySeamApi({
      '/locks/unlock_door': response(pending),
      '/action_attempts/get': response(pending),
    })
    const memory = createMemoryOutput({ format: 'json' })
    const result = requestSeamApi(
      { ...actionOptions, ...getActionAttemptWaitOptions(parseCliArgs(flags)) },
      { api, output: memory.output },
    ).catch((error) => reportErrorAndExit(error, memory.output))
    await vi.advanceTimersByTimeAsync(timeout - 1)
    expect(memory.stdout()).toBe('')
    expect(memory.stderr()).toBe('')
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(memory.stdout()).toBe('')
    expect(memory.stderr()).toContain(
      `Timed out waiting for action attempt after ${timeout}ms`,
    )
    expect(process.exitCode).toBe(1)
    expect(
      api.requests.filter(({ path }) => path === '/locks/unlock_door'),
    ).toHaveLength(1)
    expect(
      api.requests.filter(({ path }) => path === '/action_attempts/get'),
    ).toHaveLength(Math.ceil(timeout / interval))
  },
)

test.each(['submission', 'poll'])(
  'requestSeamApi: %s HTTP errors keep one structured error payload',
  async (stage) => {
    vi.useFakeTimers()
    const httpError = {
      status: 400,
      data: { error: { type: 'invalid_input', message: 'Bad request' } },
    }
    const api = createMemorySeamApi({
      '/locks/unlock_door':
        stage === 'submission' ? httpError : response(pending),
      '/action_attempts/get': httpError,
    })
    const memory = createMemoryOutput({ format: 'json' })
    const result = requestSeamApi(actionOptions, { api, output: memory.output })
    await vi.runAllTimersAsync()
    expect(await result).toBe(null)
    expect(JSON.parse(memory.stdout())).toEqual({ error: httpError.data.error })
    expect(process.exitCode).toBe(1)
    expect(
      api.requests.filter(({ path }) => path === '/locks/unlock_door'),
    ).toHaveLength(1)
  },
)

test('requestSeamApi: polling runtime errors do not emit the pending result or replay', async () => {
  vi.useFakeTimers()
  const api = createMemorySeamApi({
    '/locks/unlock_door': response(pending),
    '/action_attempts/get': new Error('Connection lost'),
  })
  const memory = createMemoryOutput({ format: 'json' })
  const result = requestSeamApi(actionOptions, {
    api,
    output: memory.output,
  }).catch((error) => reportErrorAndExit(error, memory.output))
  await vi.runAllTimersAsync()
  await result
  expect(memory.stdout()).toBe('')
  expect(memory.stderr()).toContain('Connection lost')
  expect(process.exitCode).toBe(1)
  expect(api.requests).toHaveLength(2)
})

test.each(['devices', 'action_attempts'])(
  'requestSeamApi: %s lists do not poll nested AAs',
  async (responseKey) => {
    const api = createMemorySeamApi({
      '/resources/list': {
        status: 200,
        data: {
          [responseKey]: [pending],
          pagination: { has_next_page: false },
          ok: true,
        },
      },
    })
    const memory = createMemoryOutput({ format: 'json' })
    await requestSeamApi(
      { path: '/resources/list', params: {}, responseKey },
      { api, output: memory.output },
    )
    expect(JSON.parse(memory.stdout())).toEqual({
      [responseKey]: [pending],
      pagination: { has_next_page: false },
    })
    expect(api.requests).toHaveLength(1)
  },
)

test('requestSeamApi: sends the params and reports the trimmed payload', async () => {
  const api = createMemorySeamApi({
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

  const body = await requestSeamApi(
    { path: '/devices/list', params: { limit: 5 }, responseKey: 'devices' },
    { api, output: memory.output },
  )

  // Boundary interaction: the outbound message IS the behavior.
  expect(api.requests).toEqual([
    { path: '/devices/list', params: { limit: 5 } },
  ])
  expect(body).toMatchObject({ devices: [{ device_id: 'device1' }] })
  expect(JSON.parse(memory.stdout())).toEqual({
    devices: [{ device_id: 'device1' }],
    pagination: { has_next_page: false },
  })
  expect(process.exitCode).toBe(exitCodeBefore)
})

test('requestSeamApi: reports an API error and sets the exit code', async () => {
  const api = createMemorySeamApi({
    '/devices/list': {
      status: 400,
      data: {
        error: { type: 'invalid_input', message: 'Bad request' },
        ok: false,
      },
    },
  })
  const memory = createMemoryOutput({ format: 'json' })

  const body = await requestSeamApi(
    { path: '/devices/list', params: { limit: 5 } },
    { api, output: memory.output },
  )

  expect(api.requests).toEqual([
    { path: '/devices/list', params: { limit: 5 } },
  ])
  expect(body).toBe(null)
  expect(JSON.parse(memory.stdout())).toEqual({
    error: { type: 'invalid_input', message: 'Bad request' },
  })
  expect(memory.stderr()).toContain('[400]')
  expect(process.exitCode).toBe(1)
})

test('requestSeamApi: reports the request URL on stderr, never stdout', async () => {
  const api = createMemorySeamApi({
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
