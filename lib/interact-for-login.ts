import prompts from "prompts"
import { getConfigStore } from "./get-config-store"
import { interactForWorkspaceId } from "./interact-for-workspace-id"
import { getServer } from "./get-server"
import chalk from "chalk"
import { isApiKey, isPersonalAccessToken } from "@seamapi/http/connect"
import { withLoading } from "./util/with-loading"
import { validateToken } from "./validate-token"

export const interactForLogin = async () => {
  const config = await getConfigStore()

  if (getServer().includes("localhost")) {
    console.log(
      `You're using a local Seam Connect instance, you can enter the API Key to your local user, you can create a new user from:\n\n${getServer()}/admin/create_user_with_api_key`
    )
  } else {
    console.log(
      `To login, navigate to the URL below and create a new Personal Access Token (PAT) and paste the PAT in the provided box:\n\nhttps://console.seam.co/settings/access-tokens\n\n`
    )
  }

  console.log(
    chalk.gray(
      "> Note: You can enter an API Key here for single-workspace access"
    )
  )

  const { pat } = await prompts({
    name: "pat",
    type: "text",
    message: "Personal Access Token:",
  })
  const token = pat?.trim()

  if (!token) {
    throw new Error("No token provided")
  }

  if (isPersonalAccessToken(token)) {
    await interactForWorkspaceId(token)
  } else if (isApiKey(token)) {
    await withLoading("Validating API key...", () => validateToken(token))
  } else {
    throw new Error("Invalid token: expected a Personal Access Token or API Key")
  }

  config.set(`${getServer()}.pat`, token)
  console.log(`Token saved! You may begin using the CLI!`)
}
