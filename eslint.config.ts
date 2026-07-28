import { globalIgnores } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unusedImports from 'eslint-plugin-unused-imports'
import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

const files = ['**/*.{ts,tsx}']

export default [
  globalIgnores(resolveIgnoresFromGitignore()),
  ...neostandard({ ts: true, noStyle: true }),
  {
    files,
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // The CLI writes its output to the console: that is the product.
    // Its identifiers mirror the snake_case parameter names of the Seam API.
    files: ['src/cli.ts', 'src/lib/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      camelcase: 'off',
      'no-console': 'off',
    },
  },
  {
    files,
    plugins: {
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      'import/extensions': ['error', 'ignorePackages'],
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/no-relative-parent-imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files,
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^node:'],
            ['^@?\\w'],
            ['@seamapi/cli'],
            ['^lib/'],
            ['^'],
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
]
