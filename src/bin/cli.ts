#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import commandLineUsage from 'command-line-usage'
import type { ParsedArgs } from 'minimist'
import prompts from 'prompts'

import { getConfigStore } from 'lib/config/index.js'
import { getApiBlueprint } from 'lib/get-api-blueprint.js'
import { getServer } from 'lib/get-server.js'
import { interactForActionAttemptPoll } from 'lib/interact-for-action-attempt-poll.js'
import { interactForCommandParams } from 'lib/interact-for-command-params.js'
import { interactForCommandSelection } from 'lib/interact-for-command-selection.js'
import { interactForLogin } from 'lib/interact-for-login.js'
import { interactForServerSelection } from 'lib/interact-for-server-selection.js'
import { interactForUseRemoteApiDefs } from 'lib/interact-for-use-remote-api-defs.js'
import { interactForWorkspaceId } from 'lib/interact-for-workspace-id.js'
import type { ContextHelpers } from 'lib/types.js'
import {
  getInteractivity,
  type Interactivity,
  interactivityFlags,
  NonInteractiveError,
  parseCliArgs,
} from 'lib/util/cli-args.js'
import { RequestSeamApi } from 'lib/util/request-seam-api.js'
import { validateToken } from 'lib/validate-token.js'
import seamapiCliVersion from 'lib/version.js'

const sections = [
  {
    header: 'Seam CLI',
    content:
      'Every seam command runs as soon as every required property is given, and otherwise prompts you for what is missing with helpful suggestions. Pass -i to always review properties first, or -y to never be prompted. ',
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
        name: 'interactive',
        description:
          'Always prompt to review and edit properties, prefilled with the given arguments.',
        alias: 'i',
        type: Boolean,
      },
      {
        name: 'non-interactive',
        description:
          'Never prompt: exit with an error if the command or any required property is missing.',
        alias: 'y',
        type: Boolean,
      },
      {
        name: 'update',
        description: 'Force an update of the cached Seam API definitions.',
        type: Boolean,
      },
    ],
  },
  {
    header: 'Command List Examples',
    content: [
      { name: 'seam', summary: 'Interactively select commands to execute.' },
      { name: 'seam login', summary: 'Login to Seam.' },
      {
        name: 'seam wizard',
        summary: 'Set up Seam in the current project.',
      },
      { name: 'seam select workspace', summary: 'Select your workspace.' },
      {
        name: 'seam connect-webviews create',
        summary: 'Create a connect webview to connect devices.',
      },
      { name: 'seam devices list', summary: 'List devices in your workspace.' },
      {
        name: 'seam devices list {bold --interactive}',
        summary: 'Review and edit filters before listing devices.',
      },
      {
        name: 'seam devices list {bold --non-interactive}',
        summary: 'List devices, failing instead of prompting.',
      },
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
    ],
  },
]

async function cli(args: ParsedArgs) {
  const config = getConfigStore()

  if (args['help'] || args['h']) {
    const usage = commandLineUsage(sections)
    console.log(usage)
    return
  }

  if (args['version']) {
    console.log(seamapiCliVersion)
    process.exit(0)
  }

  if (
    args._[0] === 'config' &&
    args._[1] === 'set' &&
    args._[2] === 'fake-server'
  ) {
    const randomstring = randomBytes(5).toString('hex')
    const fakeApiUrl = `https://${randomstring}.fakeseamconnect.seam.vc`

    config.set('server', fakeApiUrl)
    console.log(`Server URL set to ${fakeApiUrl}`)

    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    console.log(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return
  }

  if (
    !config.get(`${getServer()}.pat`) &&
    args._[0] !== 'login' &&
    !isEqual(args._, ['select', 'server'])
  ) {
    console.log(`Not logged in. Please run "seam login"`)
    process.exit(1)
  }

  args._ = args._.map((arg) => arg.toLowerCase().replace(/_/g, '-'))
  for (const k in args) {
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }

  const use_remote_api_defs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  const update = args['update'] === true
  delete args['update']

  const blueprint = await getApiBlueprint(use_remote_api_defs ?? false, {
    update,
  })

  const commandParams: Record<string, any> = {}

  const ctx: ContextHelpers = {
    blueprint,
    interactivity: getInteractivity(args),
  }

  const isNonInteractive = ctx.interactivity === 'non-interactive'

  for (const k in args) {
    if (k === '_') continue
    const v = args[k]
    delete args[k]
    const key = k.replace(/-/g, '_')
    args[key] = v
    if (interactivityFlags.includes(key)) continue
    commandParams[key] = v
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
    if (isNonInteractive) {
      throw new NonInteractiveError(
        'Missing required parameter for login: --token',
      )
    }
    await interactForLogin()
    return
  } else if (isEqual(selectedCommand, ['logout'])) {
    config.delete('pat')
    console.log('Logged out!')
    return
  } else if (isEqual(selectedCommand, ['config', 'reveal-location'])) {
    console.log(config.path)
    return
  } else if (isEqual(selectedCommand, ['config', 'use-remote-api-defs'])) {
    if (isNonInteractive) {
      throw new NonInteractiveError(
        'Cannot select whether to use remote API definitions in non-interactive mode',
      )
    }
    await interactForUseRemoteApiDefs()
    return
  } else if (isEqual(selectedCommand, ['select', 'workspace'])) {
    if (isNonInteractive) {
      throw new NonInteractiveError(
        'Cannot select a workspace in non-interactive mode: pass --workspace-id to "seam login"',
      )
    }
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
    if (isNonInteractive) {
      throw new NonInteractiveError(
        'Missing required parameter for select server: --server',
      )
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
  })

  if (response.data?.connect_webview) {
    await handleConnectWebviewResponse(
      response.data.connect_webview,
      ctx.interactivity,
    )
  }

  if (response.data?.action_attempt && !isNonInteractive) {
    interactForActionAttemptPoll(response.data.action_attempt)
  }
}

const handleConnectWebviewResponse = async (
  connect_webview: any,
  interactivity: Interactivity,
) => {
  const url = connect_webview.url

  if (
    interactivity !== 'non-interactive' &&
    process.env['INSIDE_WEB_BROWSER'] !== '1'
  ) {
    const { action } = await prompts({
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

const run = async (argv: string[]) => {
  if (argv[0] === 'wizard') {
    const { default: wizard } = await import('@seamapi/wizard')
    await wizard({
      argv: argv.slice(1),
      commandName: 'seam wizard',
    })
    return
  }

  await cli(parseCliArgs(argv))
}

run(process.argv.slice(2)).catch((e) => {
  if (e instanceof NonInteractiveError) {
    console.log(chalk.red(e.message))
    process.exit(1)
  }

  console.log(chalk.red(`CLI Error: ${e.toString()}\n${e.stack}`))
  if (e.toString().includes('object Object')) {
    console.log(e)
  }
})
