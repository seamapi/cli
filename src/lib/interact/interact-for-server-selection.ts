import { randomBytes } from 'node:crypto'

import {
  assertMutable,
  selectFakeServer,
  selectServer,
} from '../auth/operations.js'
import { getConfigStore } from '../config/index.js'
import { resolveAuth } from '../context.js'
import { getOutput } from '../output/get-output.js'
import { promptAutocomplete, promptText } from './prompt.js'

export async function interactForServerSelection() {
  const config = getConfigStore()
  assertMutable(resolveAuth(config), 'server', 'select a server')

  const servers = [
    'http://localhost:3020',
    'https://connect.getseam.com',
    'https://fakeseamconnect.seam.vc',
  ]

  // Searchable, as selecting a device or a command is.
  const server = await promptAutocomplete({
    message: 'Select a server:',
    choices: servers.map((server) => ({ label: server, value: server })),
  })

  const output = getOutput()
  if (server === servers[2]) {
    let userUrlSeed = await promptText({
      message:
        'You can input a custom server URL or leave this field empty to use a new fakeserver.',
    })

    if (userUrlSeed.trim().length === 0) {
      userUrlSeed = randomBytes(5).toString('hex')
    }
    selectFakeServer(userUrlSeed, config)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
  } else {
    selectServer(server, config)
  }
  output.info(`Server set to ${server}`)
}
