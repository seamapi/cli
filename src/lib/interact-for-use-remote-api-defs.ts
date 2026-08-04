import { getConfigStore } from './config/index.js'
import { getOutput } from './output/get-output.js'
import { promptSelect } from './util/prompt.js'

export async function interactForUseRemoteApiDefs() {
  const useRemoteApiDefs = await promptSelect({
    message: 'Always use remote API Definitions?',
    choices: [
      {
        label: 'Yes',
        value: true,
      },
      {
        label: 'No',
        value: false,
      },
    ],
  })

  const config = getConfigStore()
  config.set('use_remote_api_defs', useRemoteApiDefs)
  getOutput().info(`Use remote API Definitions: ${useRemoteApiDefs}`)
}
