#!/usr/bin/env tsx

// Generates the blueprint.json that the published package ships, so that
// @seamapi/types is not needed at runtime. Idempotent: regenerates only when
// the packages the blueprint is derived from have changed.

import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBlueprint } from '@seamapi/blueprint'
import * as seamTypes from '@seamapi/types/connect'

import { type BlueprintFile, blueprintFileName } from 'lib/blueprint-file.js'

// The blueprint is a pure function of these packages.
const sourcePackages = ['@seamapi/types/connect', '@seamapi/blueprint']

const packageRoot = new URL('../', import.meta.url)

const readPackageVersion = async (specifier: string): Promise<string> => {
  let directory = dirname(fileURLToPath(import.meta.resolve(specifier)))

  for (;;) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      ) as { name?: string; version?: string }
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

const getGeneratedFrom = async (): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    sourcePackages.map(async (specifier) => {
      const name = specifier.split('/').slice(0, 2).join('/')
      return [name, await readPackageVersion(specifier)] as const
    }),
  )

  return Object.fromEntries(entries)
}

const readExisting = async (url: URL): Promise<BlueprintFile | null> => {
  try {
    return JSON.parse(await readFile(url, 'utf8')) as BlueprintFile
  } catch {
    return null
  }
}

const isUpToDate = (
  existing: BlueprintFile | null,
  generatedFrom: Record<string, string>,
): boolean => {
  if (existing?.blueprint == null) return false

  const previous = existing.generatedFrom ?? {}
  const names = Object.keys(generatedFrom)

  return (
    names.length === Object.keys(previous).length &&
    names.every((name) => previous[name] === generatedFrom[name])
  )
}

const file = new URL(blueprintFileName, packageRoot)
const generatedFrom = await getGeneratedFrom()
const describe = Object.entries(generatedFrom)
  .map(([name, version]) => `${name}@${version}`)
  .join(', ')

if (isUpToDate(await readExisting(file), generatedFrom)) {
  console.log(`${blueprintFileName} is up to date with ${describe}`)
} else {
  const blueprint = await createBlueprint(seamTypes, { omitUndocumented: true })
  const contents: BlueprintFile = { generatedFrom, blueprint }

  // Write and rename so a partial file is never left behind on failure.
  const temporaryFile = new URL(`${blueprintFileName}.tmp`, packageRoot)
  await writeFile(temporaryFile, `${JSON.stringify(contents)}\n`, 'utf8')
  await rename(temporaryFile, file)

  console.log(`Generated ${blueprintFileName} from ${describe}`)
}
