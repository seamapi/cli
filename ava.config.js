export default () => {
  return {
    files: ['**/*.test.ts', '!package/**/*'],
    watchMode: {
      ignoreChanges: ['tmp/**/*'],
    },
    extensions: ['ts'],
    nodeArguments: ['--import=tsx'],
    // The tsx resolve hooks registered by --import are not picked up inside
    // ava's worker threads, which leaves the .js specifiers of nodenext
    // relative imports unresolved.
    workerThreads: false,
  }
}
