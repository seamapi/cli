import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Blueprint } from '@seamapi/blueprint'

import { seamapiBlueprintVersion } from '../version.js'

const cacheFileName = 'blueprint.json'
const updateCheckInterval = 24 * 60 * 60 * 1000

export interface BlueprintCache {
  blueprintVersion: string
  typesVersion: string
  checkedAt: string
  blueprint: Blueprint
}

export const getCacheFile = (cacheDirectory: string): string =>
  join(cacheDirectory, cacheFileName)

export const readCache = async (
  file: string,
): Promise<BlueprintCache | null> => {
  try {
    const cache = JSON.parse(await readFile(file, 'utf8')) as unknown
    if (!isBlueprintCache(cache)) return null
    return cache
  } catch {
    return null
  }
}

export const writeCache = async (
  file: string,
  cache: BlueprintCache,
): Promise<void> => {
  const temporaryFile = `${file}.tmp`
  await mkdir(dirname(file), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(cache)}\n`, 'utf8')
  await rename(temporaryFile, file)
}

export const isUpdateCheckDue = (checkedAt: string): boolean => {
  const checkedAtTime = Date.parse(checkedAt)
  if (Number.isNaN(checkedAtTime)) return true
  return Date.now() - checkedAtTime > updateCheckInterval
}

/**
 * The blueprint version the cache is keyed on: a cached blueprint built by a
 * different @seamapi/blueprint version is stale even for the same types.
 */
export const getBlueprintVersion = async (): Promise<string> => {
  if (seamapiBlueprintVersion !== '0.0.0') return seamapiBlueprintVersion

  // The version is only injected when the package is packed, so a
  // development checkout reads the pinned version from package.json
  // to keep invalidating the cache on version changes as expected.
  const pkg = await findOwnPackageJson()
  return pkg?.dependencies?.['@seamapi/blueprint'] ?? seamapiBlueprintVersion
}

const findOwnPackageJson = async (): Promise<{
  dependencies?: Record<string, string>
} | null> => {
  let directory = dirname(fileURLToPath(import.meta.url))
  while (true) {
    try {
      const pkg = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      ) as { name?: string; dependencies?: Record<string, string> }
      if (pkg.name === '@seamapi/cli') return pkg
    } catch {
      // Keep walking up until a package.json for this package is found.
    }
    const parent = dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

const isBlueprintCache = (cache: unknown): cache is BlueprintCache => {
  if (cache == null || typeof cache !== 'object') return false
  const { blueprintVersion, typesVersion, checkedAt, blueprint } =
    cache as Record<string, unknown>
  return (
    typeof blueprintVersion === 'string' &&
    typeof typesVersion === 'string' &&
    typeof checkedAt === 'string' &&
    blueprint != null &&
    typeof blueprint === 'object'
  )
}
