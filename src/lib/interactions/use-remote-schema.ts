import { setUseRemoteSchema } from 'lib/auth/operations.js'
import { getOutput } from 'lib/output/get-output.js'
import { promptSelect } from 'lib/prompt.js'

export async function interactForUseRemoteSchema() {
  const useRemoteSchema = await promptSelect({
    message: 'Always use the remote schema?',
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

  setUseRemoteSchema(useRemoteSchema)
  getOutput().info(`Use remote schema: ${useRemoteSchema}`)
}
