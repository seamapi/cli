#!/usr/bin/env node
import { isDeepStrictEqual as isEqual } from 'node:util'

import chalk from 'chalk'
import type { ParsedArgs } from 'minimist'

import {
  cliFlags,
  getInteractivity,
  parseCliArgs,
  toAuthOverrides,
  toParameterName,
} from 'lib/args/parse.js'
import { assertKnownArgs, assertNoAuthOverrides } from 'lib/args/validate.js'
import { getApiBlueprint } from 'lib/blueprint/index.js'
import {
  printCompletion,
  printCompletionLoader,
} from 'lib/commands/local/completion.js'
import { runWizard } from 'lib/commands/local/wizard.js'
import {
  acceptedParamsOf,
  buildRegistry,
  findLocalCommand,
  findLocalCommandTakingPositional,
} from 'lib/commands/registry.js'
import { getConfig } from 'lib/config/index.js'
import { type CliContext, resolveAuth } from 'lib/context.js'
import { tokenEnvVar } from 'lib/env.js'
import { reportErrorAndExit } from 'lib/errors.js'
import { createSeamApi, type SeamApi } from 'lib/http/api.js'
import { interactForCommandSelection } from 'lib/interactions/index.js'
import { getOutput, setOutput } from 'lib/output/get-output.js'
import { createOutput } from 'lib/output/output.js'
import { parseJsonParams, readStdinJson } from 'lib/output/read-stdin-json.js'
import { resolveOutputFormat } from 'lib/output/resolve-output-format.js'
import { setAuthOverrides } from 'lib/overrides.js'
import { canPrompt } from 'lib/prompt.js'
import {
  completionShells,
  isCompletionShell,
} from 'lib/render/completion/index.js'
import { renderHelp } from 'lib/render/help.js'
import seamapiCliVersion from 'lib/version.js'

async function cli(args: ParsedArgs, argv: string[]) {
  const config = getConfig()
  const output = getOutput()

  // Scoped to this one command, and read wherever auth resolves, so they are
  // in place before anything asks what the endpoint or the workspace is.
  const authOverrides = toAuthOverrides(args)
  setAuthOverrides(authOverrides)

  // A command may take one value after its path, e.g., the URL in 'seam
  // select endpoint <url>'. Split it off before the path is normalized, or
  // lowercasing the path would rewrite the value along with it.
  const commandWords = args._.map(toCommandWord)
  const commandTakingPositional = findLocalCommandTakingPositional(commandWords)
  const positional =
    commandTakingPositional == null ? undefined : String(args._.at(-1))
  args._ =
    commandTakingPositional == null ? commandWords : commandWords.slice(0, -1)

  const update = args['update'] === true

  const helpFlag = args['help'] ?? args['h']
  if (helpFlag != null) {
    // Help comes from the cached API schema so that it works without
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

    if (args['loader'] === true) {
      printCompletionLoader(shell)
      return
    }

    const cachedBlueprint = await getApiBlueprint({ update })
    printCompletion(shell, buildRegistry(cachedBlueprint).spec)
    return
  }

  const localCommand = findLocalCommand(args._)

  // Before the login gate, so a command that selects reports the flag it
  // cannot take rather than whatever the flag pointed it at.
  if (localCommand != null) {
    assertNoAuthOverrides(localCommand.definition, authOverrides)
  }

  // Commands declared not to need a token bypass the login gate. A partial
  // path keeps the historical rule: only login and select endpoint may be
  // reached logged out.
  const requiresAuth =
    localCommand != null
      ? localCommand.requiresAuth
      : !(args._[0] === 'login' || isEqual(args._, ['select', 'endpoint']))

  if (requiresAuth && resolveAuth(config).token == null) {
    output.error(`Not logged in. Please run "seam login" or set ${tokenEnvVar}`)
    process.exitCode = 1
    return
  }

  const useRemoteSchema = args['remote_schema'] ?? config.getUseRemoteSchema()

  const blueprint = await getApiBlueprint({
    useRemoteSchema: useRemoteSchema ?? false,
    update,
  })

  const registry = buildRegistry(blueprint)

  // Params piped or redirected in, e.g., `seam devices list < params.json`.
  const pipedParams = await readStdinJson()
  const rawParams =
    args['raw'] == null ? null : parseJsonParams(String(args['raw']), '--raw')
  // Inline raw params take precedence over piped params, while ordinary
  // command arguments still take precedence over both.
  const stdinParams: Record<string, any> = {
    ...pipedParams,
    ...rawParams,
  }

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
    assertNoAuthOverrides(command.definition, authOverrides)
    assertKnownArgs(argParams, selectedCommand, {
      accepted: acceptedParamsOf(command.definition),
      isLocal: findLocalCommand(selectedCommand) != null,
    })

    const result = await command.execute(
      { path: selectedCommand, positional, argParams, stdinParams, args, argv },
      ctx,
    )

    if (result.kind === 'back') {
      commandPath = result.toPath
      continue
    }

    return
  }
}

// minimist reads a numeric word as a number, so a command path is only a
// path once every word is one.
const toCommandWord = (arg: string | number): string =>
  String(arg).toLowerCase().replace(/_/g, '-')

const run = async (argv: string[]) => {
  if (argv[0] === 'wizard') {
    await runWizard(argv.slice(1))
    return
  }

  const args = parseCliArgs(argv, {
    booleanKeys: argv[0]?.toLowerCase() === 'completion' ? ['loader'] : [],
  })

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
