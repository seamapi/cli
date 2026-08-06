export const ellipsis = (str: string, len: number) => {
  if (str.length <= len) return str
  return str.slice(0, len - 3) + '...'
}

/** Reduce documentation markdown to a single line of prose. */
export const toPlainText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const firstSentence = (text: string): string => {
  const [sentence] = text.split(/(?<=\.)\s/)
  return sentence ?? text
}
