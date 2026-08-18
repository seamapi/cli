import type { ParsedArgs } from 'minimist'

import type { ApiBlueprint } from 'lib/blueprint/index.js'
import type { Command } from 'lib/commands/registry.js'
import type { CommandSpec } from 'lib/commands/spec.js'
import { detectShell } from 'lib/completion/detect-shell.js'
import {
  type CompletionTarget,
  installCompletion,
  type InstallOutcome,
  resolveCompletionTarget,
} from 'lib/completion/install.js'
import { UsageError } from 'lib/errors.js'
import { getOutput } from 'lib/output/get-output.js'
import {
  type CompletionShell,
  completionShells,
  isCompletionShell,
  renderCompletion,
  renderCompletionStub,
} from 'lib/render/completion/index.js'

export type CompletionAction = 'script' | 'install' | 'loader'

const completionActionFlags = ['install', 'loader'] as const

/**
 * Print the completion script for a shell.
 *
 * Completions always come from the cached API schema so that they can
 * be generated without logging in. They may lag the schema served by
 * Seam when config use-remote-schema is enabled.
 *
 * Called by the entry before any auth or blueprint context exists, and by
 * the registered command's executor — one implementation for both.
 */
export const printCompletion = (
  shell: CompletionShell,
  spec: CommandSpec,
): void => {
  getOutput().text(renderCompletion(shell, spec))
}

export const printCompletionLoader = (shell: CompletionShell): void => {
  getOutput().text(renderCompletionStub(shell))
}

export const installCompletionForShell = async (
  shell: CompletionShell,
): Promise<void> => {
  const output = getOutput()
  const target = resolveCompletionTarget(shell)
  const { outcome, notes, warnings } = await installCompletion(target)

  output.info(describeOutcome(outcome, target))
  for (const note of notes) output.info(note)
  for (const warning of warnings) output.warn(`\n${warning}`)
}

export const readCompletionAction = (args: ParsedArgs): CompletionAction => {
  const given = completionActionFlags.filter((flag) => args[flag] === true)

  if (given.length > 1) {
    throw new UsageError(
      `Only one of ${completionActionFlags
        .map((flag) => `--${flag}`)
        .join(', ')} may be given for seam completion.`,
      { hint: completionUsage },
    )
  }

  return given[0] ?? 'script'
}

export const resolveCompletionShell = (
  shellArg: string | undefined,
  action: CompletionAction,
): CompletionShell => {
  if (shellArg != null) {
    if (isCompletionShell(shellArg)) return shellArg

    throw new UsageError(`Unknown shell for seam completion: ${shellArg}`, {
      hint: completionUsage,
    })
  }

  if (action === 'script' || action === 'loader') {
    throw new UsageError(
      'Missing required argument for seam completion: <shell>',
      { hint: completionUsage },
    )
  }

  const detected = detectShell()

  if (detected == null) {
    throw new UsageError(
      `Could not tell which shell you are in: it is none of ${listShells()}.`,
      {
        hint: `Name the shell instead, e.g., 'seam completion --${action} zsh'.`,
      },
    )
  }

  return detected
}

const completionUsage = [
  `Usage: seam completion <${completionShells.join('|')}>`,
  `       seam completion --install [${completionShells.join('|')}]`,
  `       seam completion --loader [${completionShells.join('|')}]`,
].join('\n')

const listShells = (): string =>
  `${completionShells.slice(0, -1).join(', ')}, or ${completionShells.at(-1) ?? ''}`

const describeOutcome = (
  outcome: InstallOutcome,
  { shell, file }: CompletionTarget,
): string => {
  if (outcome === 'present') {
    return `${file} already loads ${shell} completions for seam.`
  }
  if (outcome === 'written') {
    return `Installed ${shell} completions for seam to ${file}.`
  }
  return `Added ${shell} completions for seam to ${file}.`
}

type BuildSpec = (blueprint: ApiBlueprint) => CommandSpec

const completionCommand = (
  shell: CompletionShell,
  buildSpec: BuildSpec,
): Command => ({
  definition: {
    path: ['completion', shell],
    kind: 'cli',
    title: `Print the ${shell} completion script.`,
    description: '',
    flags: [
      {
        long: 'install',
        short: null,
        description: `Add what ${shell} needs to complete seam commands to its config, instead of printing the script.`,
        values: [],
        takesValue: false,
        isRequired: false,
      },
      {
        long: 'loader',
        short: null,
        description: `Print the loader --install writes, to install it into ${shell} by hand or from a package.`,
        values: [],
        takesValue: false,
        isRequired: false,
      },
    ],
  },
  requiresAuth: false,
  execute: async (invocation, ctx) => {
    const action = readCompletionAction(invocation.args)

    if (action === 'install') {
      await installCompletionForShell(shell)
    } else if (action === 'loader') {
      printCompletionLoader(shell)
    } else {
      printCompletion(shell, buildSpec(ctx.blueprint))
    }

    return { kind: 'done' }
  },
})

export const createCompletionCommands = (buildSpec: BuildSpec): Command[] => [
  completionCommand('bash', buildSpec),
  completionCommand('fish', buildSpec),
  completionCommand('zsh', buildSpec),
]
