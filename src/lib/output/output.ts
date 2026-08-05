import { inspect } from 'node:util'

/**
 * Minimal writable surface needed by {@link Output}.
 *
 * Both `process.stdout` and an in-memory buffer satisfy this,
 * which is what makes output testable.
 */
export interface OutputStream {
  write: (chunk: string) => unknown
}

/**
 * `json` is machine readable: only {@link Output.data} produces output.
 * `text` is human readable: data is pretty printed and may be colorized.
 */
export type OutputFormat = 'json' | 'text'

export interface Output {
  readonly format: OutputFormat

  /**
   * The result of a command, e.g., an API response.
   *
   * This is the only thing ever written to stdout,
   * so it is safe to pipe into another program.
   */
  data: (value: unknown) => void

  /**
   * A plain text command result, e.g., the version or the help guide.
   *
   * Written to stdout verbatim in every format: these results are already
   * a single value, so encoding them as JSON would only make them harder
   * to consume from a pipe.
   */
  text: (value: string) => void

  /**
   * Human facing progress, context, and confirmations.
   *
   * Written to stderr and suppressed entirely in the json format.
   */
  info: (message?: string) => void

  /** Human facing warning. Written to stderr in every format. */
  warn: (message: string) => void

  /** Human facing error. Written to stderr in every format. */
  error: (message: string) => void
}

export interface CreateOutputOptions {
  format?: OutputFormat
  stdout?: OutputStream
  stderr?: OutputStream
  /** Colorize pretty printed data. Never applied to the json format. */
  colors?: boolean
}

/**
 * The one {@link Output} implementation: writes to a pair of streams. The
 * process streams make it the real output; in-memory streams make it the
 * test capture (see `create-memory-output.ts`).
 */
export class StreamOutput implements Output {
  readonly format: OutputFormat

  private readonly stdout: OutputStream
  private readonly stderr: OutputStream
  private readonly colors: boolean

  constructor({
    format = 'text',
    stdout = process.stdout,
    stderr = process.stderr,
    colors = false,
  }: CreateOutputOptions = {}) {
    this.format = format
    this.stdout = stdout
    this.stderr = stderr
    this.colors = colors
  }

  data = (value: unknown): void => {
    if (value === undefined) return
    this.stdout.write(`${formatData(value, this.format, this.colors)}\n`)
  }

  text = (value: string): void => {
    this.stdout.write(`${value}\n`)
  }

  info = (message = ''): void => {
    if (this.format === 'json') return
    this.stderr.write(`${message}\n`)
  }

  warn = (message: string): void => {
    this.stderr.write(`${message}\n`)
  }

  error = (message: string): void => {
    this.stderr.write(`${message}\n`)
  }
}

export const createOutput = (options: CreateOutputOptions = {}): Output =>
  new StreamOutput(options)

const formatData = (
  value: unknown,
  format: OutputFormat,
  colors: boolean,
): string => {
  if (format === 'json') return JSON.stringify(value, null, 2)
  if (typeof value === 'string') return value
  return inspect(value, { depth: null, colors })
}
