import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@seamapi/cli': new URL('./src/index.ts', import.meta.url).pathname,
      lib: new URL('./src/lib', import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      exclude: [
        '**/index.ts',
        'src/bin/cli.ts',
        'package/**/*.ts',
        '**/*.test.ts',
      ],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // End to end tests spawn the CLI, which builds the API blueprint.
    testTimeout: 60_000,
  },
})
