import { readFileSync } from 'node:fs'

// This module resolves to lib/version.js in the published package and to
// src/lib/version.ts when running from source, so package.json sits one or
// two directories up depending on how the CLI was started.
const packageJsonUrls = [
  new URL('../package.json', import.meta.url),
  new URL('../../package.json', import.meta.url),
]

const readVersion = (url: URL): string | undefined => {
  try {
    const { version } = JSON.parse(readFileSync(url, 'utf8')) as {
      version?: string
    }
    return version
  } catch {
    return undefined
  }
}

export const version: string =
  packageJsonUrls.map(readVersion).find((v) => v != null) ?? '0.0.0'
