import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import type { Blueprint, TypesModuleInput } from '@seamapi/blueprint'
import envPaths from 'env-paths'

import { withLoading } from './util/with-loading.js'
import { seamapiBlueprintVersion } from './version.js'

const typesPackageName = '@seamapi/types'
const openapiTarEntryName = 'package/lib/seam/connect/openapi.js'
const registryUrl = 'https://registry.npmjs.org'
const updateCheckInterval = 24 * 60 * 60 * 1000

const cacheFileName = 'blueprint.json'
const developmentCacheFileName = 'blueprint-development.json'
const paths = envPaths('seam', { suffix: '' })

interface BlueprintCache {
  blueprintVersion: string
  typesVersion: string
  checkedAt: string
  blueprint: Blueprint
}

interface TypesPackageManifest {
  version: string
  dist: { tarball: string }
}

interface GetBlueprintOptions {
  update?: boolean
}

const getBlueprint = async (
  options: GetBlueprintOptions = {},
): Promise<Blueprint> => {
  const update = options.update ?? false

  // The blueprint version is only injected when the package is packed,
  // so a development checkout builds the blueprint from the locally
  // installed @seamapi/types instead of fetching it.
  if (seamapiBlueprintVersion === '0.0.0') {
    return await getDevelopmentBlueprint(update)
  }

  const cacheFile = join(paths.cache, cacheFileName)

  const cache = await readCache(cacheFile)
  const isCacheUsable =
    cache != null && cache.blueprintVersion === seamapiBlueprintVersion

  if (!update && isCacheUsable && !isUpdateCheckDue(cache.checkedAt)) {
    return cache.blueprint
  }

  let manifest: TypesPackageManifest
  try {
    manifest = await fetchLatestTypesPackageManifest()
  } catch (error) {
    // Unable to reach the registry, e.g., offline. Prefer a stale blueprint
    // over failing, unless an update was explicitly requested.
    if (cache != null && !update) return cache.blueprint
    throw new Error(
      `Could not check for Seam API definition updates: ${toErrorMessage(error)}`,
    )
  }

  if (!update && isCacheUsable && cache.typesVersion === manifest.version) {
    await writeCache(cacheFile, {
      ...cache,
      checkedAt: new Date().toISOString(),
    })
    return cache.blueprint
  }

  let blueprint: Blueprint
  try {
    blueprint = await withLoading(
      `Downloading Seam API definitions (${typesPackageName}@${manifest.version})`,
      async () => await generateBlueprint(manifest),
    )
  } catch (error) {
    if (cache != null && !update) return cache.blueprint
    throw new Error(
      `Could not update Seam API definitions: ${toErrorMessage(error)}`,
    )
  }

  await writeCache(cacheFile, {
    blueprintVersion: seamapiBlueprintVersion,
    typesVersion: manifest.version,
    checkedAt: new Date().toISOString(),
    blueprint,
  })

  return blueprint
}

const getDevelopmentBlueprint = async (update: boolean): Promise<Blueprint> => {
  const cacheFile = join(paths.cache, developmentCacheFileName)
  const versions = await readDevelopmentPackageVersions()

  const cache = await readCache(cacheFile)
  if (
    !update &&
    cache != null &&
    cache.blueprintVersion === versions.blueprintVersion &&
    cache.typesVersion === versions.typesVersion
  ) {
    return cache.blueprint
  }

  const [{ createBlueprint }, { openapi }] = await Promise.all([
    import('@seamapi/blueprint'),
    import('@seamapi/types/connect'),
  ])
  const blueprint = await createBlueprint(
    { openapi },
    { omitUndocumented: true },
  )

  await writeCache(cacheFile, {
    blueprintVersion: versions.blueprintVersion,
    typesVersion: versions.typesVersion,
    checkedAt: new Date().toISOString(),
    blueprint,
  })

  return blueprint
}

// Invalidate the development cache when the versions pinned in
// package.json change.
const readDevelopmentPackageVersions = async (): Promise<{
  blueprintVersion: string
  typesVersion: string
}> => {
  for (const path of ['../../package.json', '../package.json']) {
    try {
      const pkg = JSON.parse(
        await readFile(new URL(path, import.meta.url), 'utf8'),
      ) as {
        name?: string
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      if (pkg.name !== '@seamapi/cli') continue
      return {
        blueprintVersion: pkg.dependencies?.['@seamapi/blueprint'] ?? '0.0.0',
        typesVersion: pkg.devDependencies?.[typesPackageName] ?? '0.0.0',
      }
    } catch {
      continue
    }
  }

  return { blueprintVersion: '0.0.0', typesVersion: '0.0.0' }
}

const isUpdateCheckDue = (checkedAt: string): boolean => {
  const checkedAtTime = Date.parse(checkedAt)
  if (Number.isNaN(checkedAtTime)) return true
  return Date.now() - checkedAtTime > updateCheckInterval
}

const fetchLatestTypesPackageManifest =
  async (): Promise<TypesPackageManifest> => {
    const res = await fetch(`${registryUrl}/${typesPackageName}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      throw new Error(`npm registry responded with status ${res.status}`)
    }
    const manifest = (await res.json()) as Partial<TypesPackageManifest>
    if (
      typeof manifest.version !== 'string' ||
      typeof manifest.dist?.tarball !== 'string'
    ) {
      throw new Error('npm registry returned an unexpected package manifest')
    }
    return { version: manifest.version, dist: manifest.dist }
  }

const generateBlueprint = async (
  manifest: TypesPackageManifest,
): Promise<Blueprint> => {
  const openapi = await downloadOpenapi(manifest)
  const { createBlueprint } = await import('@seamapi/blueprint')
  return await createBlueprint({ openapi } as TypesModuleInput, {
    omitUndocumented: true,
  })
}

const downloadOpenapi = async (
  manifest: TypesPackageManifest,
): Promise<unknown> => {
  const res = await fetch(manifest.dist.tarball, {
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`npm registry responded with status ${res.status}`)
  }
  const tarball = gunzipSync(Buffer.from(await res.arrayBuffer()))
  const openapiModule = extractTarEntry(tarball, openapiTarEntryName)

  // The OpenAPI document is published as a JavaScript module,
  // so write it to the cache directory and import it.
  const moduleFile = join(paths.cache, `openapi-${manifest.version}.mjs`)
  await mkdir(paths.cache, { recursive: true })
  await writeFile(moduleFile, openapiModule)
  try {
    const openapiModuleUrl = pathToFileURL(moduleFile).href
    const { default: openapi } = (await import(openapiModuleUrl)) as {
      default: unknown
    }
    if (openapi == null) {
      throw new Error(`Missing default export in ${openapiTarEntryName}`)
    }
    return openapi
  } finally {
    await rm(moduleFile, { force: true })
  }
}

export const extractTarEntry = (tar: Buffer, entryName: string): Buffer => {
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    const name = readTarString(header, 0, 100)
    if (name === '') break
    const size = Number.parseInt(readTarString(header, 124, 12), 8)
    if (Number.isNaN(size)) {
      throw new Error(`Invalid tar entry size for ${name}`)
    }
    const prefix = readTarString(header, 345, 155)
    const fullName = prefix === '' ? name : `${prefix}/${name}`
    if (fullName === entryName) {
      return tar.subarray(offset + 512, offset + 512 + size)
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  throw new Error(`Missing ${entryName} in tar archive`)
}

const readTarString = (
  header: Buffer,
  offset: number,
  length: number,
): string => {
  const field = header.subarray(offset, offset + length)
  const end = field.indexOf(0)
  return field.subarray(0, end === -1 ? length : end).toString('utf8')
}

const readCache = async (file: string): Promise<BlueprintCache | null> => {
  try {
    const cache = JSON.parse(await readFile(file, 'utf8')) as unknown
    if (!isBlueprintCache(cache)) return null
    return cache
  } catch {
    return null
  }
}

const writeCache = async (
  file: string,
  cache: BlueprintCache,
): Promise<void> => {
  const temporaryFile = `${file}.tmp`
  await mkdir(paths.cache, { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(cache)}\n`, 'utf8')
  await rename(temporaryFile, file)
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

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export default getBlueprint
