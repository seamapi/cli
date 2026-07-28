#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import commandLineUsage from 'command-line-usage'
import parseArgs, { type ParsedArgs } from 'minimist'

import { getApiBlueprint } from 'lib/get-api-blueprint.js'
import { getConfigStore } from 'lib/get-config-store.js'
import { getResponseKey } from 'lib/get-response-key.js'
import { getServer } from 'lib/get-server.js'
import { interactForActionAttemptPoll } from 'lib/interact-for-action-attempt-poll.js'
import { interactForCommandParams } from 'lib/interact-for-command-params.js'
import { interactForCommandSelection } from 'lib/interact-for-command-selection.js'
import { interactForLogin } from 'lib/interact-for-login.js'
import { interactForServerSelection } from 'lib/interact-for-server-selection.js'
import { interactForUseRemoteApiDefs } from 'lib/interact-for-use-remote-api-defs.js'
import { interactForWorkspaceId } from 'lib/interact-for-workspace-id.js'
import { createOutput, type OutputFormat } from 'lib/output/create-output.js'
import { getOutput, setOutput } from 'lib/output/get-output.js'
import type { ContextHelpers } from 'lib/types.js'
import { canPrompt, prompt } from 'lib/util/prompt.js'
import { parseJsonParams, readStdinJson } from 'lib/util/read-stdin-json.js'
import { RequestSeamApi } from 'lib/util/request-seam-api.js'
import { validateToken } from 'lib/validate-token.js'
import seamapiCliVersion from 'lib/version.js'

const sections = [
  {
    header: 'Seam CLI',
    content:
      'Every seam command is interactive and will prompt you for any missing required properties with helpful suggestions. To avoid automatic behavior, pass -y ',
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'help',
        description: 'Display this help guide.',
        alias: 'h',
        type: Boolean,
      },
      {
        name: 'json',
        description:
          'Read request params as JSON from stdin and write the response to stdout as JSON. Enabled automatically when stdout is not a terminal, disable with {bold --no-json}.',
        type: Boolean,
      },
      {
        name: 'y',
        description:
          'Do not prompt: use the given params and take the first suggestion.',
        type: Boolean,
      },
    ],
  },
  {
    header: 'Output',
    content: [
      'Only the response is written to stdout, so it is safe to pipe. Prompts, progress, and other information are written to stderr.',
      'The response is trimmed to the response key and pagination.',
    ],
  },
  {
    header: 'Command List Examples',
    content: [
      { name: 'seam', summary: 'Interactively select commands to execute.' },
      { name: 'seam login', summary: 'Login to Seam.' },
      { name: 'seam select workspace', summary: 'Select your workspace.' },
      {
        name: 'seam connect-webviews create',
        summary: 'Create a connect webview to connect devices.',
      },
      { name: 'seam devices list', summary: 'List devices in your workspace.' },
      {
        name: 'seam locks unlock-door {bold --device-id} $MY_DOOR',
        summary: 'Unlock a lock.',
      },
      {
        name: "seam access-codes create {bold --code} '1234' {bold --name} 'My Code'",
        summary: 'Create an access code.',
      },
      {
        name: 'seam access-codes list {bold --device-id} $MY_DOOR',
        summary: 'List you access codes.',
      },
      {
        name: 'seam devices list {bold --json} > devices.json',
        summary: 'Write the response to a file as JSON.',
      },
      {
        name: 'seam locks unlock-door {bold --json} < params.json',
        summary: 'Read request params from a JSON file.',
      },
      {
        name: 'cat params.json | seam locks unlock-door {bold --json}',
        summary: 'Pipe request params in as JSON.',
      },
    ],
  },
]

/**
 * Flags that configure the CLI itself and are never sent as request params.
 */
const cliFlags = new Set([
  '_',
  'h',
  'help',
  'json',
  'remote-api-defs',
  'remote_api_defs',
  'version',
  'y',
])

async function cli(args: ParsedArgs) {
  const config = getConfigStore()
  const output = getOutput()

  if (args['help'] === true || args['h'] === true) {
    output.text(commandLineUsage(sections))
    return
  }

  if (args['version'] === true) {
    output.text(seamapiCliVersion)
    return
  }

  if (
    args._[0] === 'config' &&
    args._[1] === 'set' &&
    args._[2] === 'fake-server'
  ) {
    const randomstring = randomBytes(5).toString('hex')
    const fakeApiUrl = `https://${randomstring}.fakeseamconnect.seam.vc`

    config.set('server', fakeApiUrl)
    output.info(`Server URL set to ${fakeApiUrl}`)

    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return
  }

  if (
    !config.get(`${getServer()}.pat`) &&
    args._[0] !== 'login' &&
    !isEqual(args._, ['select', 'server'])
  ) {
    output.error(`Not logged in. Please run "seam login"`)
    process.exitCode = 1
    return
  }

  args._ = args._.map((arg) => arg.toLowerCase().replace(/_/g, '-'))
  for (const k in args) {
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }

  const use_remote_api_defs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  const blueprint = await getApiBlueprint(use_remote_api_defs ?? false)

  const commandParams: Record<string, any> = {
    ...(await readParamsFromStdin(args)),
  }

  /**
   * Whether or not to auto-select first option.
   *
   * Piped or redirected input holds request params, not answers,
   * so there is nobody to ask.
   */
  const is_interactive = args['y'] !== true && canPrompt()

  const ctx: ContextHelpers = {
    blueprint,
    is_interactive,
  }

  for (const k in args) {
    if (k === '_') continue
    const v = args[k]
    delete args[k]
    const key = k.replace(/-/g, '_')
    args[key] = v
    if (!cliFlags.has(k) && !cliFlags.has(key)) {
      commandParams[key] = v
    }
  }

  const selectedCommand = await interactForCommandSelection(args._, ctx)
  if (isEqual(selectedCommand, ['login'])) {
    if (args['server']) {
      config.set('server', args['server'])
      config.delete('current_workspace_id')
    }
    if (args['token']) {
      const token = String(args['token']).trim()
      await validateToken(token, args['workspace_id'])
      config.set(`${getServer()}.pat`, token)
      config.delete('current_workspace_id')
    }
    if (args['workspace_id']) {
      config.set(`current_workspace_id`, args['workspace_id'])
    }
    if (args['token'] || args['workspace_id'] || args['server']) {
      return
    }
    await interactForLogin()
    return
  } else if (isEqual(selectedCommand, ['logout'])) {
    config.delete('pat')
    output.info('Logged out!')
    return
  } else if (isEqual(selectedCommand, ['config', 'reveal-location'])) {
    output.text(config.path)
    return
  } else if (isEqual(selectedCommand, ['config', 'use-remote-api-defs'])) {
    await interactForUseRemoteApiDefs()
    return
  } else if (isEqual(selectedCommand, ['select', 'workspace'])) {
    await interactForWorkspaceId()
    return
  } else if (isEqual(selectedCommand, ['events', 'list'])) {
    if (!commandParams['since']) {
      const date = new Date()
      date.setMonth(date.getMonth() - 1)
      commandParams['since'] = date.toISOString()
    }
  } else if (isEqual(selectedCommand, ['select', 'server'])) {
    if (args['server']) {
      config.set('server', args['server'])
      config.delete('current_workspace_id')
      return
    }
    await interactForServerSelection()
    return
  } else if (isEqual(selectedCommand, ['health', 'get-health'])) {
    await RequestSeamApi({
      path: '/health/get_health',
      params: {},
    })

    return
  }
  // TODO - do this using the OpenAPI spec for the command rather than
  // explicitly encoding the property names
  if (commandParams['accepted_providers']) {
    commandParams['accepted_providers'] =
      commandParams['accepted_providers'].split(',')
  }

  // Hit 'back' on a top-level command path, so we start again
  const lastCommandPath = selectedCommand.slice(-1)[0]
  if (lastCommandPath === '[Back]') {
    return await cli({
      ...args,
      _: [],
    })
  }

  const params = await interactForCommandParams(
    { command: selectedCommand, params: commandParams },
    ctx,
  )

  if (params === '[Back]') {
    const previousCommands = [...selectedCommand]
    previousCommands.pop()
    return await cli({
      ...args,
      _: previousCommands,
    })
  }

  const apiPath = `/${selectedCommand.join('/').replace(/-/g, '_')}`

  if (apiPath.includes('/events/list') && params.between) {
    delete params.since
  }

  const response = await RequestSeamApi({
    path: apiPath,
    params,
    responseKey: getResponseKey(selectedCommand, ctx),
  })

  if (response.data?.connect_webview) {
    await handleConnectWebviewResponse(response.data.connect_webview)
  }

  if (response.data?.action_attempt && is_interactive) {
    await interactForActionAttemptPoll(response.data.action_attempt)
  }
}

/**
 * Request params piped or redirected into the CLI, e.g.,
 * `seam devices list --json < params.json`.
 *
 * Params given as flags take precedence over params read here.
 */
const readParamsFromStdin = async (
  args: ParsedArgs,
): Promise<Record<string, unknown>> => {
  const json = getJsonFlag(args)
  if (typeof json === 'string') {
    return parseJsonParams(json, '--json') ?? {}
  }

  return (await readStdinJson()) ?? {}
}

/**
 * The `--json` flag: true, false for `--no-json`, or params given inline
 * as `--json '{"limit": 2}'`.
 */
const getJsonFlag = (args: ParsedArgs): boolean | string | undefined => {
  const json: unknown = args['json']
  if (json === 'true') return true
  if (json === 'false') return false
  if (typeof json === 'boolean' || typeof json === 'string') return json
  return undefined
}

const handleConnectWebviewResponse = async (connect_webview: any) => {
  const url = connect_webview.url

  if (process.env['INSIDE_WEB_BROWSER'] !== '1' && canPrompt()) {
    const { action } = await prompt({
      type: 'confirm',
      name: 'action',
      message: 'Would you like to open the webview in your browser?',
    })

    if (action) {
      const { default: open } = await import('open')
      await open(url)
    }
  }
}

/**
 * Whether to write machine readable output.
 *
 * Explicit `--json` or `--no-json` wins, otherwise the CLI writes JSON
 * whenever stdout is piped or redirected, and pretty output at a terminal.
 */
const resolveOutputFormat = (args: ParsedArgs): OutputFormat => {
  const json = getJsonFlag(args)
  if (json === false) return 'text'
  if (json !== undefined) return 'json'
  return process.stdout.isTTY === true ? 'text' : 'json'
}

const args = parseArgs(process.argv.slice(2), { string: ['code'] })

setOutput(
  createOutput({
    format: resolveOutputFormat(args),
    colors: process.stdout.isTTY === true,
  }),
)

cli(args).catch((e: unknown) => {
  const output = getOutput()
  const error = e instanceof Error ? e : new Error(String(e))
  output.error(chalk.red(`CLI Error: ${error.message}`))
  if (error.stack != null) output.error(chalk.gray(error.stack))
  process.exitCode = 1
})
