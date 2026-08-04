import { createOutput, type Output } from './create-output.js'

let output: Output | null = null

/**
 * The output used by the CLI.
 *
 * Defaults to a `text` output bound to the real process streams,
 * so importing modules never write to stdout by accident.
 */
export const getOutput = (): Output => {
  output ??= createOutput()
  return output
}

/** Replace the output, e.g., once flags are parsed, or from a test. */
export const setOutput = (nextOutput: Output): void => {
  output = nextOutput
}

/** Restore the default output. Intended for tests. */
export const resetOutput = (): void => {
  output = null
}
