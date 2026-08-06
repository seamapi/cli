import type { Parameter } from '@seamapi/blueprint'

/** An argument whose value does not fit the parameter's documented format. */
export interface CoercionIssue {
  name: string
  given: unknown
  /** What the parameter takes, e.g., `a number`. */
  expected: string
}

type Coerced = { value: unknown } | { issue: string }

/**
 * Read each argument as the JSON value its parameter documents: booleans and
 * numbers become real booleans and numbers, lists split on commas, objects
 * parse as JSON. The request body is then the same whether a value arrived
 * as an argument, over stdin, or interactively.
 *
 * An argument naming no parameter passes through unchanged: unknown
 * arguments are reported by `assertKnownArgs`, not silently dropped here.
 */
export const coerceArgParams = (
  parameters: Parameter[],
  argParams: Record<string, unknown>,
): { params: Record<string, unknown>; issues: CoercionIssue[] } => {
  const byName = new Map(
    parameters.map((parameter) => [parameter.name, parameter]),
  )

  const params: Record<string, unknown> = {}
  const issues: CoercionIssue[] = []

  for (const [name, given] of Object.entries(argParams)) {
    const parameter = byName.get(name)
    if (parameter == null) {
      params[name] = given
      continue
    }

    const coerced = coerceParam(parameter, given)
    if ('issue' in coerced) {
      issues.push({ name, given, expected: coerced.issue })
      continue
    }
    params[name] = coerced.value
  }

  return { params, issues }
}

export const coerceParam = (parameter: Parameter, given: unknown): Coerced => {
  if (parameter.format === 'list') return coerceList(parameter, given)

  // A repeated argument parses as an array, which only a list accepts.
  if (Array.isArray(given)) return { issue: 'a single value' }

  switch (parameter.format) {
    case 'boolean':
      return coerceBoolean(given)
    case 'number':
      return coerceNumber(given)
    case 'enum':
      return coerceEnum(parameter, given)
    case 'object':
      return coerceObject(given)
    default:
      return { value: String(given) }
  }
}

const coerceBoolean = (given: unknown): Coerced => {
  if (given === true || given === 'true' || given === '1' || given === 1) {
    return { value: true }
  }
  if (given === false || given === 'false' || given === '0' || given === 0) {
    return { value: false }
  }
  return { issue: 'true or false' }
}

const coerceNumber = (given: unknown): Coerced => {
  if (typeof given === 'number') return { value: given }
  if (typeof given === 'string' && given.trim() !== '') {
    const value = Number(given)
    if (!Number.isNaN(value)) return { value }
  }
  return { issue: 'a number' }
}

const coerceEnum = (
  parameter: Parameter & { format: 'enum' },
  given: unknown,
): Coerced => {
  const value = String(given)
  const names = parameter.values.map(({ name }) => name)
  if (!names.includes(value)) return { issue: `one of ${names.join(', ')}` }
  return { value }
}

const coerceObject = (given: unknown): Coerced => {
  if (typeof given !== 'string') return { issue: 'a JSON object' }
  try {
    const value: unknown = JSON.parse(given)
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return { issue: 'a JSON object' }
    }
    return { value }
  } catch {
    return { issue: 'a JSON object' }
  }
}

const coerceList = (
  parameter: Parameter & { format: 'list' },
  given: unknown,
): Coerced => {
  const items = Array.isArray(given)
    ? given
    : typeof given === 'string'
      ? given.split(',')
      : [given]

  const values: unknown[] = []
  for (const item of items) {
    const coerced = coerceListItem(parameter, item)
    if ('issue' in coerced) return coerced
    values.push(coerced.value)
  }
  return { value: values }
}

const coerceListItem = (
  parameter: Parameter & { format: 'list' },
  item: unknown,
): Coerced => {
  if (parameter.itemFormat === 'number') {
    const coerced = coerceNumber(item)
    if ('issue' in coerced) return { issue: 'a list of numbers' }
    return coerced
  }

  if (parameter.itemFormat === 'boolean') {
    const coerced = coerceBoolean(item)
    if ('issue' in coerced) return { issue: 'a list of true or false' }
    return coerced
  }

  if (parameter.itemFormat === 'enum') {
    const value = String(item)
    const names = parameter.itemEnumValues.map(({ name }) => name)
    if (!names.includes(value)) {
      return { issue: `a list of ${names.join(', ')}` }
    }
    return { value }
  }

  return { value: String(item) }
}
