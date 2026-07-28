export const ellipsis = (str: string, len: number) => {
  if (str.length <= len) return str
  return str.slice(0, len - 3) + "..."
}
