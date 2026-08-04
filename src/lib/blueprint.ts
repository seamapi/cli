import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Blueprint, TypesModuleInput } from '@seamapi/blueprint'
import envPaths from 'env-paths'
import { extract } from 'tar'

import { withLoading } from './util/with-loading.js'
import { seamapiBlueprintVersion } from './version.js'

const typesPackageName = '@seamapi/types'
const openapiTarEntryName = 'package/lib/seam/connect/openapi.js'
const registryUrl = 'https://registry.npmjs.org'
const updateCheckInterval = 24 * 60 * 60 * 1000

const cacheFileName = 'blueprint.json'

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
  cacheDirectory?: string
}

const getBlueprint = async (
  options: GetBlueprintOptions = {},
): Promise<Blueprint> => {
  const update = options.update ?? false
  const cacheDirectory =
    options.cacheDirectory ?? envPaths('seam', { suffix: '' }).cache
  const cacheFile = join(cacheDirectory, cacheFileName)
  const blueprintVersion = await getBlueprintVersion()

  const cache = await readCache(cacheFile)
  const isCacheUsable =
    cache != null && cache.blueprintVersion === blueprintVersion

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
      async () => await generateBlueprint(manifest, cacheDirectory),
    )
  } catch (error) {
    if (cache != null && !update) return cache.blueprint
    throw new Error(
      `Could not update Seam API definitions: ${toErrorMessage(error)}`,
    )
  }

  await writeCache(cacheFile, {
    blueprintVersion,
    typesVersion: manifest.version,
    checkedAt: new Date().toISOString(),
    blueprint,
  })

  return blueprint
}

const getBlueprintVersion = async (): Promise<string> => {
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
  cacheDirectory: string,
): Promise<Blueprint> => {
  const openapi = await downloadOpenapi(manifest, cacheDirectory)
  const { createBlueprint } = await import('@seamapi/blueprint')
  return await createBlueprint({ openapi } as TypesModuleInput, {
    omitUndocumented: true,
  })
}

const downloadOpenapi = async (
  manifest: TypesPackageManifest,
  cacheDirectory: string,
): Promise<unknown> => {
  const res = await fetch(manifest.dist.tarball, {
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`npm registry responded with status ${res.status}`)
  }

  const extractDirectory = join(cacheDirectory, `types-${manifest.version}`)
  const tarballFile = join(extractDirectory, 'types.tgz')
  await rm(extractDirectory, { recursive: true, force: true })
  await mkdir(extractDirectory, { recursive: true })
  try {
    await writeFile(tarballFile, Buffer.from(await res.arrayBuffer()))
    await extract({ file: tarballFile, cwd: extractDirectory }, [
      openapiTarEntryName,
    ])

    const moduleFile = join(extractDirectory, openapiTarEntryName)
    if (!(await exists(moduleFile))) {
      throw new Error(`Missing ${openapiTarEntryName} in package tarball`)
    }

    // The OpenAPI document is published as a JavaScript module, so import it.
    const openapiModuleUrl = pathToFileURL(moduleFile).href
    const { default: openapi } = (await import(openapiModuleUrl)) as {
      default: unknown
    }
    if (openapi == null) {
      throw new Error(`Missing default export in ${openapiTarEntryName}`)
    }
    return openapi
  } finally {
    await rm(extractDirectory, { recursive: true, force: true })
  }
}

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
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
  await mkdir(dirname(file), { recursive: true })
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
