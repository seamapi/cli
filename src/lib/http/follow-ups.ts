import type { CliContext } from 'lib/context.js'
import { isInsideWebBrowser } from 'lib/env.js'
import { promptConfirm } from 'lib/prompt.js'

/**
 * Follow-ups a response may call for: opening a connect webview in the browser.
 */
export const runResponseFollowUps = async (
  data: any,
  ctx: CliContext,
): Promise<void> => {
  const isNonInteractive = ctx.interactivity === 'non-interactive'

  if (data?.connect_webview) {
    await handleConnectWebview(data.connect_webview, isNonInteractive)
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
