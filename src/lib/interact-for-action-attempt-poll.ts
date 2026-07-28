import prompts from "prompts"
import { getSeam } from "./get-seam"
import { ActionAttemptsGetResponse } from "@seamapi/http/connect"
import { withLoading } from "./util/with-loading"

export const interactForActionAttemptPoll = async (
  action_attempt: ActionAttemptsGetResponse["action_attempt"]
) => {
  if (action_attempt.status === "pending") {
    const { poll_for_action_attempt } = await prompts({
      name: "poll_for_action_attempt",
      message: "Would you like to poll the action attempt until it's ready?",
      type: "toggle",
      initial: true,
      active: "yes",
      inactive: "no",
    })

    if (poll_for_action_attempt) {
      const seam = await getSeam()
      const { action_attempt_id } = action_attempt

      const updated_action_attempt = await withLoading(
        "Polling action attempt...",
        () =>
          seam.actionAttempts.get(
            { action_attempt_id },
            { waitForActionAttempt: { pollingInterval: 240, timeout: 10_000 } }
          )
      )
      console.dir(updated_action_attempt, { depth: null })
    }
  }
}
