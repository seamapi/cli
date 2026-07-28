import type { Blueprint } from '@seamapi/blueprint'

// Replaced with the generated blueprint when the package is packed.
const seamapiBlueprint: Blueprint | null = null

interface GetBlueprintOptions {
  regenerate?: boolean
}

const getBlueprint = async (
  options: GetBlueprintOptions = {},
): Promise<Blueprint> => {
  if (seamapiBlueprint != null) return seamapiBlueprint

  const blueprintFile = new URL('../../tmp/blueprint.json', import.meta.url)

  if (options.regenerate !== true) {
    const existing = await readBlueprint(blueprintFile)
    if (existing != null) return existing
  }

  // This branch only runs in a development checkout. Published packages have
  // seamapiBlueprint injected above and never load @seamapi/types.
  const [{ createBlueprint }, { openapi }] = await Promise.all([
    import('@seamapi/blueprint'),
    import('@seamapi/types/connect'),
  ])
  const blueprint = await createBlueprint(
    { openapi },
    { omitUndocumented: true },
  )

  const { mkdir, rename, writeFile } = await import('node:fs/promises')
  const temporaryDirectory = new URL('./', blueprintFile)
  const temporaryFile = new URL('blueprint.json.tmp', temporaryDirectory)

  await mkdir(temporaryDirectory, { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(blueprint)}\n`, 'utf8')
  await rename(temporaryFile, blueprintFile)

  return blueprint
}

const readBlueprint = async (file: URL): Promise<Blueprint | null> => {
  try {
    const { readFile } = await import('node:fs/promises')
    return JSON.parse(await readFile(file, 'utf8')) as Blueprint
  } catch {
    return null
  }
}

export default getBlueprint
