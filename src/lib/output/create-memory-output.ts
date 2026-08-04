import {
  createOutput,
  type CreateOutputOptions,
  type Output,
  type OutputStream,
} from './create-output.js'

export interface MemoryOutput {
  output: Output
  /** Everything written to stdout so far. */
  stdout: () => string
  /** Everything written to stderr so far. */
  stderr: () => string
}

const createMemoryStream = (): OutputStream & { read: () => string } => {
  const chunks: string[] = []
  return {
    write: (chunk: string) => chunks.push(chunk),
    read: () => chunks.join(''),
  }
}

/**
 * An {@link Output} that captures writes in memory instead of
 * touching the process streams, for asserting on CLI output.
 */
export const createMemoryOutput = (
  options: Omit<CreateOutputOptions, 'stdout' | 'stderr'> = {},
): MemoryOutput => {
  const stdout = createMemoryStream()
  const stderr = createMemoryStream()

  return {
    output: createOutput({ ...options, stdout, stderr }),
    stdout: stdout.read,
    stderr: stderr.read,
  }
}
