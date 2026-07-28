import prompts from "prompts"
import { getConfigStore } from "./get-config-store"

export async function interactForUseRemoteApiDefs() {
  const { use_remote_api_defs } = await prompts([
    {
      type: "select",
      name: "use_remote_api_defs",
      message: "Always use remote API Definitions?",
      choices: [
        {
          title: "Yes",
          value: true,
        },
        {
          title: "No",
          value: false,
        },
      ],
    },
  ])

  const config = getConfigStore()
  config.set("use_remote_api_defs", use_remote_api_defs)
  console.log(`Use remote API Definitions: ${use_remote_api_defs}`)
}
