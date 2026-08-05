import { isApiKey, isPersonalAccessToken } from '@seamapi/http/connect'
import chalk from 'chalk'

import { assertMutable, storeToken } from 'lib/auth/operations.js'
import { validateToken } from 'lib/auth/validate-token.js'
import { getConfigStore } from 'lib/config/index.js'
import { resolveAuth } from 'lib/context.js'
import { getOutput } from 'lib/output/get-output.js'
import { promptText } from './prompt.js'
import { withLoading } from 'lib/output/with-loading.js'
import { interactForWorkspaceId } from './workspace-id.js'

export const interactForLogin = async () => {
  const config = getConfigStore()
  const output = getOutput()
  const auth = resolveAuth(config)

  // Refuse before prompting: nothing typed here could be stored.
  assertMutable(auth, 'token', 'log in')

  if (auth.server.includes('localhost')) {
    output.info(
      `You're using a local Seam Connect instance, you can enter the API Key to your local user, you can create a new user from:\n\n${auth.server}/admin/create_user_with_api_key`,
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

  const pat = await promptText({
    message: 'Personal Access Token:',
  })
  const token = pat.trim()

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

  storeToken(token, config)
  output.info(`Token saved! You may begin using the CLI!`)
}
