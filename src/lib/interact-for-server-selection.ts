import { randomBytes } from 'node:crypto'

import { getConfigStore } from './config/index.js'
import { getServer } from './get-server.js'
import { getOutput } from './output/get-output.js'
import { promptSelect, promptText } from './util/prompt.js'

export async function interactForServerSelection() {
  const servers = [
    'http://localhost:3020',
    'https://connect.getseam.com',
    'https://fakeseamconnect.seam.vc',
  ]

  const server = await promptSelect({
    message: 'Select a server:',
    choices: servers.map((server) => ({ label: server, value: server })),
  })

  const config = getConfigStore()
  const output = getOutput()
  if (server === servers[2]) {
    let userUrlSeed = await promptText({
      message:
        'You can input a custom server URL or leave this field empty to use a new fakeserver.',
    })

    if (userUrlSeed.trim().length === 0) {
      userUrlSeed = randomBytes(5).toString('hex')
    }
    config.set('server', `https://${userUrlSeed}.fakeseamconnect.seam.vc`)
    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    output.info(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
  } else {
    config.set('server', server)
  }
  config.delete('current_workspace_id')
  output.info(`Server set to ${server}`)
}
