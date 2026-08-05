import { isDeepStrictEqual as isEqual } from 'node:util'

import { coerceArgParams } from '../args/coerce.js'
import {
  type Interactivity,
  parseCliArgs,
  toArgName,
  toArgParams,
  UsageError,
} from '../args/parse.js'
import { assertRequiredParams } from '../args/validate.js'
import {
  getCommandBlueprintDef,
  getResponseKey,
} from '../blueprint/endpoint.js'
import type { CliContext } from '../context.js'
import { isInsideWebBrowser } from '../env.js'
import { RequestSeamApi } from '../http/request.js'
import { interactForActionAttemptPoll } from '../interact/interact-for-action-attempt-poll.js'
import { interactForCommandParams } from '../interact/interact-for-command-params.js'
import { promptConfirm } from '../interact/prompt.js'
import type { CommandResult, Invocation } from './registry.js'

/**
 * Run a command that calls a Seam API endpoint: assemble the params,
 * prompt for what is missing, make the request, and run any follow-ups
 * the response calls for.
 */
export const executeApiCommand = async (
  invocation: Invocation,
  ctx: CliContext,
): Promise<CommandResult> => {
  const { path } = invocation
  const isNonInteractive = ctx.interactivity === 'non-interactive'
  const apiPath = `/${path.join('/').replace(/-/g, '_')}`

  const parameters = getCommandBlueprintDef(path, ctx).request.parameters

  // Re-read the arguments knowing the endpoint's own parameter types — the
  // generic first parse guessed, mangling opaque values like access codes —
  // then coerce each value to the JSON type its parameter documents.
  const stringKeys = parameters
    .filter(({ format }) => format !== 'boolean' && format !== 'number')
    .flatMap(({ name }) => [name, name.replace(/_/g, '-')])
  const { params: argParams, issues } = coerceArgParams(
    parameters,
    toArgParams(parseCliArgs(invocation.argv, { stringKeys })),
  )

  if (issues.length > 0) {
    throw new UsageError(
      `Invalid ${
        issues.length === 1 ? 'value' : 'values'
      } for ${apiPath}: ${issues
        .map(({ name, expected }) => `${toArgName(name)} expects ${expected}`)
        .join('; ')}`,
      {
        hint: `Run 'seam ${path.join(' ')} --help' to see what it accepts.`,
      },
    )
  }

  // Params given as arguments win over params piped in.
  const commandParams: Record<string, any> = { ...invocation.stdinParams }
  Object.assign(commandParams, argParams)

  applyEndpointDefaults(path, commandParams)

  // Non-interactive runs never prompt: validate and send what was given.
  let params: Record<string, any>
  if (isNonInteractive) {
    assertRequiredParams(parameters, commandParams, apiPath)
    params = commandParams
  } else {
    const edited = await interactForCommandParams(
      { command: path, params: commandParams },
      ctx,
    )

    if (edited === '[Back]') {
      return { kind: 'back', toPath: path.slice(0, -1) }
    }
    params = edited
  }

  if (apiPath.includes('/events/list') && params['between']) {
    delete params['since']
  }

  const response = await RequestSeamApi({
    path: apiPath,
    params,
    responseKey: getResponseKey(path, ctx),
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

  return { kind: 'done' }
}

/**
 * Per-endpoint request policy that is not derivable from the API
 * definitions. Keep this table small and explicit.
 */
const applyEndpointDefaults = (
  path: string[],
  params: Record<string, any>,
): void => {
  // Unbounded event lists are never wanted, so default to the last month.
  if (isEqual(path, ['events', 'list']) && !params['since']) {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    params['since'] = date.toISOString()
  }
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
