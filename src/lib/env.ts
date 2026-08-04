/**
 * Credentials and the server may be given in the environment.
 *
 * Each variable overrides the corresponding stored value for as long as it
 * is set, so any of them may be used per command or per shell. Commands that
 * would store an overridden value fail instead: see {@link assertEnvVarUnset}.
 */

/** Overrides the token stored by `seam login`. */
export const tokenEnvVar = 'SEAM_CLI_TOKEN'

/** Overrides the workspace stored by `seam select workspace`. */
export const workspaceIdEnvVar = 'SEAM_CLI_WORKSPACE_ID'

/** Overrides the server stored by `seam select server`. */
export const endpointEnvVar = 'SEAM_CLI_ENDPOINT'

/** Every variable read here is declared on `ProcessEnv` in `env.d.ts`. */
type SeamCliEnvVar =
  typeof endpointEnvVar | typeof tokenEnvVar | typeof workspaceIdEnvVar

export const getTokenFromEnv = (): string | null => readEnvVar(tokenEnvVar)

export const getWorkspaceIdFromEnv = (): string | null =>
  readEnvVar(workspaceIdEnvVar)

export const getEndpointFromEnv = (): string | null =>
  readEnvVar(endpointEnvVar)

/** Reported without a stack trace: the environment is at fault, not the CLI. */
export class EnvVarOverrideError extends Error {
  override name = 'EnvVarOverrideError'
}

/**
 * Refuse to store a value the environment overrides.
 *
 * Storing it would have no effect while the variable is set, so a command
 * that appears to succeed would leave the CLI using something else.
 *
 * @param action What the command does, e.g., `log in`.
 */
export const assertEnvVarUnset = (
  envVar: string,
  envValue: string | null,
  action: string,
): void => {
  if (envValue == null) return

  throw new EnvVarOverrideError(
    `Cannot ${action} while ${envVar} is set: it overrides what would be stored. Unset ${envVar} to ${action}.`,
  )
}

/**
 * Whether the CLI runs inside a hosted web terminal, where it cannot open
 * anything in a browser of its own.
 */
export const isInsideWebBrowser = (): boolean =>
  process.env['INSIDE_WEB_BROWSER'] === '1'

const readEnvVar = (envVar: SeamCliEnvVar): string | null => {
  const value = process.env[envVar]

  if (value == null) return null

  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
