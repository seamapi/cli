import { afterEach, expect, test, vi } from 'vitest'

import { getInteractivity, parseCliArgs } from 'lib/args/parse.js'
import { executeApiCommand } from 'lib/commands/api-command.js'
import { createMemoryConfig } from 'lib/config/memory-config-store.js'
import { type CliContext, resolveAuth } from 'lib/context.js'
import { createMemorySeamApi } from 'lib/http/memory-seam-api.js'
import { createMemoryPrompt } from 'lib/memory-prompt.js'
import { resetOutput, setOutput } from 'lib/output/get-output.js'
import { createMemoryOutput } from 'lib/output/memory-output.js'
import { resetPromptClient, setPromptClient } from 'lib/prompt.js'
import {
  pendingActionAttempt,
  successfulActionAttempt,
} from 'test/fixtures/action-attempt.js'
import { testBlueprint } from 'test/fixtures/blueprint.js'

afterEach(() => {
  vi.useRealTimers()
  resetPromptClient()
  resetOutput()
})

test.each([
  [[], true, 'json'],
  [['--interactive'], true, 'text'],
  [['-y'], true, 'json'],
  [[], false, 'json'],
] as const)(
  'API commands wait without AA confirmation: flags=%j canPrompt=%s format=%s',
  async (flags, canPrompt, format) => {
    vi.useFakeTimers()
    const memory = createMemoryOutput({ format })
    setOutput(memory.output)
    const prompt = createMemoryPrompt(['done'])
    setPromptClient(prompt)
    const api = createMemorySeamApi({
      '/locks/unlock_door': {
        status: 200,
        data: { action_attempt: pendingActionAttempt, ok: true },
      },
      '/action_attempts/get': {
        status: 200,
        data: { action_attempt: successfulActionAttempt, ok: true },
      },
    })
    const argv = ['locks', 'unlock-door', '--device-id', 'device1', ...flags]
    const args = parseCliArgs(argv)
    const config = createMemoryConfig()
    const ctx: CliContext = {
      config,
      auth: resolveAuth(config),
      output: memory.output,
      blueprint: testBlueprint,
      interactivity: getInteractivity(
        {
          ...args,
          interactive: args['interactive'],
          non_interactive: args['non-interactive'],
        },
        { canPrompt },
      ),
      api: async () => api,
    }
    const result = executeApiCommand(
      {
        path: ['locks', 'unlock-door'],
        argv,
        args,
        argParams: {},
        stdinParams: {},
      },
      ctx,
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(memory.stdout()).toBe('')
    await vi.advanceTimersByTimeAsync(1000)
    expect(await result).toEqual({ kind: 'done' })
    expect(prompt.questions.map(({ kind }) => kind)).toEqual(
      ctx.interactivity === 'interactive' ? ['autocomplete'] : [],
    )
    expect(memory.stdout()).toContain('success')
    if (format === 'json') {
      expect(JSON.parse(memory.stdout())).toEqual({
        action_attempt: successfulActionAttempt,
      })
    } else {
      expect(memory.stdout()).toContain('result')
      expect(memory.stdout()).not.toContain('pending')
    }
    expect(api.requests).toEqual([
      { path: '/locks/unlock_door', params: { device_id: 'device1' } },
      {
        path: '/action_attempts/get',
        params: { action_attempt_id: 'attempt1' },
      },
    ])
  },
)

test('action-attempts get waits just like SDK reads; opt-out skips follow-ups even in interactive mode', async () => {
  vi.useFakeTimers()
  const api = createMemorySeamApi({
    '/action_attempts/get': [
      { status: 200, data: { action_attempt: pendingActionAttempt } },
      { status: 200, data: { action_attempt: successfulActionAttempt } },
    ],
  })
  const memory = createMemoryOutput({ format: 'json' })
  setOutput(memory.output)
  const prompt = createMemoryPrompt()
  setPromptClient(prompt)
  const config = createMemoryConfig()
  const ctx: CliContext = {
    config,
    auth: resolveAuth(config),
    output: memory.output,
    blueprint: testBlueprint,
    interactivity: 'auto',
    api: async () => api,
  }
  const argv = ['action-attempts', 'get', '--action-attempt-id', 'attempt1']
  const result = executeApiCommand(
    {
      path: ['action-attempts', 'get'],
      argv,
      args: parseCliArgs(argv),
      argParams: {},
      stdinParams: {},
    },
    ctx,
  )
  await vi.runAllTimersAsync()
  await result
  expect(JSON.parse(memory.stdout())).toEqual({
    action_attempt: successfulActionAttempt,
  })
  expect(api.requests).toHaveLength(2)
  expect(prompt.questions).toEqual([])

  const optedOut = [...argv, '--no-wait-for-action-attempt']
  const pendingApi = createMemorySeamApi({
    '/action_attempts/get': {
      status: 200,
      data: { action_attempt: pendingActionAttempt },
    },
  })
  await executeApiCommand(
    {
      path: ['action-attempts', 'get'],
      argv: optedOut,
      args: parseCliArgs(optedOut),
      argParams: {},
      stdinParams: {},
    },
    { ...ctx, api: async () => pendingApi },
  )
  expect(pendingApi.requests).toHaveLength(1)
  expect(prompt.questions).toEqual([])
})
