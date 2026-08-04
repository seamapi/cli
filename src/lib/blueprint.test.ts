import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import type { Blueprint } from '@seamapi/blueprint'
import { openapi } from '@seamapi/types/connect'
import { create } from 'tar'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import getBlueprint from './blueprint.js'

const typesVersion = '1.985.0'
const manifestUrl = 'https://registry.npmjs.org/@seamapi/types/latest'
const tarballUrl = `https://registry.npmjs.org/@seamapi/types/-/types-${typesVersion}.tgz`
const openapiTarEntryName = 'package/lib/seam/connect/openapi.js'

let tarball: Buffer
let pinnedBlueprintVersion: string
let seedCacheState: {
  blueprintVersion: string
  typesVersion: string
  checkedAt: string
  blueprint: Blueprint
}
let cacheDirectory: string

const stubRegistry = (
  version: string = typesVersion,
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url === manifestUrl) {
      return new Response(
        JSON.stringify({ version, dist: { tarball: tarballUrl } }),
      )
    }
    if (url === tarballUrl) return new Response(new Uint8Array(tarball))
    throw new Error(`Unexpected fetch of ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const stubOfflineRegistry = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('fetch failed')
    }),
  )
}

const seedCache = async (
  overrides: Partial<typeof seedCacheState> = {},
): Promise<void> => {
  await mkdir(cacheDirectory, { recursive: true })
  await writeFile(
    join(cacheDirectory, 'blueprint.json'),
    JSON.stringify({ ...seedCacheState, ...overrides }),
    'utf8',
  )
}

const readCache = async (): Promise<typeof seedCacheState> =>
  JSON.parse(
    await readFile(join(cacheDirectory, 'blueprint.json'), 'utf8'),
  ) as typeof seedCacheState

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

beforeAll(async () => {
  const pkg = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { dependencies: Record<string, string> }
  pinnedBlueprintVersion = pkg.dependencies['@seamapi/blueprint'] ?? ''

  // Build a @seamapi/types package tarball from the locally installed
  // package so tests never use the network.
  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'seam-cli-types-'))
  try {
    const moduleFile = join(fixtureDirectory, openapiTarEntryName)
    await mkdir(dirname(moduleFile), { recursive: true })
    await writeFile(moduleFile, `export default ${JSON.stringify(openapi)}\n`)

    const tarballFile = join(fixtureDirectory, 'types.tgz')
    await create({ gzip: true, file: tarballFile, cwd: fixtureDirectory }, [
      'package',
    ])
    tarball = await readFile(tarballFile)
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true })
  }

  // Generate a blueprint once to seed caches in individual tests.
  const seedDirectory = await mkdtemp(join(tmpdir(), 'seam-cli-seed-'))
  try {
    stubRegistry()
    await getBlueprint({ cacheDirectory: seedDirectory })
    seedCacheState = JSON.parse(
      await readFile(join(seedDirectory, 'blueprint.json'), 'utf8'),
    ) as typeof seedCacheState
  } finally {
    vi.unstubAllGlobals()
    await rm(seedDirectory, { recursive: true, force: true })
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  cacheDirectory = await mkdtemp(join(tmpdir(), 'seam-cli-cache-'))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(cacheDirectory, { recursive: true, force: true })
})

describe('getBlueprint', () => {
  it('downloads and caches the blueprint on the first run', async () => {
    const fetchMock = stubRegistry()

    const blueprint = await getBlueprint({ cacheDirectory })

    expect(blueprint.routes.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const cache = await readCache()
    expect(cache.blueprintVersion).toBe(pinnedBlueprintVersion)
    expect(cache.typesVersion).toBe(typesVersion)
    expect(Date.parse(cache.checkedAt)).not.toBeNaN()
  })

  it('uses the cached blueprint without checking for updates', async () => {
    await seedCache()
    const fetchMock = stubRegistry()

    const blueprint = await getBlueprint({ cacheDirectory })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(blueprint).toEqual(seedCacheState.blueprint)
  })

  it('checks for updates after the update check interval without downloading when unchanged', async () => {
    await seedCache({ checkedAt: hoursAgo(25) })
    const fetchMock = stubRegistry()

    const blueprint = await getBlueprint({ cacheDirectory })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(blueprint).toEqual(seedCacheState.blueprint)
    const cache = await readCache()
    expect(Date.parse(cache.checkedAt)).toBeGreaterThan(Date.now() - 60_000)
  })

  it('regenerates the blueprint when a new types version is published', async () => {
    await seedCache({ checkedAt: hoursAgo(25), typesVersion: '0.1.0' })
    const fetchMock = stubRegistry()

    const blueprint = await getBlueprint({ cacheDirectory })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(blueprint.routes.length).toBeGreaterThan(0)
    const cache = await readCache()
    expect(cache.typesVersion).toBe(typesVersion)
  })

  it('regenerates the blueprint when the blueprint version changes', async () => {
    await seedCache({ blueprintVersion: '0.0.1-other' })
    const fetchMock = stubRegistry()

    await getBlueprint({ cacheDirectory })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const cache = await readCache()
    expect(cache.blueprintVersion).toBe(pinnedBlueprintVersion)
  })

  it('forces an update with the update option', async () => {
    await seedCache()
    const fetchMock = stubRegistry()

    await getBlueprint({ cacheDirectory, update: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to the cached blueprint when the registry is unreachable', async () => {
    await seedCache({ checkedAt: hoursAgo(25) })
    stubOfflineRegistry()

    const blueprint = await getBlueprint({ cacheDirectory })

    expect(blueprint).toEqual(seedCacheState.blueprint)
  })

  it('throws when the registry is unreachable and nothing is cached', async () => {
    stubOfflineRegistry()

    await expect(getBlueprint({ cacheDirectory })).rejects.toThrow(
      /could not check for seam api definition updates/i,
    )
  })

  it('throws when an update is forced and the registry is unreachable', async () => {
    await seedCache()
    stubOfflineRegistry()

    await expect(
      getBlueprint({ cacheDirectory, update: true }),
    ).rejects.toThrow(/could not check for seam api definition updates/i)
  })
})
