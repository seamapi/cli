import { firstSentence } from '../command-spec.js'
import { ellipsis } from '../util/ellipsis.js'

const maxDescriptionLength = 72

/**
 * Reduce a description to one short line that is safe to embed in a
 * single-quoted shell string.
 *
 * Completion menus give a description a single narrow column, and the shells
 * offer no way to escape a quote inside the generated scripts, so drop any
 * character that would end the string early. A colon goes too, since zsh reads
 * it as the separator in a `_describe` entry.
 */
export const describeForShell = (description: string): string =>
  ellipsis(
    firstSentence(description)
      .replace(/['"`$\\:]/g, '')
      .trim(),
    maxDescriptionLength,
  )
