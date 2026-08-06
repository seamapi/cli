// This package is a command line program, not a library: none of its
// behavior is exported here. What is exported is the small contract other
// Seam tools need to sit beside the CLI without guessing at it — where the
// CLI keeps its files, the shape of the store it keeps them in, the keys it
// stores auth under, and the environment variables that override them.
//
// The Seam wizard (@seamapi/wizard) reads that contract: it keeps its own
// `wizard.json` next to the CLI's `cli.json`, and reads the CLI's store to
// reuse a login the developer already has.
//
// A tool that only needs the paths should depend on this package for its
// types and read the files itself, rather than importing the CLI at runtime.

export {
  type ConfigStore,
  currentWorkspaceIdKey,
  getTokenKey,
  isStateKey,
  patKey,
} from 'lib/config/index.js'
export { defaultServer } from 'lib/context.js'
export { endpointEnvVar, tokenEnvVar, workspaceIdEnvVar } from 'lib/env.js'
export {
  getCacheDirectory,
  getConfigFilePath,
  getStateFilePath,
  seamPaths,
} from 'lib/paths.js'

// Kept so that importing the package by name resolves to a module for
// consumers that depend on it only to get the bin.
export default null
