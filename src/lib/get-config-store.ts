import Configstore from "configstore"

export const getConfigStore = () => {
  return new Configstore("seam-cli", {})
}
