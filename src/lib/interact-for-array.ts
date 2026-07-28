import prompts from "prompts"

export const interactForArray = async (
  array: string[],
  message: string
): Promise<string[]> => {
  let updatedArray = [...array]

  const displayList = () => {
    console.log(`${message} Current list:`)
    if (updatedArray.length > 0) {
      updatedArray.forEach((item, index) => {
        console.log(`${index + 1}: ${item}`)
      })
    } else {
      console.log("The list is currently empty.")
    }
  }

  let action: string
  do {
    displayList()

    const response = await prompts({
      type: "select",
      name: "action",
      message: "Choose an action:",
      choices: [
        { title: "Add an item", value: "add" },
        { title: "Remove an item", value: "remove" },
        { title: "Finish editing", value: "done" },
      ],
    })

    action = response.action

    if (action === "add") {
      const { newItem } = await prompts({
        type: "text",
        name: "newItem",
        message: "Enter the new item:",
      })
      if (newItem) {
        updatedArray.push(newItem)
      }
    } else if (action === "remove") {
      const { index } = await prompts({
        type: "number",
        name: "index",
        message: "Enter the index of the item to remove:",
        validate: (value) =>
          value > 0 && value <= updatedArray.length ? true : "Invalid index",
      })
      if (index) {
        updatedArray.splice(index - 1, 1)
      }
    }
  } while (action !== "done")

  return updatedArray
}
