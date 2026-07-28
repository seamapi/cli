import prompts from "prompts"
import { getSeam } from "./get-seam"
import { CustomMetadata } from "@seamapi/types/connect"

type UpdatedCustomMetadata = {
  [x: string]: string | boolean | null
}

export const interactForCustomMetadata = async (
  custom_metadata: CustomMetadata
) => {
  const seam = await getSeam()
  const updated_custom_metadata: UpdatedCustomMetadata = { ...custom_metadata }

  const displayCurrentCustomMetadata = () => {
    console.log("custom_metadata:")
    if (Object.keys(updated_custom_metadata).length > 0) {
      Object.keys(updated_custom_metadata).forEach((key, index) => {
        console.log(`${index + 1}: ${key}: ${updated_custom_metadata[key]}`)
      })
    } else {
      console.log("The custom metadata param is empty.")
    }
  }

  let action: string

  do {
    displayCurrentCustomMetadata()

    const response = await prompts({
      type: "select",
      name: "action",
      message: "Choose an action:",
      choices: [
        { title: "Add an item to params", value: "add" },
        { title: "Remove an item from params", value: "remove" },
        { title: "Finish editing params", value: "done" },
      ],
    })

    action = response.action

    if (action === "add") {
      const { newKey } = await prompts({
        type: "text",
        name: "newKey",
        message: "Enter a key to add or edit:",
      })

      let { newValue } = await prompts({
        type: "text",
        name: "newValue",
        message: "Enter the new value to add or edit (or null to delete):",
      })
      if (newKey) {
        if (newValue === "false" || newValue === "true") {
          newValue = Boolean(newValue)
        }
        if (newValue === "null") {
          updated_custom_metadata[newKey] = null
        } else {
          updated_custom_metadata[newKey] = newValue
        }
      }
    } else if (action === "remove") {
      const { custom_key_to_remove } = await prompts({
        type: "select",
        name: "custom_key_to_remove",
        message: "Choose a key-value pair to remove from params:",
        choices: Object.keys(updated_custom_metadata).map(
          (custom_metadata_key) => {
            return {
              title: `${custom_metadata_key}: ${updated_custom_metadata[custom_metadata_key]}`,
              value: custom_metadata_key,
            }
          }
        ),
      })

      if (custom_key_to_remove) {
        delete custom_metadata[custom_key_to_remove]
      }
    }
  } while (action !== "done")

  return updated_custom_metadata
}
