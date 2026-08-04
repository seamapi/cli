import { setUseRemoteApiDefs } from '../auth/operations.js'
import { getOutput } from '../output/get-output.js'
import { promptSelect } from './prompt.js'

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

  setUseRemoteApiDefs(useRemoteApiDefs)
  getOutput().info(`Use remote API Definitions: ${useRemoteApiDefs}`)
}
