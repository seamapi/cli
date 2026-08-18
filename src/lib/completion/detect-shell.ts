import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import {
  type CompletionShell,
  isCompletionShell,
} from 'lib/render/completion/index.js'

export interface DetectShellOptions {
  env?: NodeJS.ProcessEnv
  ancestors?: () => string[]
}

export const detectShell = ({
  env = process.env,
  ancestors = processAncestors,
}: DetectShellOptions = {}): CompletionShell | null => {
  for (const command of ancestors()) {
    const name = toShellName(command)
    if (isCompletionShell(name)) return name
  }

  const name = toShellName(env['SHELL'] ?? '')

  return isCompletionShell(name) ? name : null
}

const toShellName = (command: string): string =>
  basename(command.trim()).replace(/^-/, '')

const maxAncestors = 10

const processAncestors = (): string[] => {
  const commands: string[] = []

  let pid = process.ppid
  for (let depth = 0; depth < maxAncestors && pid > 1; depth += 1) {
    const parent = readProcess(pid)
    if (parent == null) break
    commands.push(parent.command)
    pid = parent.ppid
  }

  return commands
}

interface ProcessInfo {
  command: string
  ppid: number
}

const readProcess = (pid: number): ProcessInfo | null =>
  readFromProcfs(pid) ?? readFromPs(pid)

const readFromProcfs = (pid: number): ProcessInfo | null => {
  try {
    const command = readFileSync(`/proc/${pid}/comm`, 'utf8').trim()
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const afterCommand = stat.slice(stat.lastIndexOf(')') + 1).trim()
    const ppid = Number(afterCommand.split(/\s+/)[1])

    return command !== '' && Number.isInteger(ppid) ? { command, ppid } : null
  } catch {
    return null
  }
}

const readFromPs = (pid: number): ProcessInfo | null => {
  try {
    const fields = execFileSync(
      'ps',
      ['-p', String(pid), '-o', 'comm=,ppid='],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
      .trim()
      .split(/\s+/)
    const ppid = Number(fields.pop())
    const command = fields.join(' ')

    return command !== '' && Number.isInteger(ppid) ? { command, ppid } : null
  } catch {
    return null
  }
}
