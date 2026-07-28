import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

const versionFile = './src/lib/version.ts'
const blueprintFile = './src/lib/blueprint.ts'
const generatedBlueprintFile = './tmp/blueprint.json'

const main = async (): Promise<void> => {
  const version = await injectVersion(resolveFile(versionFile))
  // eslint-disable-next-line no-console
  console.log(`✓ Version ${version} injected into ${versionFile}`)

  await injectBlueprint(
    resolveFile(blueprintFile),
    resolveFile(generatedBlueprintFile),
  )
  // eslint-disable-next-line no-console
  console.log(`✓ Blueprint injected into ${blueprintFile}`)

  const { command } = await $`tsc --project tsconfig.prepack.json`
  // eslint-disable-next-line no-console
  console.log(`✓ Rebuilt with '${command}'`)
}

const injectVersion = async (path: string): Promise<string> => {
  const { version } = await readPackageJson()

  if (version == null) {
    throw new Error('Missing version in package.json')
  }

  await replaceInFile(
    path,
    "const seamapiCliVersion = '0.0.0'",
    `const seamapiCliVersion = '${version}'`,
  )

  return version
}

const injectBlueprint = async (
  path: string,
  generatedPath: string,
): Promise<void> => {
  const blueprint = JSON.parse(await readFile(generatedPath, 'utf8')) as unknown

  await replaceInFile(
    path,
    'const seamapiBlueprint: Blueprint | null = null',
    `const seamapiBlueprint: Blueprint | null = ${JSON.stringify(blueprint)} as unknown as Blueprint`,
  )
}

const replaceInFile = async (
  path: string,
  placeholder: string,
  replacement: string,
): Promise<void> => {
  const source = await readFile(path, 'utf8')

  if (!source.includes(placeholder)) {
    throw new Error(`Missing generated-value placeholder in ${path}`)
  }

  await writeFile(path, source.replace(placeholder, replacement), 'utf8')
}

const resolveFile = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url))

const readPackageJson = async (): Promise<{ version?: string }> =>
  JSON.parse(await readFile(resolveFile('package.json'), 'utf8')) as {
    version?: string
  }

await main()
