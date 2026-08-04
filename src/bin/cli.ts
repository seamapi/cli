#!/usr/bin/env node
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import type { ParsedArgs } from 'minimist'

import {
  cliFlags,
  getInteractivity,
  type Interactivity,
  NonInteractiveError,
  parseCliArgs,
  toGivenArgName,
  toParameterName,
  UsageError,
} from 'lib/args/parse.js'
import {
  assertMutable,
  login,
  logout,
  selectFakeServer,
  selectServer,
} from 'lib/auth/operations.js'
import {
  getCommandBlueprintDef,
  getResponseKey,
} from 'lib/blueprint/endpoint.js'
import { getApiBlueprint } from 'lib/blueprint/index.js'
import { findLocalCommand, getCommandSpec } from 'lib/command-spec.js'
import { getConfigStore } from 'lib/config/index.js'
import { type CliContext, resolveAuth } from 'lib/context.js'
import {
  EnvVarOverrideError,
  isInsideWebBrowser,
  tokenEnvVar,
} from 'lib/env.js'
import { interactForActionAttemptPoll } from 'lib/interact/interact-for-action-attempt-poll.js'
import { interactForCommandParams } from 'lib/interact/interact-for-command-params.js'
import { interactForCommandSelection } from 'lib/interact/interact-for-command-selection.js'
import { interactForLogin } from 'lib/interact/interact-for-login.js'
import { interactForServerSelection } from 'lib/interact/interact-for-server-selection.js'
import { interactForUseRemoteApiDefs } from 'lib/interact/interact-for-use-remote-api-defs.js'
import { interactForWorkspaceId } from 'lib/interact/interact-for-workspace-id.js'
import {
  canPrompt,
  PromptCancelledError,
  promptConfirm,
} from 'lib/interact/prompt.js'
import { createOutput } from 'lib/output/create-output.js'
import { getOutput, setOutput } from 'lib/output/get-output.js'
import { readStdinJson } from 'lib/output/read-stdin-json.js'
import { resolveOutputFormat } from 'lib/output/resolve-output-format.js'
import {
  completionShells,
  isCompletionShell,
  renderCompletion,
} from 'lib/render/completion/index.js'
import { renderHelp } from 'lib/render/help.js'
import { RequestSeamApi } from 'lib/seam/request.js'
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

  args._ = args._.map(toCommandWord)

  // Argument keys name parameters however they are written, so normalize each
  // one to the name the API gives it. Replace the key rather than adding the
  // normalized form alongside it, or an argument would be sent twice: once as
  // written and once as the API names it.
  for (const key of Object.keys(args)) {
    if (key === '_') continue
    const name = toParameterName(key)
    if (name === key) continue
    args[name] = args[key]
    delete args[key]
  }

  // Params given as arguments, kept apart from the params read from stdin so
  // that only the arguments are held to what the command accepts.
  const argParams: Record<string, any> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key === '_') continue
    if (cliFlags.includes(key)) continue
    argParams[key] = value
  }

  if (args._[0] === 'completion') {
    const shell = args._[1]

    if (!isCompletionShell(shell)) {
      output.error(`Usage: seam completion <${completionShells.join('|')}>`)
      process.exitCode = 1
      return
    }

    assertKnownArgs(argParams, ['completion', shell])

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
    const { server: fakeApiUrl } = selectFakeServer(undefined, config)
    output.info(`Server URL set to ${fakeApiUrl}`)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
    return
  }

  if (
    resolveAuth(config).token == null &&
    args._[0] !== 'login' &&
    !isEqual(args._, ['select', 'server'])
  ) {
    output.error(`Not logged in. Please run "seam login" or set ${tokenEnvVar}`)
    process.exitCode = 1
    return
  }

  const useRemoteApiDefs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  const blueprint = await getApiBlueprint(useRemoteApiDefs ?? false, {
    update,
  })

  // Params piped or redirected in, e.g., `seam devices list < params.json`.
  // Params given as arguments take precedence over these.
  const commandParams: Record<string, any> = { ...(await readStdinJson()) }

  const ctx: CliContext = {
    config,
    auth: resolveAuth(config),
    blueprint,
    interactivity: getInteractivity(args, { canPrompt: canPrompt() }),
  }

  const isNonInteractive = ctx.interactivity === 'non-interactive'

  Object.assign(commandParams, argParams)

  const selectedCommand = await interactForCommandSelection(args._, ctx)

  // Hit 'back' on a top-level command path, so we start again
  if (selectedCommand.slice(-1)[0] === '[Back]') {
    return await cli({
      ...args,
      _: [],
    })
  }

  // Check the arguments before the command acts on any of them, so a mistake
  // is reported rather than half applied.
  assertKnownArgs(argParams, selectedCommand, ctx)

  if (isEqual(selectedCommand, ['login'])) {
    if (args['token'] || args['workspace_id'] || args['server']) {
      await login(
        {
          server: args['server'] ? args['server'] : undefined,
          token: args['token'] ? String(args['token']).trim() : undefined,
          workspaceId: args['workspace_id'] ? args['workspace_id'] : undefined,
        },
        config,
      )
      return
    }
    assertMutable(ctx.auth, 'token', 'log in')
    if (isNonInteractive) {
      throw new NonInteractiveError(
        'Missing required parameter for login: --token',
      )
    }
    await interactForLogin()
    return
  } else if (isEqual(selectedCommand, ['logout'])) {
    logout(config)
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
    assertMutable(ctx.auth, 'workspaceId', 'select a workspace')
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
    assertMutable(ctx.auth, 'server', 'select a server')
    if (args['server']) {
      selectServer(args['server'], config)
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

  const apiPath = `/${selectedCommand.join('/').replace(/-/g, '_')}`

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

/**
 * Report any argument the command does not accept, rather than acting on it.
 * An unrecognized argument is a mistake: forwarded to the API it would fail
 * somewhere less obvious or be quietly ignored, and on a command the CLI
 * handles itself it would go nowhere at all.
 *
 * Only arguments are checked. Params read from stdin are passed through as
 * given, so a caller may send whatever the API itself accepts.
 *
 * `ctx` is only needed to look up an endpoint's parameters, so commands the
 * CLI declares itself can be checked before any blueprint is loaded.
 */
const assertKnownArgs = (
  argParams: Record<string, any>,
  command: string[],
  ctx?: CliContext,
): void => {
  const local = findLocalCommand(command)

  let accepted: Set<string>
  if (local != null) {
    accepted = new Set(
      local.flags.flatMap(({ long }) =>
        long == null ? [] : [toParameterName(long)],
      ),
    )
  } else if (ctx != null) {
    accepted = new Set(
      getCommandBlueprintDef(command, ctx).request.parameters.map(
        ({ name }) => name,
      ),
    )
  } else {
    throw new Error(`No definition for command seam ${command.join(' ')}`)
  }

  const unknown = Object.keys(argParams).filter((key) => !accepted.has(key))
  if (unknown.length === 0) return

  // Name an endpoint command by its path, as missing params are named, and a
  // command the CLI handles itself by the words that run it.
  const target =
    local == null
      ? `/${command.join('/').replace(/-/g, '_')}`
      : command.join(' ')

  throw new UsageError(
    `Unknown ${
      unknown.length === 1 ? 'parameter' : 'parameters'
    } for ${target}: ${unknown.map(toGivenArgName).join(' ')}`,
    {
      hint: `Run 'seam ${command.join(' ')} --help' to see what it accepts.`,
    },
  )
}

const handleConnectWebviewResponse = async (
  connectWebview: any,
  interactivity: Interactivity,
) => {
  const url = connectWebview.url

  if (interactivity !== 'non-interactive' && !isInsideWebBrowser()) {
    const action = await promptConfirm({
      message: 'Would you like to open the webview in your browser?',
      initialValue: false,
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

  if (e instanceof UsageError) {
    output.error(chalk.red(e.message))
    if (e.hint !== '') output.error(e.hint)
    return
  }

  if (e instanceof NonInteractiveError || e instanceof EnvVarOverrideError) {
    output.error(chalk.red(e.message))
    return
  }

  if (e instanceof PromptCancelledError) {
    output.error(chalk.gray(e.message))
    return
  }

  const error = e instanceof Error ? e : new Error(String(e))
  output.error(chalk.red(`CLI Error: ${error.message}`))
  if (error.stack != null) output.error(chalk.gray(error.stack))
})
