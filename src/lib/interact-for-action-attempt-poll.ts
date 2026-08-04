import type { ActionAttemptsGetResponse } from '@seamapi/http/connect'

import { getSeam } from './get-seam.js'
import { getOutput } from './output/get-output.js'
import { prompt } from './util/prompt.js'
import { withLoading } from './util/with-loading.js'

export const interactForActionAttemptPoll = async (
  action_attempt: ActionAttemptsGetResponse['action_attempt'],
) => {
  if (action_attempt.status === 'pending') {
    const { poll_for_action_attempt } = await prompt({
      name: 'poll_for_action_attempt',
      message: "Would you like to poll the action attempt until it's ready?",
      type: 'toggle',
      initial: true,
      active: 'yes',
      inactive: 'no',
    })

    if (poll_for_action_attempt) {
      const seam = await getSeam()
      const { action_attempt_id } = action_attempt

      const updated_action_attempt = await withLoading(
        'Polling action attempt...',
        () =>
          seam.actionAttempts.get(
            { action_attempt_id },
            { waitForActionAttempt: { pollingInterval: 240, timeout: 10_000 } },
          ),
      )
      getOutput().data({ action_attempt: updated_action_attempt })
    }
  }
}
