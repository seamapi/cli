import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

const versionFile = './src/lib/version.ts'

const main = async (): Promise<void> => {
  const version = await injectVersion(resolveFile(versionFile))
  // eslint-disable-next-line no-console
  console.log(`✓ Version ${version} injected into ${versionFile}`)

  const blueprintVersion = await injectBlueprintVersion(
    resolveFile(versionFile),
  )
  // eslint-disable-next-line no-console
  console.log(
    `✓ Blueprint version ${blueprintVersion} injected into ${versionFile}`,
  )

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

const injectBlueprintVersion = async (path: string): Promise<string> => {
  const { dependencies } = await readPackageJson()
  const version = dependencies?.['@seamapi/blueprint']

  if (version == null) {
    throw new Error('Missing @seamapi/blueprint in package.json dependencies')
  }

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `The @seamapi/blueprint dependency must be pinned to an exact version in package.json, got '${version}'`,
    )
  }

  await replaceInFile(
    path,
    "const seamapiBlueprintVersion = '0.0.0'",
    `const seamapiBlueprintVersion = '${version}'`,
  )

  return version
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

const readPackageJson = async (): Promise<{
  version?: string
  dependencies?: Record<string, string>
}> =>
  JSON.parse(await readFile(resolveFile('package.json'), 'utf8')) as {
    version?: string
    dependencies?: Record<string, string>
  }

await main()
