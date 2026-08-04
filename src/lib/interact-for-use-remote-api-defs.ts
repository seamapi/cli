import { getConfigStore } from './config/index.js'
import { getOutput } from './output/get-output.js'
import { prompt } from './util/prompt.js'

export async function interactForUseRemoteApiDefs() {
  const { use_remote_api_defs } = await prompt([
    {
      type: 'select',
      name: 'use_remote_api_defs',
      message: 'Always use remote API Definitions?',
      choices: [
        {
          title: 'Yes',
          value: true,
        },
        {
          title: 'No',
          value: false,
        },
      ],
    },
  ])

  const config = getConfigStore()
  config.set('use_remote_api_defs', use_remote_api_defs)
  getOutput().info(`Use remote API Definitions: ${use_remote_api_defs}`)
}
