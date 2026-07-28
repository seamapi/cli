import { getConfigStore } from "./get-config-store"

export const getServer = () => {
  const config = getConfigStore()

  return config.get("server") ?? "https://connect.getseam.com"
}
