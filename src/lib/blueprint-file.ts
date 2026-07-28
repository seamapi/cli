import { readFile } from 'node:fs/promises'

import type { Blueprint } from '@seamapi/blueprint'

import { packageFileUrl } from './package-file.js'

export const blueprintFileName = 'blueprint.json'

export interface BlueprintFile {
  generatedFrom: Record<string, string>
  blueprint: Blueprint
}

export const readBlueprintFile = async (): Promise<BlueprintFile | null> => {
  try {
    return JSON.parse(
      await readFile(packageFileUrl(blueprintFileName), 'utf8'),
    ) as BlueprintFile
  } catch {
    // The file is generated at build time, so treat a missing or unreadable
    // one as absent and let the caller build the blueprint instead.
    return null
  }
}
