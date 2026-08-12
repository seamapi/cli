import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Blueprint, TypesModuleInput } from '@seamapi/blueprint'
import { extract } from 'tar'

import { rootPaths } from 'lib/config/index.js'
import { withLoading } from 'lib/output/with-loading.js'

import {
  getBlueprintVersion,
  getCacheFile,
  isUpdateCheckDue,
  readCache,
  writeCache,
} from './cache.js'

const typesPackageName = '@seamapi/types'
const openapiTarEntryName = 'package/lib/seam/connect/openapi.js'
const registryUrl = 'https://registry.npmjs.org'

interface TypesPackageManifest {
  version: string
  dist: { tarball: string }
}

export interface GetBlueprintOptions {
  update?: boolean
  cacheDirectory?: string
}

/**
 * Build a blueprint from the latest published Seam API types on npm,
 * using the on-disk cache unless it is stale or an update is forced.
 */
export const getBlueprint = async (
  options: GetBlueprintOptions = {},
): Promise<Blueprint> => {
  const update = options.update ?? false
  const cacheDirectory = options.cacheDirectory ?? rootPaths.cache
  const cacheFile = getCacheFile(cacheDirectory)
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

const fetchLatestTypesPackageManifest =
  async (): Promise<TypesPackageManifest> => {
    const res = await fetch(`${registryUrl}/${typesPackageName}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      throw new Error(`npm registry responded with status ${res.status}`)
    }
    const body = await res.json()
    const manifest = body as Partial<TypesPackageManifest>
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
    const tarball = await res.arrayBuffer()
    await writeFile(tarballFile, Buffer.from(tarball))
    await extract({ file: tarballFile, cwd: extractDirectory }, [
      openapiTarEntryName,
    ])

    const moduleFile = join(extractDirectory, openapiTarEntryName)
    const moduleFileExists = await exists(moduleFile)
    if (!moduleFileExists) {
      throw new Error(`Missing ${openapiTarEntryName} in package tarball`)
    }

    // The OpenAPI document is published as a JavaScript module, so import it.
    const openapiModuleUrl = pathToFileURL(moduleFile).href
    const openapiModule = (await import(openapiModuleUrl)) as {
      default: unknown
    }
    const { default: openapi } = openapiModule
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

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
