import { PassThrough } from 'node:stream'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  attachPromptInput,
  type PromptInputHandle,
  type PromptInputKind,
  type PromptInputSource,
} from './prompt-input.js'

const attached: PromptInputHandle[] = []

const attach = (
  options: { kind?: PromptInputKind; allowBack?: boolean } = {},
): {
  source: PassThrough & { isTTY: boolean; setRawMode: (mode: boolean) => void }
  handle: PromptInputHandle
  received: () => string
} => {
  const source = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: vi.fn(),
  })
  const handle = attachPromptInput(
    { kind: options.kind ?? 'choice', allowBack: options.allowBack ?? false },
    source as PromptInputSource,
  )
  attached.push(handle)
  let received = ''
  handle.stream.on('data', (chunk: Buffer) => {
    received += chunk.toString()
  })
  return { source, handle, received: () => received }
}

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  // Only fake setTimeout: the escape hold timer. settle() relies on a real
  // setImmediate to let stream data events fire.
  vi.useFakeTimers({ toFake: ['setTimeout'] })
})

afterEach(() => {
  while (attached.length > 0) attached.pop()?.detach()
  vi.useRealTimers()
})

test('attachPromptInput: rewrites control keys to arrow keys', async () => {
  const { source, received } = attach()
  source.write('\x10') // ctrl-p
  source.write('\x0B') // ctrl-k
  source.write('\x0E') // ctrl-n
  source.write('\x0A') // ctrl-j
  await settle()
  expect(received()).toBe('\x1B[A\x1B[A\x1B[B\x1B[B')
})

test('attachPromptInput: leaves pasted text untouched', async () => {
  const { source, received } = attach()
  source.write('one\ntwo\x10three')
  await settle()
  expect(received()).toBe('one\ntwo\x10three')
})

test('attachPromptInput: right submits while nothing is typed', async () => {
  const { source, received } = attach()
  source.write('\x1B[C')
  source.write('\x1BOC')
  await settle()
  expect(received()).toBe('\r\r')
})

test('attachPromptInput: left goes back when the prompt allows it', async () => {
  const { source, handle, received } = attach({ allowBack: true })
  source.write('\x1B[D')
  await settle()
  expect(received()).toBe('\x03')
  expect(handle.wentBack()).toBe(true)
})

test('attachPromptInput: left does nothing without back support', async () => {
  const { source, handle, received } = attach()
  source.write('\x1B[D')
  source.write('\x1BOD')
  await settle()
  expect(received()).toBe('')
  expect(handle.wentBack()).toBe(false)
})

test('attachPromptInput: typed input restores left and right to the caret', async () => {
  const { source, handle, received } = attach({ allowBack: true })
  source.write('a')
  source.write('\x1B[D')
  source.write('\x1B[C')
  await settle()
  expect(received()).toBe('a\x1B[D\x1B[C')
  expect(handle.wentBack()).toBe(false)
})

test('attachPromptInput: erasing typed input restores back and submit', async () => {
  const { source, handle, received } = attach({ allowBack: true })
  source.write('ab')
  source.write('\x7F')
  source.write('\x7F')
  source.write('\x1B[D')
  await settle()
  expect(received()).toBe('ab\x7F\x7F\x03')
  expect(handle.wentBack()).toBe(true)
})

test('attachPromptInput: ctrl-u clears the typed input count', async () => {
  const { source, received } = attach()
  source.write('several words')
  source.write('\x15')
  source.write('\x1B[C')
  await settle()
  expect(received()).toBe('several words\x15\r')
})

test('attachPromptInput: a multi-byte character counts as one erasable character', async () => {
  const { source, received } = attach()
  source.write('é')
  source.write('\x7F')
  source.write('\x1B[C')
  await settle()
  expect(received()).toBe('é\x7F\r')
})

test('attachPromptInput: confirm prompts keep their left and right toggle', async () => {
  const { source, handle, received } = attach({
    kind: 'confirm',
    allowBack: true,
  })
  source.write('\x1B[D')
  source.write('\x1B[C')
  source.write('\x10')
  await settle()
  expect(received()).toBe('\x1B[D\x1B[C\x1B[A')
  expect(handle.wentBack()).toBe(false)
})

test('attachPromptInput: reassembles an arrow key split across chunks', async () => {
  const { source, handle, received } = attach({ allowBack: true })
  source.write('\x1B')
  source.write('[D')
  await settle()
  expect(received()).toBe('\x03')
  expect(handle.wentBack()).toBe(true)
})

test('attachPromptInput: a lone escape still reaches the prompt', async () => {
  const { source, received } = attach()
  source.write('\x1B')
  await settle()
  expect(received()).toBe('')
  vi.advanceTimersByTime(100)
  await settle()
  expect(received()).toBe('\x1B')
})

test('attachPromptInput: forwards raw mode to a terminal source', () => {
  const { source, handle } = attach()
  handle.stream.setRawMode(true)
  expect(source.setRawMode).toHaveBeenCalledWith(true)

  source.isTTY = false
  handle.stream.setRawMode(false)
  expect(source.setRawMode).not.toHaveBeenCalledWith(false)
})

test('attachPromptInput: detach stops reading and allows the next prompt', async () => {
  const first = attach()
  first.handle.detach()
  first.source.write('\x10')
  await settle()
  expect(first.received()).toBe('')

  const second = attach()
  second.source.write('\x10')
  await settle()
  expect(second.received()).toBe('\x1B[A')
})

test('attachPromptInput: keeps reading a source an earlier prompt paused', async () => {
  const first = attach()
  const source = first.source
  first.handle.detach()

  const handle = attachPromptInput(
    { kind: 'choice', allowBack: false },
    source as PromptInputSource,
  )
  attached.push(handle)
  let received = ''
  handle.stream.on('data', (chunk: Buffer) => {
    received += chunk.toString()
  })

  source.write('\x0E')
  await settle()
  expect(received).toBe('\x1B[B')
})

test('attachPromptInput: ends the prompt when the terminal goes away', async () => {
  const { source, handle } = attach()
  const ended = new Promise((resolve) => handle.stream.on('end', resolve))
  source.end()
  await expect(ended).resolves.toBeUndefined()
})

test('attachPromptInput: refuses to attach twice', () => {
  attach()
  expect(() => attach()).toThrow('already reading')
})
