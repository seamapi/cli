import { randomBytes } from 'node:crypto'

import {
  assertMutable,
  selectEndpoint,
  selectFakeEndpoint,
} from 'lib/auth/operations.js'
import { getConfigStore } from 'lib/config/index.js'
import { resolveAuth } from 'lib/context.js'
import { getOutput } from 'lib/output/get-output.js'
import { promptAutocomplete, promptText } from 'lib/prompt.js'

export async function interactForEndpointSelection() {
  const config = getConfigStore()
  assertMutable(resolveAuth(config), 'endpoint', 'select an endpoint')

  const endpoints = [
    'http://localhost:3020',
    'https://connect.getseam.com',
    'https://fakeseamconnect.seam.vc',
  ]

  // Searchable, as selecting a device or a command is.
  const endpoint = await promptAutocomplete({
    message: 'Select an endpoint:',
    choices: endpoints.map((endpoint) => ({
      label: endpoint,
      value: endpoint,
    })),
  })

  const output = getOutput()
  if (endpoint === endpoints[2]) {
    let userUrlSeed = await promptText({
      message:
        'You can input a custom endpoint URL or leave this field empty to use a new fakeserver.',
    })

    if (userUrlSeed.trim().length === 0) {
      userUrlSeed = randomBytes(5).toString('hex')
    }
    selectFakeEndpoint({ urlSeed: userUrlSeed, config })
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
  } else {
    selectEndpoint(endpoint, config)
  }
  output.info(`Endpoint set to ${endpoint}`)
}
