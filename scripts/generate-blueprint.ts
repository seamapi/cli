#!/usr/bin/env tsx

import { mkdir, rename, writeFile } from 'node:fs/promises'

import { createBlueprint } from '@seamapi/blueprint'
import * as seamTypes from '@seamapi/types/connect'

const temporaryDirectory = new URL('../tmp/', import.meta.url)
const blueprintFile = new URL('blueprint.json', temporaryDirectory)
const temporaryFile = new URL('blueprint.json.tmp', temporaryDirectory)

const blueprint = await createBlueprint(seamTypes, {
  omitUndocumented: true,
})

await mkdir(temporaryDirectory, { recursive: true })
await writeFile(temporaryFile, `${JSON.stringify(blueprint)}\n`, 'utf8')
await rename(temporaryFile, blueprintFile)

console.log('Generated tmp/blueprint.json')
