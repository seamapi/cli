import { randomBytes } from 'node:crypto'

import { getConfigStore } from './config/index.js'
import {
  assertEnvVarUnset,
  endpointEnvVar,
  getEndpointFromEnv,
  getTokenFromEnv,
  tokenEnvVar,
} from './env.js'
import { getServer } from './get-server.js'
import { getOutput } from './output/get-output.js'
import { prompt } from './util/prompt.js'

export async function interactForServerSelection() {
  assertEnvVarUnset(endpointEnvVar, getEndpointFromEnv(), 'select a server')

  const servers = [
    'http://localhost:3020',
    'https://connect.getseam.com',
    'https://fakeseamconnect.seam.vc',
  ]

  const { server } = await prompt([
    {
      // Searchable, as selecting a device or a command is.
      type: 'autocomplete',
      name: 'server',
      message: 'Select a server:',
      choices: servers.map((server) => ({ title: server, value: server })),
    },
  ])

  const config = getConfigStore()
  const output = getOutput()
  if (server === servers[2]) {
    let { userUrlSeed } = await prompt([
      {
        type: 'text',
        name: 'userUrlSeed',
        message:
          'You can input a custom server URL or leave this field empty to use a new fakeserver.',
      },
    ])

    if (userUrlSeed.trim().length === 0) {
      userUrlSeed = randomBytes(5).toString('hex')
    }
    assertEnvVarUnset(tokenEnvVar, getTokenFromEnv(), 'log in')
    config.set('server', `https://${userUrlSeed}.fakeseamconnect.seam.vc`)
    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
  } else {
    config.set('server', server)
  }
  config.delete('current_workspace_id')
  output.info(`Server set to ${server}`)
}
