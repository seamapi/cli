/**
 * Top level response fields that are transport details,
 * not part of the result the CLI reports.
 */
const metaKeys = new Set(['ok'])

const paginationKey = 'pagination'
const errorKey = 'error'

export interface SelectResponsePayloadOptions {
  /**
   * The response key for the endpoint, e.g., `devices` for `/devices/list`,
   * usually taken from the API blueprint.
   *
   * When omitted, every top level field except {@link metaKeys} is kept.
   */
  responseKey?: string | null | undefined
}

/**
 * Reduce an API response body to the response key and pagination.
 *
 * The CLI never reports other top level fields: they are details of the
 * transport, so including them would leak into anything parsing stdout.
 */
export const selectResponsePayload = (
  data: unknown,
  { responseKey }: SelectResponsePayloadOptions = {},
): unknown => {
  if (!isRecord(data)) return data

  if (errorKey in data) {
    return { [errorKey]: data[errorKey] }
  }

  const keys =
    responseKey != null && responseKey in data
      ? [responseKey]
      : Object.keys(data).filter(
          (key) => !metaKeys.has(key) && key !== paginationKey,
        )

  const payload: Record<string, unknown> = {}
  for (const key of keys) {
    payload[key] = data[key]
  }

  if (paginationKey in data) {
    payload[paginationKey] = data[paginationKey]
  }

  return payload
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
