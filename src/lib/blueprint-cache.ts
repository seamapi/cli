import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Blueprint } from '@seamapi/blueprint'
import envPaths from 'env-paths'

// Bump when the cached representation changes in a way that older files cannot
// satisfy, e.g. when the options passed to createBlueprint change.
const cacheFormatVersion = 1

const cacheFilePrefix = 'blueprint-'

const cacheDirectory = envPaths('seam-cli', { suffix: '' }).cache

const isCacheDisabled = (): boolean =>
  (process.env['SEAM_CLI_DISABLE_BLUEPRINT_CACHE'] ?? '') !== ''

// The Blueprint is derived entirely from these two packages, so their installed
// versions are the only thing that can invalidate a cached copy.
const versionedPackages = ['@seamapi/types/connect', '@seamapi/blueprint']

const readPackageVersion = async (specifier: string): Promise<string> => {
  let directory = dirname(fileURLToPath(import.meta.resolve(specifier)))

  for (;;) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      ) as { version?: string }
      if (manifest.version != null) return manifest.version
    } catch {
      // Keep walking up: this directory has no readable manifest.
    }

    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error(`Could not resolve the version of ${specifier}`)
    }
    directory = parent
  }
}

const getCacheFileName = async (): Promise<string> => {
  const versions = await Promise.all(versionedPackages.map(readPackageVersion))
  return `${cacheFilePrefix}${cacheFormatVersion}-${versions.join('-')}.json`
}

export const readCachedBlueprint = async (): Promise<Blueprint | null> => {
  if (isCacheDisabled()) return null

  try {
    const file = join(cacheDirectory, await getCacheFileName())
    return JSON.parse(await readFile(file, 'utf8')) as Blueprint
  } catch {
    // A missing, unreadable or truncated cache is not an error: rebuild.
    return null
  }
}

export const writeCachedBlueprint = async (
  blueprint: Blueprint,
): Promise<void> => {
  if (isCacheDisabled()) return

  try {
    const fileName = await getCacheFileName()
    await mkdir(cacheDirectory, { recursive: true })

    // Write to a process-private path and rename, so a concurrent invocation
    // never reads a partially written file.
    const file = join(cacheDirectory, fileName)
    const temporaryFile = `${file}.${process.pid}.tmp`
    await writeFile(temporaryFile, JSON.stringify(blueprint), 'utf8')
    await rename(temporaryFile, file)

    await pruneStaleCacheFiles(fileName)
  } catch {
    // Caching is an optimization: failing to persist must not fail the command.
  }
}

const pruneStaleCacheFiles = async (currentFileName: string): Promise<void> => {
  const entries = await readdir(cacheDirectory)
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.startsWith(cacheFilePrefix) && entry !== currentFileName,
      )
      .map(async (entry) => {
        await rm(join(cacheDirectory, entry), { force: true })
      }),
  )
}
