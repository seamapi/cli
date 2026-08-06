/**
 * Where Seam keeps this user's files.
 *
 * Every path is derived from one XDG-conforming root named `seam`, so that
 * everything Seam writes is found in one place per kind, e.g., on Linux:
 * `~/.config/seam`, `~/.cache/seam`, and `~/.local/state/seam`.
 *
 * The root is exported, not only the CLI's own files, because other Seam
 * tools keep their files beside these: the wizard writes `wizard.json` next
 * to the CLI's `cli.json` rather than opening a directory of its own.
 */

import { join } from 'node:path'

import envPaths from 'env-paths'

export const seamPaths = envPaths('seam', { suffix: '' })

/** The CLI's file within each directory, beside other tools' own files. */
const cliFileName = 'cli.json'

/**
 * Settings the user chose, e.g., the selected server: `~/.config/seam`.
 *
 * Hand editable and worth keeping, which is why auth state is written
 * elsewhere: see {@link getStateFilePath}.
 */
export const getConfigFilePath = (): string =>
  join(seamPaths.config, cliFileName)

/**
 * Auth state the CLI wrote for itself, e.g., the stored token and the
 * selected workspace: `~/.local/state/seam`.
 *
 * Separate from the settings file so that a config file may be shared or
 * checked over without carrying credentials with it.
 */
export const getStateFilePath = (): string => join(seamPaths.log, cliFileName)

/** Downloaded API definitions and other regenerable files: `~/.cache/seam`. */
export const getCacheDirectory = (): string => seamPaths.cache
