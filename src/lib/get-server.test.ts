import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getConfigStore } from './config/index.js'
import { endpointEnvVar } from './env.js'
import { getServer } from './get-server.js'

const storedConfig: Record<string, unknown> = {}

vi.mock('./config/index.js', () => ({
  getConfigStore: vi.fn(() => ({
    get: (key: string) => storedConfig[key],
  })),
}))

beforeEach(() => {
  for (const key of Object.keys(storedConfig)) {
    delete storedConfig[key]
  }
  delete process.env[endpointEnvVar]
})

afterEach(() => {
  delete process.env[endpointEnvVar]
  vi.mocked(getConfigStore).mockClear()
})

test('getServer: reads the stored server', () => {
  storedConfig['server'] = 'https://connect.example.com'

  expect(getServer()).toBe('https://connect.example.com')
})

test('getServer: defaults to Seam', () => {
  expect(getServer()).toBe('https://connect.getseam.com')
})

test(`getServer: ${endpointEnvVar} wins over the stored server`, () => {
  storedConfig['server'] = 'https://connect.example.com'
  process.env[endpointEnvVar] = 'http://localhost:3020'

  expect(getServer()).toBe('http://localhost:3020')
})

test(`getServer: ${endpointEnvVar} is used without a stored server`, () => {
  process.env[endpointEnvVar] = 'http://localhost:3020'

  expect(getServer()).toBe('http://localhost:3020')
})

test(`getServer: ignores an empty ${endpointEnvVar}`, () => {
  storedConfig['server'] = 'https://connect.example.com'
  process.env[endpointEnvVar] = ''

  expect(getServer()).toBe('https://connect.example.com')
})
