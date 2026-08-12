import { assertMutable, selectEndpoint } from 'lib/auth/operations.js'
import { getConfig } from 'lib/config/index.js'
import { resolveAuth } from 'lib/context.js'
import { getOutput } from 'lib/output/get-output.js'
import { promptAutocomplete } from 'lib/prompt.js'

export async function interactForEndpointSelection() {
  const config = getConfig()
  assertMutable(resolveAuth(config), 'endpoint', 'select an endpoint')

  const endpoints = ['http://localhost:3020', 'https://connect.getseam.com']

  // Searchable, as selecting a device or a command is.
  const endpoint = await promptAutocomplete({
    message: 'Select an endpoint:',
    choices: endpoints.map((endpoint) => ({
      label: endpoint,
      value: endpoint,
    })),
  })

  selectEndpoint(endpoint, config)
  getOutput().info(`Endpoint set to ${endpoint}`)
}
