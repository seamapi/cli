import prompts from "prompts"
import { getConfigStore } from "./get-config-store"
import { randomBytes } from "node:crypto"
import { getServer } from "./get-server"

export async function interactForServerSelection() {
  const servers = [
    "http://localhost:3020",
    "https://connect.getseam.com",
    "https://fakeseamconnect.seam.vc",
  ]

  const { server } = await prompts([
    {
      type: "select",
      name: "server",
      message: "Select a server:",
      choices: servers.map((server) => ({ title: server, value: server })),
    },
  ])

  const config = getConfigStore()
  if (server === servers[2]) {
    let { userUrlSeed } = await prompts([
      {
        type: "text",
        name: "userUrlSeed",
        message:
          "You can input a custom server URL or leave this field empty to use a new fakeserver.",
      },
    ])

    if (userUrlSeed.trim().length === 0) {
      userUrlSeed = randomBytes(5).toString("hex")
    }
    config.set("server", `https://${userUrlSeed}.fakeseamconnect.seam.vc`)
    config.set(`${getServer()}.pat`, `seam_apikey1_token`)
    console.log(`PAT set to use fakeseamconnect with "seam_apikey1_token"`)
  } else {
    config.set("server", server)
  }
  config.delete("current_workspace_id")
  console.log(`Server set to ${server}`)
}
