import type { ActionAttemptsGetResponse } from '@seamapi/http/connect'

import { getSeam } from './get-seam.js'
import { getOutput } from './output/get-output.js'
import { promptConfirm } from './util/prompt.js'
import { withLoading } from './util/with-loading.js'

export const interactForActionAttemptPoll = async (
  actionAttempt: ActionAttemptsGetResponse['action_attempt'],
) => {
  if (actionAttempt.status === 'pending') {
    const pollForActionAttempt = await promptConfirm({
      message: "Would you like to poll the action attempt until it's ready?",
      initialValue: true,
      active: 'yes',
      inactive: 'no',
    })

    if (pollForActionAttempt) {
      const seam = await getSeam()
      const { action_attempt_id: actionAttemptId } = actionAttempt

      const updatedActionAttempt = await withLoading(
        'Polling action attempt...',
        () =>
          seam.actionAttempts.get(
            { action_attempt_id: actionAttemptId },
            { waitForActionAttempt: { pollingInterval: 240, timeout: 10_000 } },
          ),
      )
      getOutput().data({ action_attempt: updatedActionAttempt })
    }
  }
}
