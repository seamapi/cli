import { readFileSync } from 'node:fs'

import { packageFileUrl } from './package-file.js'

const readVersion = (): string | undefined => {
  try {
    const { version } = JSON.parse(
      readFileSync(packageFileUrl('package.json'), 'utf8'),
    ) as { version?: string }
    return version
  } catch {
    return undefined
  }
}

export const version: string = readVersion() ?? '0.0.0'
