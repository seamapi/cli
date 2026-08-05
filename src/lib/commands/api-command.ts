import { isDeepStrictEqual as isEqual } from 'node:util'

import type { Interactivity } from '../args/parse.js'
import { getResponseKey } from '../blueprint/endpoint.js'
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

  // Params given as arguments win over params piped in.
  const commandParams: Record<string, any> = { ...invocation.stdinParams }
  Object.assign(commandParams, invocation.argParams)

  applyEndpointDefaults(path, commandParams)

  // TODO - do this using the OpenAPI spec for the command rather than
  // explicitly encoding the property names
  if (commandParams['accepted_providers']) {
    commandParams['accepted_providers'] =
      commandParams['accepted_providers'].split(',')
  }

  const apiPath = `/${path.join('/').replace(/-/g, '_')}`

  const params = await interactForCommandParams(
    { command: path, params: commandParams },
    ctx,
  )

  if (params === '[Back]') {
    return { kind: 'back', toPath: path.slice(0, -1) }
  }

  if (apiPath.includes('/events/list') && params.between) {
    delete params.since
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
