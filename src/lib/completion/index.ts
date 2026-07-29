import type { Blueprint } from '@seamapi/blueprint'

import { type CommandSpec, getCommandSpec } from '../command-spec.js'
import { renderBashCompletion } from './render-bash.js'
import { renderFishCompletion } from './render-fish.js'
import { renderZshCompletion } from './render-zsh.js'

export const completionShells = ['bash', 'fish', 'zsh'] as const

export type CompletionShell = (typeof completionShells)[number]

export const isCompletionShell = (shell: unknown): shell is CompletionShell =>
  completionShells.includes(shell as CompletionShell)

/** File name to install the completion script for each shell as. */
export const completionFileNames: Record<CompletionShell, string> = {
  bash: 'seam.bash',
  fish: 'seam.fish',
  zsh: 'seam.zsh',
}

const renderers: Record<CompletionShell, (spec: CommandSpec) => string> = {
  bash: renderBashCompletion,
  fish: renderFishCompletion,
  zsh: renderZshCompletion,
}

export const renderCompletion = (
  shell: CompletionShell,
  blueprint: Blueprint,
): string => renderers[shell](getCommandSpec(blueprint))
