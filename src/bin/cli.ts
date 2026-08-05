#!/usr/bin/env node
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import type { ParsedArgs } from 'minimist'

import {
  cliFlags,
  getInteractivity,
  parseCliArgs,
  toParameterName,
} from 'lib/args/parse.js'
import { assertKnownArgs } from 'lib/args/validate.js'
import { getApiBlueprint } from 'lib/blueprint/index.js'
import { printCompletion } from 'lib/commands/local/completion.js'
import { runWizard } from 'lib/commands/local/wizard.js'
import {
  acceptedParamsOf,
  buildRegistry,
  findLocalCommand,
} from 'lib/commands/registry.js'
import { getConfigStore } from 'lib/config/index.js'
import { type CliContext, resolveAuth } from 'lib/context.js'
import { tokenEnvVar } from 'lib/env.js'
import { reportErrorAndExit } from 'lib/errors.js'
import { createSeamApi, type SeamApi } from 'lib/http/api.js'
import { interactForCommandSelection } from 'lib/interact/interact-for-command-selection.js'
import { canPrompt } from 'lib/interact/prompt.js'
import { createOutput } from 'lib/output/create-output.js'
import { getOutput, setOutput } from 'lib/output/get-output.js'
import { readStdinJson } from 'lib/output/read-stdin-json.js'
import { resolveOutputFormat } from 'lib/output/resolve-output-format.js'
import {
  completionShells,
  isCompletionShell,
} from 'lib/render/completion/index.js'
import { renderHelp } from 'lib/render/help.js'
import seamapiCliVersion from 'lib/version.js'

async function cli(args: ParsedArgs, argv: string[]) {
  const config = getConfigStore()
  const output = getOutput()

  const update = args['update'] === true

  const helpFlag = args['help'] ?? args['h']
  if (helpFlag != null) {
    // Help comes from the cached API definitions so that it works without
    // logging in, and offline once the cache is warm.
    const cachedBlueprint = await getApiBlueprint({ update })
    const { spec } = buildRegistry(cachedBlueprint)

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

    const command = findLocalCommand(['completion', shell])
    assertKnownArgs(argParams, ['completion', shell], {
      accepted:
        command == null ? new Set() : acceptedParamsOf(command.definition),
      isLocal: true,
    })

    await printCompletion(shell, { update })
    return
  }

  const localCommand = findLocalCommand(args._)

  // Commands declared not to need a token bypass the login gate. A partial
  // path keeps the historical rule: only login and select server may be
  // reached logged out.
  const requiresAuth =
    localCommand != null
      ? localCommand.requiresAuth
      : !(args._[0] === 'login' || isEqual(args._, ['select', 'server']))

  if (requiresAuth && resolveAuth(config).token == null) {
    output.error(`Not logged in. Please run "seam login" or set ${tokenEnvVar}`)
    process.exitCode = 1
    return
  }

  const useRemoteApiDefs =
    args['remote_api_defs'] ?? config.get('use_remote_api_defs')

  const blueprint = await getApiBlueprint({
    useRemoteDefinitions: useRemoteApiDefs ?? false,
    update,
  })

  const registry = buildRegistry(blueprint)

  // Params piped or redirected in, e.g., `seam devices list < params.json`.
  const pipedParams = await readStdinJson()
  const stdinParams: Record<string, any> = { ...pipedParams }

  const auth = resolveAuth(config)
  let seamApi: Promise<SeamApi> | null = null

  const ctx: CliContext = {
    config,
    auth,
    output,
    blueprint,
    interactivity: getInteractivity(args, { canPrompt: canPrompt() }),
    api: async () => await (seamApi ??= createSeamApi(auth)),
  }

  const selectableCommands = registry.spec.commands.map(({ path }) => path)

  let commandPath = args._
  while (true) {
    const selectedCommand = await interactForCommandSelection(commandPath, {
      commands: selectableCommands,
      interactivity: ctx.interactivity,
    })

    // Hit 'back' on a top-level command path, so we start again
    if (selectedCommand.at(-1) === '[Back]') {
      commandPath = []
      continue
    }

    const command = registry.find(selectedCommand)
    if (command == null) {
      throw new Error(
        `No definition for command seam ${selectedCommand.join(' ')}`,
      )
    }

    // Check the arguments before the command acts on any of them, so a
    // mistake is reported rather than half applied.
    assertKnownArgs(argParams, selectedCommand, {
      accepted: acceptedParamsOf(command.definition),
      isLocal: findLocalCommand(selectedCommand) != null,
    })

    const result = await command.execute(
      { path: selectedCommand, argParams, stdinParams, args, argv },
      ctx,
    )

    if (result.kind === 'back') {
      commandPath = result.toPath
      continue
    }

    return
  }
}

const toCommandWord = (arg: string): string =>
  arg.toLowerCase().replace(/_/g, '-')

const run = async (argv: string[]) => {
  if (argv[0] === 'wizard') {
    await runWizard(argv.slice(1))
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

  await cli(args, argv)
}

run(process.argv.slice(2)).catch((e: unknown) => {
  reportErrorAndExit(e, getOutput())
})
