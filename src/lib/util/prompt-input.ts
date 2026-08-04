import { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

/**
 * What the prompt does with typed characters, which decides how much of the
 * keymap applies: choice prompts get the full keymap, text prompts keep the
 * caret usable, and confirm prompts keep clack's left/right toggle.
 */
export type PromptInputKind = 'choice' | 'text' | 'confirm'

export interface PromptInputStream extends Readable {
  isTTY: true
  setRawMode: (mode: boolean) => PromptInputStream
}

export interface PromptInputHandle {
  stream: PromptInputStream
  /** Whether the prompt was cancelled by the left arrow to go back. */
  wentBack: () => boolean
  detach: () => void
}

export interface PromptInputSource {
  isTTY?: boolean | undefined
  setRawMode?: ((mode: boolean) => unknown) | undefined
  on: ((event: 'data', listener: (chunk: Buffer) => void) => unknown) &
    ((event: 'end', listener: () => void) => unknown)
  off: ((event: 'data', listener: (chunk: Buffer) => void) => unknown) &
    ((event: 'end', listener: () => void) => unknown)
  pause: () => unknown
  resume: () => unknown
}

// Emacs and vim style control keys, rewritten to the arrow keys they stand
// for before readline can decode them: readline reads ctrl-j as a line feed
// and submits its line, which wipes the typed autocomplete filter.
const navigationKeys: Record<string, string> = {
  '\x10': '\x1B[A', // ctrl-p -> up
  '\x0B': '\x1B[A', // ctrl-k -> up
  '\x0E': '\x1B[B', // ctrl-n -> down
  '\x0A': '\x1B[B', // ctrl-j -> down
}

// Arrow keys arrive as either CSI or SS3 sequences depending on the
// terminal's cursor key mode.
const rightKeys = new Set(['\x1B[C', '\x1BOC'])
const leftKeys = new Set(['\x1B[D', '\x1BOD'])

// Prefixes of a possibly split arrow key sequence, held briefly before
// flushing so a lone escape keypress still cancels the prompt.
const escapePrefixes = new Set(['\x1B', '\x1B[', '\x1BO'])
const escapeHoldMs = 60

// eslint-disable-next-line no-control-regex
const escapeSequences = /\x1B(\[[0-9;]*[A-Za-z~]|O[A-Z])/g

let active = false

/**
 * Read keys from the source terminal for one prompt, applying the keymap.
 *
 * The returned stream is handed to clack as its input: ctrl-p/n/k/j become
 * arrow keys, and while nothing is typed, right submits and left goes back
 * (when the caller supports it) by cancelling the prompt with the back flag
 * set. Left is dropped when back is unsupported, because clack would treat
 * it as up in select prompts. Once something is typed, left and right pass
 * through and move the caret again.
 *
 * Keys are only rewritten when they arrive alone, as raw mode delivers each
 * keypress in its own chunk; pasted text passes through untouched.
 */
export const attachPromptInput = (
  options: { kind: PromptInputKind; allowBack: boolean },
  source: PromptInputSource,
): PromptInputHandle => {
  if (active) throw new Error('A prompt is already reading terminal input')
  active = true

  const stream = Object.assign(new Readable({ read() {} }), {
    isTTY: true as const,
    setRawMode(mode: boolean) {
      if (source.isTTY === true) source.setRawMode?.(mode)
      return stream
    },
  }) as PromptInputStream

  const decoder = new StringDecoder('utf8')
  const translateArrows = options.kind !== 'confirm'
  let typed = 0
  let wentBack = false
  let held = ''
  let holdTimer: NodeJS.Timeout | undefined
  let detached = false
  let ended = false

  const end = (): void => {
    if (ended) return
    ended = true
    stream.push(null)
  }

  const trackTyped = (data: string): void => {
    for (const char of data.replace(escapeSequences, '')) {
      if (char === '\x15') {
        typed = 0 // ctrl-u clears the line
      } else if (char === '\x7F' || char === '\x08') {
        typed = Math.max(0, typed - 1)
      } else if (char >= ' ') {
        typed += 1
      }
    }
  }

  const emit = (data: string): void => {
    if (translateArrows && typed === 0) {
      if (rightKeys.has(data)) {
        stream.push('\r')
        return
      }
      if (leftKeys.has(data)) {
        if (options.allowBack) {
          wentBack = true
          stream.push('\x03')
        }
        return
      }
    }
    trackTyped(data)
    stream.push(data)
  }

  const onData = (chunk: Buffer): void => {
    clearTimeout(holdTimer)
    const data = held + decoder.write(chunk)
    held = ''
    const arrowKey = navigationKeys[data]
    if (arrowKey !== undefined) {
      stream.push(arrowKey)
      return
    }
    if (escapePrefixes.has(data)) {
      held = data
      holdTimer = setTimeout(() => {
        held = ''
        emit(data)
      }, escapeHoldMs)
      return
    }
    emit(data)
  }

  // A terminal that goes away mid-prompt must end the prompt rather than
  // leave it waiting on input that can never arrive.
  const onEnd = (): void => {
    end()
  }

  source.on('data', onData)
  source.on('end', onEnd)
  // Attaching a listener does not resume a source an earlier prompt paused,
  // so every prompt after the first would read nothing without this.
  source.resume()

  return {
    stream,
    wentBack: () => wentBack,
    detach: () => {
      if (detached) return
      detached = true
      clearTimeout(holdTimer)
      source.off('data', onData)
      source.off('end', onEnd)
      // The CLI exits by emptying the event loop, so the source must not be
      // left flowing once the prompt is done with it.
      source.pause()
      end()
      active = false
    },
  }
}
