import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, expect, test } from 'vitest'

import {
  installCompletion,
  resolveCompletionTarget,
} from 'lib/completion/install.js'
import {
  renderCompletionEval,
  renderCompletionStub,
} from 'lib/render/completion/index.js'

let home: string

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'seam-cli-completion-'))
})

test('resolveCompletionTarget: zsh reads its config from ZDOTDIR', () => {
  expect(resolveCompletionTarget('zsh', { env: {}, home })).toEqual({
    shell: 'zsh',
    file: join(home, '.zshrc'),
    kind: 'config',
  })
  expect(
    resolveCompletionTarget('zsh', { env: { ZDOTDIR: '/dotfiles' }, home }),
  ).toEqual({
    shell: 'zsh',
    file: join('/dotfiles', '.zshrc'),
    kind: 'config',
  })
})

test('resolveCompletionTarget: fish owns a completion file of its own', () => {
  expect(resolveCompletionTarget('fish', { env: {}, home })).toEqual({
    shell: 'fish',
    file: join(home, '.config', 'fish', 'completions', 'seam.fish'),
    kind: 'completion',
  })
  expect(
    resolveCompletionTarget('fish', {
      env: { XDG_CONFIG_HOME: '/xdg' },
      home,
    }),
  ).toEqual({
    shell: 'fish',
    file: join('/xdg', 'fish', 'completions', 'seam.fish'),
    kind: 'completion',
  })
})

test('resolveCompletionTarget: bash takes the config it finds', async () => {
  expect(resolveCompletionTarget('bash', { env: {}, home }).file).toBe(
    join(home, '.bashrc'),
  )

  await writeFile(join(home, '.bash_profile'), '', 'utf8')
  expect(resolveCompletionTarget('bash', { env: {}, home }).file).toBe(
    join(home, '.bash_profile'),
  )

  await writeFile(join(home, '.bashrc'), '', 'utf8')
  expect(resolveCompletionTarget('bash', { env: {}, home }).file).toBe(
    join(home, '.bashrc'),
  )
})

test('installCompletion: keeps what the config already holds', async () => {
  const file = join(home, '.zshrc')
  await writeFile(file, 'export EDITOR=vim', 'utf8')

  const result = await installCompletion({ shell: 'zsh', file, kind: 'config' })

  expect(result.outcome).toBe('added')
  const config = await readFile(file, 'utf8')
  expect(config.startsWith('export EDITOR=vim\n\n')).toBe(true)
  expect(config).toContain(renderCompletionEval('zsh'))
})

test('installCompletion: writes a config that does not exist yet', async () => {
  const file = join(home, 'nested', '.bashrc')

  const result = await installCompletion({
    shell: 'bash',
    file,
    kind: 'config',
  })

  expect(result.outcome).toBe('added')
  expect(await readFile(file, 'utf8')).toContain(renderCompletionEval('bash'))
})

test('installCompletion: installs the same snippet only once', async () => {
  const file = join(home, '.zshrc')
  const target = { shell: 'zsh', file, kind: 'config' } as const

  await installCompletion(target)
  const installed = await readFile(file, 'utf8')

  const result = await installCompletion(target)

  expect(result.outcome).toBe('present')
  expect(await readFile(file, 'utf8')).toBe(installed)
})

test('installCompletion: writes a completion file whole', async () => {
  const file = join(home, '.config', 'fish', 'completions', 'seam.fish')

  const result = await installCompletion({
    shell: 'fish',
    file,
    kind: 'completion',
  })

  expect(result.outcome).toBe('written')
  expect(await readFile(file, 'utf8')).toBe(renderCompletionStub('fish'))

  await installCompletion({ shell: 'fish', file, kind: 'completion' })
  expect(await readFile(file, 'utf8')).toBe(renderCompletionStub('fish'))
})

test('installCompletion: warns when nothing turns the zsh completion system on', async () => {
  const file = join(home, '.zshrc')

  const missing = await installCompletion({
    shell: 'zsh',
    file,
    kind: 'config',
  })
  expect(missing.outcome).toBe('added')
  expect(missing.warnings.join('\n')).toContain('autoload -Uz compinit')

  await mkdir(join(home, 'other'), { recursive: true })
  const initialized = join(home, 'other', '.zshrc')
  await writeFile(initialized, 'autoload -Uz compinit\ncompinit\n', 'utf8')

  const found = await installCompletion({
    shell: 'zsh',
    file: initialized,
    kind: 'config',
  })
  expect(found.warnings).toEqual([])
})

test('installCompletion: says nothing about compinit to another shell', async () => {
  const result = await installCompletion({
    shell: 'bash',
    file: join(home, '.bashrc'),
    kind: 'config',
  })

  expect(result.warnings).toEqual([])
  expect(result.notes.join('\n')).toContain('exec bash')
})
