import type { CliContext } from '../context.js'
import { isInsideWebBrowser } from '../env.js'
import { interactForActionAttemptPoll } from '../interact/interact-for-action-attempt-poll.js'
import { promptConfirm } from '../interact/prompt.js'

/**
 * Follow-ups a response may call for: opening a connect webview in the
 * browser, and offering to poll a pending action attempt.
 */
export const runResponseFollowUps = async (
  data: any,
  ctx: CliContext,
): Promise<void> => {
  const isNonInteractive = ctx.interactivity === 'non-interactive'

  if (data?.connect_webview) {
    await handleConnectWebview(data.connect_webview, isNonInteractive)
  }

  if (data?.action_attempt && !isNonInteractive) {
    await interactForActionAttemptPoll(data.action_attempt)
  }
}

const handleConnectWebview = async (
  connectWebview: any,
  isNonInteractive: boolean,
): Promise<void> => {
  const url = connectWebview.url

  if (!isNonInteractive && !isInsideWebBrowser()) {
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
