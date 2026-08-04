#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import type { ParsedArgs } from 'minimist'

import { getCommandSpec } from 'lib/command-spec.js'
import {
  completionShells,
  isCompletionShell,
  renderCompletion,
} from 'lib/completion/index.js'
import { getConfigStore } from 'lib/config/index.js'
import {
  assertEnvVarUnset,
  endpointEnvVar,
  EnvVarOverrideError,
  getEndpointFromEnv,
  getTokenFromEnv,
  getWorkspaceIdFromEnv,
  tokenEnvVar,
  workspaceIdEnvVar,
} from 'lib/env.js'
import { getApiBlueprint } from 'lib/get-api-blueprint.js'
import { getToken } from 'lib/get-credentials.js'
import { getResponseKey } from 'lib/get-response-key.js'
import { getServer } from 'lib/get-server.js'
import { interactForActionAttemptPoll } from 'lib/interact-for-action-attempt-poll.js'
import { interactForCommandParams } from 'lib/interact-for-command-params.js'
import { interactForCommandSelection } from 'lib/interact-for-command-selection.js'
import { interactForLogin } from 'lib/interact-for-login.js'
import { interactForServerSelection } from 'lib/interact-for-server-selection.js'
import { interactForUseRemoteApiDefs } from 'lib/interact-for-use-remote-api-defs.js'
import { interactForWorkspaceId } from 'lib/interact-for-workspace-id.js'
import { createOutput } from 'lib/output/create-output.js'
import { getOutput, setOutput } from 'lib/output/get-output.js'
import { resolveOutputFormat } from 'lib/output/resolve-output-format.js'
import { renderHelp } from 'lib/render-help.js'
import type { ContextHelpers } from 'lib/types.js'
import {
  cliFlags,
  getInteractivity,
  type Interactivity,
  NonInteractiveError,
  parseCliArgs,
} from 'lib/util/cli-args.js'
import { canPrompt, prompt } from 'lib/util/prompt.js'
import { readStdinJson } from 'lib/util/read-stdin-json.js'
import { RequestSeamApi } from 'lib/util/request-seam-api.js'
import { validateToken } from 'lib/validate-token.js'
import seamapiCliVersion from 'lib/version.js'

async function cli(args: ParsedArgs) {
  const config = getConfigStore()
  const output = getOutput()

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
      output.error(chalk.red(`Unknown command: seam ${commandPath.join(' ')}`))
      output.error(`Run 'seam --help' to see the available commands.`)
      process.exitCode = 1
      return
    }

    output.text(help)
    return
  }

  if (args['version']) {
    output.text(seamapiCliVersion)
    return
  }

  if (args._[0] === 'completion') {
    const shell = args._[1]

    if (!isCompletionShell(shell)) {
      output.error(`Usage: seam completion <${completionShells.join('|')}>`)
      process.exitCode = 1
      return
    }

    // Completions always come from the cached API definitions so that they
    // can be generated without logging in. They may lag the definitions
    // served by Seam when config use-remote-api-defs is enabled.
    output.text(
      renderCompletion(shell, await getApiBlueprint(false, { update })),
    )
    return
  }

  if (
    args._[0] === 'config' &&
    args._[1] === 'set' &&
    args._[2] === 'fake-server'
  ) {
    assertEnvVarUnset(endpointEnvVar, getEndpointFromEnv(), 'select a server')
    assertEnvVarUnset(tokenEnvVar, getTokenFromEnv(), 'log in')

    const randomstring = randomBytes(5).toString('hex')
    const fakeApiUrl = `https://${randomstring}.fakeseamconnect.seam.vc`

    config.set('server', fakeApiUrl)
    output.info(`Server URL set to ${fakeApiUrl}`)

    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return
  }

  if (
    getToken() == null &&
    args._[0] !== 'login' &&
    !isEqual(args._, ['select', 'server'])
  ) {
    output.error(`Not logged in. Please run "seam login" or set ${tokenEnvVar}`)
    process.exitCode = 1
    return
  }

  args._ = args._.map(toCommandWord)
  for (const k in args) {
    args[k.toLowerCase().replace(/-/g, '_')] = args[k]
  }

  const useRemoteApiDefs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  const blueprint = await getApiBlueprint(useRemoteApiDefs ?? false, {
    update,
  })

  // Params piped or redirected in, e.g., `seam devices list < params.json`.
  // Params given as arguments take precedence over these.
  const commandParams: Record<string, any> = { ...(await readStdinJson()) }

  const ctx: ContextHelpers = {
    blueprint,
    interactivity: getInteractivity(args, { canPrompt: canPrompt() }),
  }

  const isNonInteractive = ctx.interactivity === 'non-interactive'

  for (const k in args) {
    if (k === '_') continue
    const v = args[k]
    delete args[k]
    const key = k.replace(/-/g, '_')
    args[key] = v
    if (cliFlags.includes(key)) continue
    commandParams[key] = v
  }

  const selectedCommand = await interactForCommandSelection(args._, ctx)
  if (isEqual(selectedCommand, ['login'])) {
    // Nothing is stored while the environment overrides it, so refuse before
    // storing anything rather than part way through.
    assertEnvVarUnset(tokenEnvVar, getTokenFromEnv(), 'log in')
    if (args['server']) {
      assertEnvVarUnset(endpointEnvVar, getEndpointFromEnv(), 'select a server')
    }
    if (args['workspace_id']) {
      assertEnvVarUnset(
        workspaceIdEnvVar,
        getWorkspaceIdFromEnv(),
        'select a workspace',
      )
    }
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
    assertEnvVarUnset(tokenEnvVar, getTokenFromEnv(), 'log out')
    config.delete('pat')
    output.info('Logged out!')
    return
  } else if (isEqual(selectedCommand, ['config', 'reveal-location'])) {
    output.text(config.path)
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
    assertEnvVarUnset(
      workspaceIdEnvVar,
      getWorkspaceIdFromEnv(),
      'select a workspace',
    )
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
    assertEnvVarUnset(endpointEnvVar, getEndpointFromEnv(), 'select a server')
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
    responseKey: getResponseKey(selectedCommand, ctx),
  })

  if (response.data?.connect_webview) {
    await handleConnectWebviewResponse(
      response.data.connect_webview,
      ctx.interactivity,
    )
  }

  if (response.data?.action_attempt && !isNonInteractive) {
    await interactForActionAttemptPoll(response.data.action_attempt)
  }
}

const toCommandWord = (arg: string): string =>
  arg.toLowerCase().replace(/_/g, '-')

const handleConnectWebviewResponse = async (
  connectWebview: any,
  interactivity: Interactivity,
) => {
  const url = connectWebview.url

  if (
    interactivity !== 'non-interactive' &&
    process.env['INSIDE_WEB_BROWSER'] !== '1'
  ) {
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

const run = async (argv: string[]) => {
  if (argv[0] === 'wizard') {
    const { default: wizard } = await import('@seamapi/wizard')
    await wizard({
      argv: argv.slice(1),
      commandName: 'seam wizard',
    })
    return
  }

  const args = parseCliArgs(argv)

  const isTty = process.stdout.isTTY === true

  setOutput(
    createOutput({
      format: resolveOutputFormat(argv, { isTty }),
      colors: isTty,
    }),
  )

  await cli(args)
}

run(process.argv.slice(2)).catch((e: unknown) => {
  const output = getOutput()
  process.exitCode = 1

  if (e instanceof NonInteractiveError || e instanceof EnvVarOverrideError) {
    output.error(chalk.red(e.message))
    return
  }

  const error = e instanceof Error ? e : new Error(String(e))
  output.error(chalk.red(`CLI Error: ${error.message}`))
  if (error.stack != null) output.error(chalk.gray(error.stack))
})
