import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  type CompletionShell,
  renderCompletionEval,
  renderCompletionStub,
} from 'lib/render/completion/index.js'

export type CompletionFileKind = 'config' | 'completion'

export interface CompletionTarget {
  shell: CompletionShell
  file: string
  kind: CompletionFileKind
}

export interface ResolveCompletionTargetOptions {
  env?: NodeJS.ProcessEnv
  home?: string
}

export const resolveCompletionTarget = (
  shell: CompletionShell,
  { env = process.env, home = homedir() }: ResolveCompletionTargetOptions = {},
): CompletionTarget => {
  if (shell === 'fish') {
    const configHome = readPath(env['XDG_CONFIG_HOME']) ?? join(home, '.config')
    return {
      shell,
      file: join(configHome, 'fish', 'completions', 'seam.fish'),
      kind: 'completion',
    }
  }

  if (shell === 'zsh') {
    const dotDirectory = readPath(env['ZDOTDIR']) ?? home
    return { shell, file: join(dotDirectory, '.zshrc'), kind: 'config' }
  }

  return { shell, file: bashConfig(home), kind: 'config' }
}

const bashConfig = (home: string): string => {
  const bashrc = join(home, '.bashrc')
  const bashProfile = join(home, '.bash_profile')

  if (existsSync(bashrc)) return bashrc
  if (existsSync(bashProfile)) return bashProfile

  return bashrc
}

export type InstallOutcome = 'added' | 'present' | 'written'

export interface InstallResult {
  outcome: InstallOutcome
  notes: string[]
  warnings: string[]
}

export const installCompletion = async (
  target: CompletionTarget,
): Promise<InstallResult> => {
  await mkdir(dirname(target.file), { recursive: true })

  if (target.kind === 'completion') {
    await writeFile(target.file, renderCompletionStub(target.shell), 'utf8')
    return { outcome: 'written', ...adviceFor(target, null) }
  }

  const line = renderCompletionEval(target.shell)
  const config = await readFileOrNull(target.file)

  if (config != null && config.includes(line)) {
    return { outcome: 'present', ...adviceFor(target, config) }
  }

  await appendFile(target.file, `${separatorFor(config)}${line}\n`, 'utf8')

  return { outcome: 'added', ...adviceFor(target, config) }
}

const separatorFor = (config: string | null): string => {
  if (config == null || config === '') return ''
  return config.endsWith('\n') ? '\n' : '\n\n'
}

const adviceFor = (
  { shell, file }: CompletionTarget,
  config: string | null,
): Pick<InstallResult, 'notes' | 'warnings'> => ({
  notes: [
    `Open a new shell to complete seam commands, or run 'exec ${shell}' now.`,
  ],
  warnings:
    shell === 'zsh' && config?.includes('compinit') !== true
      ? [
          [
            `Nothing in ${file} turns the zsh completion system on. If nothing`,
            'else does either, completions stay inert until you add this above',
            'the block just installed:',
            '',
            '  autoload -Uz compinit',
            '  compinit',
          ].join('\n'),
        ]
      : [],
})

const readFileOrNull = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) return null
    throw error
  }
}

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT'

const readPath = (value: string | undefined): string | null => {
  const trimmedValue = value?.trim()
  return trimmedValue == null || trimmedValue === '' ? null : trimmedValue
}
