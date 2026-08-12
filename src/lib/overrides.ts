/**
 * The endpoint and workspace may be overridden for a single command.
 *
 * `--endpoint` and `--workspace-id` change what one invocation resolves to
 * and are never stored: only `seam select endpoint` and `seam select
 * workspace` write those settings. They are held here rather than threaded
 * through every call because auth resolves ambiently, exactly as the
 * environment variables they shadow do (see `env.ts`).
 *
 * Set once from the parsed arguments before anything resolves auth, and
 * reset between tests.
 */

export interface AuthOverrides {
  endpoint: string | null
  workspaceId: string | null
}

const noOverrides: AuthOverrides = { endpoint: null, workspaceId: null }

let overrides: AuthOverrides = noOverrides

export const getAuthOverrides = (): AuthOverrides => overrides

export const setAuthOverrides = (next: AuthOverrides): void => {
  overrides = next
}

/** Drop the overrides, e.g., between tests sharing a process. */
export const resetAuthOverrides = (): void => {
  overrides = noOverrides
}
