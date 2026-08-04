import type { Readable } from 'node:stream'

export interface StdinLike extends AsyncIterable<string | Buffer> {
  isTTY?: boolean | undefined
}

/**
 * Read request params piped into the CLI, e.g.,
 *
 * ```
 * $ echo '{"device_id": "..."}' | seam locks unlock-door --json
 * $ seam locks unlock-door --json < params.json
 * ```
 *
 * Returns null when stdin is a terminal or is empty,
 * so an interactive session is never blocked waiting for input.
 */
export const readStdinJson = async (
  stdin: StdinLike | Readable = process.stdin,
): Promise<Record<string, unknown> | null> => {
  if ((stdin as StdinLike).isTTY ?? false) return null

  let raw = ''
  for await (const chunk of stdin) {
    raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  }

  return parseJsonParams(raw, 'stdin')
}

/**
 * Parse JSON request params, e.g., from stdin or `--json '{"limit": 2}'`.
 *
 * Returns null when there is nothing to parse.
 */
export const parseJsonParams = (
  raw: string,
  source: string,
): Record<string, unknown> | null => {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    throw new Error(
      `Could not parse JSON from ${source}: ${(error as Error).message}`,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Expected a JSON object of request params from ${source}, got ${Array.isArray(parsed) ? 'an array' : typeof parsed}`,
    )
  }

  return parsed as Record<string, unknown>
}
