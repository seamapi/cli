import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execa } from 'execa'
import { afterAll, beforeAll, expect, test } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const entrypoint = join(projectRoot, 'src', 'bin', 'cli.ts')

const devicesListResponse = {
  devices: [{ device_id: 'device1' }, { device_id: 'device2' }],
  pagination: { has_next_page: false },
  ok: true,
}

const errorResponse = {
  error: { type: 'invalid_input', message: 'Bad request' },
  ok: false,
}

let server: Server
let configHome: string
let requests: Array<{ path: string; body: unknown }> = []
let failNextRequest = false

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      requests.push({ path: req.url ?? '', body: JSON.parse(body || '{}') })

      if (failNextRequest) {
        failNextRequest = false
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify(errorResponse))
        return
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(devicesListResponse))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, resolve))

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Could not determine the test server address')
  }
  // A host without dots: configstore reads nested keys by dot path.
  const endpoint = `http://localhost:${address.port}`

  configHome = await mkdtemp(join(tmpdir(), 'seam-cli-test-'))
  // Configstore keeps its config under $XDG_CONFIG_HOME/configstore.
  await mkdir(join(configHome, 'configstore'))
  await writeFile(
    join(configHome, 'configstore', 'seam-cli.json'),
    JSON.stringify({
      server: endpoint,
      [endpoint]: { pat: 'seam_apikey1_token' },
    }),
  )
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

interface CliResult {
  stdout: string
  stderr: string
  exitCode: number | undefined
}

const runCli = async (
  args: string[],
  { input }: { input?: string } = {},
): Promise<CliResult> => {
  const { stdout, stderr, exitCode } = await execa(
    'node',
    ['--import', 'tsx', entrypoint, ...args],
    {
      cwd: projectRoot,
      env: { XDG_CONFIG_HOME: configHome, FORCE_COLOR: '0' },
      input: input ?? '',
      reject: false,
    },
  )

  return { stdout: String(stdout), stderr: String(stderr), exitCode }
}

test('cli: writes the version to stdout', async () => {
  const { stdout, exitCode } = await runCli(['--version'])

  expect(exitCode).toBe(0)
  expect(stdout).toMatch(/^\d+\.\d+\.\d+$/)
})

test('cli: writes the help guide to stdout', async () => {
  const { stdout, exitCode } = await runCli(['--help'])

  expect(exitCode).toBe(0)
  expect(stdout).toContain('Seam CLI')
})

test('cli: writes only the response to stdout as json', async () => {
  requests = []
  const { stdout, stderr, exitCode } = await runCli(['devices', 'list'])

  expect(exitCode).toBe(0)
  expect(JSON.parse(stdout)).toEqual({
    devices: devicesListResponse.devices,
    pagination: devicesListResponse.pagination,
  })
  expect(stdout).not.toContain('Making request')
  expect(stderr).not.toContain('device1')
})

test('cli: reads request params piped in as json', async () => {
  requests = []
  const { stdout, exitCode } = await runCli(['devices', 'list'], {
    input: JSON.stringify({ limit: 2 }),
  })

  expect(exitCode).toBe(0)
  expect(requests).toHaveLength(1)
  expect(requests[0]?.path).toBe('/devices/list')
  expect(requests[0]?.body).toEqual({ limit: 2 })
  expect(JSON.parse(stdout).devices).toHaveLength(2)
})

test('cli: params given as flags win over params piped in', async () => {
  requests = []
  await runCli(['devices', 'list', '--limit', '5'], {
    input: JSON.stringify({ limit: 2 }),
  })

  expect(requests[0]?.body).toEqual({ limit: 5 })
})

test('cli: does not send cli flags as request params', async () => {
  requests = []
  await runCli(['devices', 'list', '--json', '-y'])

  expect(requests[0]?.body).toEqual({})
})

test('cli: reports invalid json params without writing to stdout', async () => {
  const { stdout, stderr, exitCode } = await runCli(['devices', 'list'], {
    input: 'not json',
  })

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Could not parse JSON from stdin')
})

test('cli: reports an ambiguous command without writing to stdout', async () => {
  const { stdout, stderr, exitCode } = await runCli(['devices'])

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Ambiguous command "/devices"')
})

test('cli: reads request params given inline as json', async () => {
  requests = []
  const { exitCode } = await runCli([
    'devices',
    'list',
    '--json',
    '{"limit": 3}',
  ])

  expect(exitCode).toBe(0)
  expect(requests[0]?.body).toEqual({ limit: 3 })
})

test('cli: pretty prints the response with --no-json', async () => {
  const { stdout, exitCode } = await runCli(['devices', 'list', '--no-json'])

  expect(exitCode).toBe(0)
  expect(stdout).toContain("device_id: 'device1'")
  expect(stdout).not.toContain('"device_id"')
})

test('cli: reports a failed request on stdout and exits non-zero', async () => {
  failNextRequest = true
  const { stdout, stderr, exitCode } = await runCli(['devices', 'list'])

  expect(exitCode).toBe(1)
  expect(JSON.parse(stdout)).toEqual({
    error: { type: 'invalid_input', message: 'Bad request' },
  })
  expect(stderr).toContain('[400]')
})
