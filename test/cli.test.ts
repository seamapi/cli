import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
let endpoint: string
let stateHome: string
let configHome: string
let loggedOutStateHome: string
let otherServerConfigHome: string
let requests: Array<{
  path: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
}> = []
let failNextRequest = false

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      requests.push({
        path: req.url ?? '',
        body: JSON.parse(body || '{}'),
        headers: req.headers,
      })

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
  endpoint = `http://localhost:${address.port}`

  // Settings live under the config dir, auth state under the state dir.
  const home = await mkdtemp(join(tmpdir(), 'seam-cli-test-'))
  configHome = join(home, 'config')
  stateHome = join(home, 'state')
  await mkdir(join(configHome, 'seam'), { recursive: true })
  await mkdir(join(stateHome, 'seam'), { recursive: true })
  await writeFile(
    join(configHome, 'seam', 'cli.json'),
    JSON.stringify({ server: endpoint }),
  )
  await writeFile(
    join(stateHome, 'seam', 'cli.json'),
    JSON.stringify({ [endpoint]: { pat: 'seam_apikey1_token' } }),
  )

  // The same settings without a stored token, i.e., not logged in.
  loggedOutStateHome = join(home, 'logged-out-state')
  await mkdir(join(loggedOutStateHome, 'seam'), { recursive: true })

  // Settings pointing at a server nothing is listening on.
  otherServerConfigHome = join(home, 'other-server-config')
  await mkdir(join(otherServerConfigHome, 'seam'), { recursive: true })
  await writeFile(
    join(otherServerConfigHome, 'seam', 'cli.json'),
    JSON.stringify({ server: 'http://localhost:1' }),
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
  {
    input,
    env,
    configHome: configHomeOverride,
    stateHome: stateHomeOverride,
  }: {
    input?: string
    env?: Record<string, string>
    configHome?: string
    stateHome?: string
  } = {},
): Promise<CliResult> => {
  const { stdout, stderr, exitCode } = await execa(
    'node',
    ['--import', 'tsx', entrypoint, ...args],
    {
      cwd: projectRoot,
      env: {
        XDG_CONFIG_HOME: configHomeOverride ?? configHome,
        XDG_STATE_HOME: stateHomeOverride ?? stateHome,
        FORCE_COLOR: '0',
        // Never inherit credentials from the environment running the tests.
        SEAM_CLI_TOKEN: undefined,
        SEAM_CLI_WORKSPACE_ID: undefined,
        SEAM_CLI_ENDPOINT: undefined,
        ...env,
      },
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

test('cli: sends a page cursor as the opaque string it is', async () => {
  requests = []
  const { exitCode } = await runCli([
    'devices',
    'list',
    '--page-cursor',
    '0755',
  ])

  expect(exitCode).toBe(0)
  expect(requests[0]?.path).toBe('/devices/list')
  expect(requests[0]?.body).toEqual({ page_cursor: '0755' })
})

test('cli: documents --page-cursor for a paginated command', async () => {
  const { stdout, exitCode } = await runCli(['devices', 'list', '--help'])

  expect(exitCode).toBe(0)
  expect(stdout).toContain('--page-cursor')
})

test('cli: reports an unknown argument rather than sending it', async () => {
  requests = []
  const { stdout, stderr, exitCode } = await runCli([
    'devices',
    'list',
    '--limitt',
    '5',
  ])

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Unknown parameter for /devices/list: --limitt')
  expect(stderr).toContain("Run 'seam devices list --help'")
  expect(requests).toHaveLength(0)
})

test('cli: reports an unknown argument to a command it handles itself', async () => {
  const { stdout, stderr, exitCode } = await runCli([
    'select',
    'server',
    '--serverr',
    'https://example.com',
  ])

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Unknown parameter for select server: --serverr')
  expect(stderr).toContain("Run 'seam select server --help'")
})

test('cli: reports an unknown argument to a command taking none', async () => {
  const { stderr, exitCode } = await runCli(['completion', 'bash', '--shell'])

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Unknown parameter for completion bash: --shell')
})

test('cli: takes the arguments a command it handles itself accepts', async () => {
  const { stdout, exitCode } = await runCli(['completion', 'bash'])

  expect(exitCode).toBe(0)
  expect(stdout).toContain('complete -F _seam_completion seam')
})

test('cli: names every unknown argument at once', async () => {
  requests = []
  const { stderr, exitCode } = await runCli([
    'devices',
    'list',
    '--limitt',
    '5',
    '--pagecursor',
    'abc',
  ])

  expect(exitCode).toBe(1)
  expect(stderr).toContain(
    'Unknown parameters for /devices/list: --limitt --pagecursor',
  )
  expect(requests).toHaveLength(0)
})

test('cli: reports an unknown short argument as the short form', async () => {
  requests = []
  const { stderr, exitCode } = await runCli(['devices', 'list', '-n'])

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Unknown parameter for /devices/list: -n')
  expect(requests).toHaveLength(0)
})

test('cli: sends an argument once, however it is written', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list', '--LIMIT', '5'])

  expect(exitCode).toBe(0)
  expect(requests[0]?.body).toEqual({ limit: 5 })
})

test('cli: does not hold params read from stdin to the command', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list'], {
    input: JSON.stringify({ limit: 2, nope: true }),
  })

  expect(exitCode).toBe(0)
  expect(requests[0]?.body).toEqual({ limit: 2, nope: true })
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

test('cli: reports an incomplete command without writing to stdout', async () => {
  const { stdout, stderr, exitCode } = await runCli(['devices'])

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Incomplete command "seam devices"')
})

test('cli: reports missing required params rather than prompting', async () => {
  const { stdout, stderr, exitCode } = await runCli(['locks', 'unlock-door'])

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain(
    'Missing required parameter for /locks/unlock_door: --device-id',
  )
})

test('cli: takes --json in any position without consuming an argument', async () => {
  requests = []
  const { stdout, exitCode } = await runCli(['--json', 'devices', 'list'])

  expect(exitCode).toBe(0)
  expect(requests[0]?.path).toBe('/devices/list')
  expect(requests[0]?.body).toEqual({})
  expect(JSON.parse(stdout).devices).toHaveLength(2)
})

test('cli: pretty prints the response with --no-json', async () => {
  const { stdout, exitCode } = await runCli(['devices', 'list', '--no-json'])

  expect(exitCode).toBe(0)
  expect(stdout).toContain("device_id: 'device1'")
  expect(stdout).not.toContain('"device_id"')
})

test('cli: SEAM_CLI_TOKEN wins over the stored token', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list'], {
    env: { SEAM_CLI_TOKEN: 'seam_apikey1_from_env' },
  })

  expect(exitCode).toBe(0)
  expect(requests[0]?.headers['authorization']).toBe(
    'Bearer seam_apikey1_from_env',
  )
})

test('cli: SEAM_CLI_TOKEN authenticates without logging in', async () => {
  requests = []
  const { exitCode, stderr } = await runCli(['devices', 'list'], {
    env: { SEAM_CLI_TOKEN: 'seam_apikey1_from_env' },
    stateHome: loggedOutStateHome,
  })

  expect(exitCode).toBe(0)
  expect(stderr).not.toContain('Not logged in')
  expect(requests[0]?.headers['authorization']).toBe(
    'Bearer seam_apikey1_from_env',
  )
})

test('cli: reports not being logged in without SEAM_CLI_TOKEN', async () => {
  const { stdout, stderr, exitCode } = await runCli(['devices', 'list'], {
    stateHome: loggedOutStateHome,
  })

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Not logged in')
  expect(stderr).toContain('SEAM_CLI_TOKEN')
})

test('cli: SEAM_CLI_WORKSPACE_ID sets the workspace for the request', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list'], {
    env: {
      SEAM_CLI_TOKEN: 'seam_at1_from_env',
      SEAM_CLI_WORKSPACE_ID: 'workspace_from_env',
    },
  })

  expect(exitCode).toBe(0)
  expect(requests[0]?.headers['authorization']).toBe('Bearer seam_at1_from_env')
  expect(requests[0]?.headers['seam-workspace']).toBe('workspace_from_env')
})

test('cli: SEAM_CLI_ENDPOINT wins over the stored server', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list'], {
    configHome: otherServerConfigHome,
    env: { SEAM_CLI_ENDPOINT: endpoint },
  })

  expect(exitCode).toBe(0)
  expect(requests[0]?.path).toBe('/devices/list')
})

test('cli: uses the stored server without SEAM_CLI_ENDPOINT', async () => {
  requests = []
  const { exitCode } = await runCli(['devices', 'list'], {
    configHome: otherServerConfigHome,
  })

  expect(exitCode).toBe(1)
  expect(requests).toHaveLength(0)
})

test('cli: refuses to log in while SEAM_CLI_TOKEN is set', async () => {
  const { stdout, stderr, exitCode } = await runCli(
    ['login', '--token', 'seam_apikey1_stored'],
    { env: { SEAM_CLI_TOKEN: 'seam_apikey1_from_env' } },
  )

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Cannot log in while SEAM_CLI_TOKEN is set')
  expect(stderr).not.toContain('CLI Error')
})

test('cli: refuses to select a workspace while SEAM_CLI_WORKSPACE_ID is set', async () => {
  const { stdout, stderr, exitCode } = await runCli(['select', 'workspace'], {
    env: { SEAM_CLI_WORKSPACE_ID: 'workspace_from_env' },
  })

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain(
    'Cannot select a workspace while SEAM_CLI_WORKSPACE_ID is set',
  )
})

test('cli: refuses to log in with a workspace while SEAM_CLI_WORKSPACE_ID is set', async () => {
  const { stderr, exitCode } = await runCli(
    ['login', '--token', 'seam_apikey1_stored', '--workspace-id', 'workspace1'],
    { env: { SEAM_CLI_WORKSPACE_ID: 'workspace_from_env' } },
  )

  expect(exitCode).toBe(1)
  expect(stderr).toContain(
    'Cannot select a workspace while SEAM_CLI_WORKSPACE_ID is set',
  )
})

test('cli: refuses to select a server while SEAM_CLI_ENDPOINT is set', async () => {
  const { stdout, stderr, exitCode } = await runCli(
    ['select', 'server', '--server', 'https://connect.example.com'],
    { env: { SEAM_CLI_ENDPOINT: endpoint } },
  )

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain(
    'Cannot select a server while SEAM_CLI_ENDPOINT is set',
  )
})

test('cli: refuses to log out while SEAM_CLI_TOKEN is set', async () => {
  const { stderr, exitCode } = await runCli(['logout'], {
    env: { SEAM_CLI_TOKEN: 'seam_apikey1_from_env' },
  })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Cannot log out while SEAM_CLI_TOKEN is set')
})

test('cli: reports no workspace for a personal access token without one', async () => {
  const { stdout, stderr, exitCode } = await runCli(['devices', 'list'], {
    env: { SEAM_CLI_TOKEN: 'seam_at1_from_env' },
  })

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('No workspace selected')
  expect(stderr).toContain('SEAM_CLI_WORKSPACE_ID')
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

// Logout gets its own state, since logging out of the shared one would
// unauthenticate every other test in this file.
const createLoggedInStateHome = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'seam-cli-logout-'))
  await mkdir(join(home, 'seam'), { recursive: true })
  await writeFile(
    join(home, 'seam', 'cli.json'),
    JSON.stringify({
      [endpoint]: { pat: 'seam_apikey1_token' },
      current_workspace_id: 'workspace1',
    }),
  )
  return home
}

const readStoredState = async (home: string): Promise<unknown> =>
  JSON.parse(await readFile(join(home, 'seam', 'cli.json'), 'utf8'))

test('cli: logout removes the stored token', async () => {
  const home = await createLoggedInStateHome()

  const { exitCode } = await runCli(['logout'], { stateHome: home })

  expect(exitCode).toBe(0)
  expect(await readStoredState(home)).toEqual({ [endpoint]: {} })
})

test('cli: logout leaves the cli unauthenticated', async () => {
  const home = await createLoggedInStateHome()

  await runCli(['logout'], { stateHome: home })
  const { stderr, exitCode } = await runCli(['devices', 'list'], {
    stateHome: home,
  })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Not logged in')
})

test('cli: logout keeps a token stored for another server', async () => {
  const home = await createLoggedInStateHome()
  await writeFile(
    join(home, 'seam', 'cli.json'),
    JSON.stringify({
      [endpoint]: { pat: 'seam_apikey1_token' },
      'http://localhost:1': { pat: 'seam_apikey1_other' },
    }),
  )

  await runCli(['logout'], { stateHome: home })

  expect(await readStoredState(home)).toEqual({
    [endpoint]: {},
    'http://localhost:1': { pat: 'seam_apikey1_other' },
  })
})
