import prompts from "prompts"
export const interactForTimestamp = async () => {
  const { timestamp } = await prompts({
    name: "timestamp",
    type: "date",
    message: "Enter a timestamp:",
  })

  return timestamp.toISOString()
}
