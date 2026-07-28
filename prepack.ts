import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

const versionFile = './src/lib/version.ts'

const main = async (): Promise<void> => {
  const version = await injectVersion(
    fileURLToPath(new URL(versionFile, import.meta.url)),
  )
  // eslint-disable-next-line no-console
  console.log(`✓ Version ${version} injected into ${versionFile}`)

  const { command } = await $`tsc --project tsconfig.version.json`
  // eslint-disable-next-line no-console
  console.log(`✓ Rebuilt with '${command}'`)
}

const injectVersion = async (path: string): Promise<string> => {
  const { version } = await readPackageJson()

  if (version == null) {
    throw new Error('Missing version in package.json')
  }

  const buff = await readFile(path)

  const data = buff
    .toString()
    .replace(
      "const seamapiCliVersion = '0.0.0'",
      `const seamapiCliVersion = '${version}'`,
    )

  await writeFile(path, data)

  return version
}

const readPackageJson = async (): Promise<{ version?: string }> => {
  const pkgBuff = await readFile(
    fileURLToPath(new URL('package.json', import.meta.url)),
  )
  return JSON.parse(pkgBuff.toString())
}

await main()
