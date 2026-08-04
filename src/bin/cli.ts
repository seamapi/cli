#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import parseArgs, { type ParsedArgs } from 'minimist'
import prompts from 'prompts'

import { getCommandSpec } from 'lib/command-spec.js'
import {
  completionShells,
  isCompletionShell,
  renderCompletion,
} from 'lib/completion/index.js'
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
import { renderHelp } from 'lib/render-help.js'
import type { ContextHelpers } from 'lib/types.js'
import { RequestSeamApi } from 'lib/util/request-seam-api.js'
import { validateToken } from 'lib/validate-token.js'
import seamapiCliVersion from 'lib/version.js'

async function cli(args: ParsedArgs) {
  const config = getConfigStore()

  const update = args['update'] === true

  const helpFlag = args['help'] ?? args['h']
  if (helpFlag != null) {
    // Help comes from the cached API definitions so that it works without
    // logging in, and offline once the cache is warm.
    const spec = getCommandSpec(await getApiBlueprint(false, { update }))

    // minimist reads the word after --help as its value, so 'seam --help
    // devices' asks about devices just as 'seam devices --help' does.
    const commandPath = [
      ...args._,
      ...(typeof helpFlag === 'string' ? [helpFlag] : []),
    ].map(toCommandWord)

    const help = renderHelp(commandPath, spec)

    if (help == null) {
      console.log(chalk.red(`Unknown command: seam ${commandPath.join(' ')}`))
      console.log(`Run 'seam --help' to see the available commands.`)
      process.exit(1)
    }

    console.log(help)
    return
  }

  if (args['version']) {
    console.log(seamapiCliVersion)
    process.exit(0)
  }

  if (args._[0] === 'completion') {
    const shell = args._[1]

    if (!isCompletionShell(shell)) {
      console.log(`Usage: seam completion <${completionShells.join('|')}>`)
      process.exit(1)
    }

    // Completions always come from the cached API definitions so that they
    // can be generated without logging in. They may lag the definitions
    // served by Seam when config use-remote-api-defs is enabled.
    console.log(
      renderCompletion(shell, await getApiBlueprint(false, { update })),
    )
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

  args._ = args._.map(toCommandWord)
  for (const k in args) {
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }

  const use_remote_api_defs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  delete args['update']

  const blueprint = await getApiBlueprint(use_remote_api_defs ?? false, {
    update,
  })

  const commandParams: Record<string, any> = {}

  /**
   * Whether or not to auto-select first option
   */
  const is_interactive = args['y'] !== true

  const ctx: ContextHelpers = {
    blueprint,
    is_interactive,
  }

  for (const k in args) {
    if (k === '_') continue
    const v = args[k]
    delete args[k]
    args[k.replace(/-/g, '_')] = v
    commandParams[k.replace(/-/g, '_')] = v
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
    console.log('Logged out!')
    return
  } else if (isEqual(selectedCommand, ['config', 'reveal-location'])) {
    console.log(config.path)
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
  })

  if (response.data?.connect_webview) {
    await handleConnectWebviewResponse(response.data.connect_webview)
  }

  if (response.data?.action_attempt) {
    interactForActionAttemptPoll(response.data.action_attempt)
  }
}

const toCommandWord = (arg: string): string =>
  arg.toLowerCase().replace(/_/g, '-')

const handleConnectWebviewResponse = async (connect_webview: any) => {
  const url = connect_webview.url

  if (process.env['INSIDE_WEB_BROWSER'] !== '1') {
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

  await cli(parseArgs(argv, { string: ['code'] }))
}

run(process.argv.slice(2)).catch((e) => {
  console.log(chalk.red(`CLI Error: ${e.toString()}\n${e.stack}`))
  if (e.toString().includes('object Object')) {
    console.log(e)
  }
})
