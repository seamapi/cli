import { existsSync } from 'node:fs'

// This module is emitted to lib/ in the published package and runs from
// src/lib/ during development, so the package root is one or two directories
// up depending on how the CLI was started.
const candidatePaths = ['../', '../../']

export const packageFileUrl = (name: string): URL => {
  for (const path of candidatePaths) {
    const url = new URL(`${path}${name}`, import.meta.url)
    if (existsSync(url)) return url
  }

  throw new Error(`Could not find ${name} in the package root`)
}
