import { isApiKey, isPersonalAccessToken } from '@seamapi/http/connect'
import chalk from 'chalk'

import { getConfigStore } from './config/index.js'
import { getServer } from './get-server.js'
import { interactForWorkspaceId } from './interact-for-workspace-id.js'
import { getOutput } from './output/get-output.js'
import { prompt } from './util/prompt.js'
import { withLoading } from './util/with-loading.js'
import { validateToken } from './validate-token.js'

export const interactForLogin = async () => {
  const config = await getConfigStore()
  const output = getOutput()

  if (getServer().includes('localhost')) {
    output.info(
      `You're using a local Seam Connect instance, you can enter the API Key to your local user, you can create a new user from:\n\n${getServer()}/admin/create_user_with_api_key`,
    )
  } else {
    output.info(
      `To login, navigate to the URL below and create a new Personal Access Token (PAT) and paste the PAT in the provided box:\n\nhttps://console.seam.co/settings/access-tokens\n\n`,
    )
  }

  output.info(
    chalk.gray(
      '> Note: You can enter an API Key here for single-workspace access',
    ),
  )

  const { pat } = await prompt({
    name: 'pat',
    type: 'text',
    message: 'Personal Access Token:',
  })
  const token = pat?.trim()

  if (!token) {
    throw new Error('No token provided')
  }

  if (isPersonalAccessToken(token)) {
    await interactForWorkspaceId(token)
  } else if (isApiKey(token)) {
    await withLoading('Validating API key...', () => validateToken(token))
  } else {
    throw new Error(
      'Invalid token: expected a Personal Access Token or API Key',
    )
  }

  config.set(`${getServer()}.pat`, token)
  output.info(`Token saved! You may begin using the CLI!`)
}
