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
    files,
    plugins: {
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    settings: {
      // no-cycle builds the import graph by parsing the imported files, and
      // its default parser cannot read TypeScript: without this setting it
      // sees no edges and silently reports nothing.
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      // Resolves the .js-suffixed TypeScript imports and the tsconfig path
      // aliases. Without a resolver, every import in this ESM TypeScript
      // codebase is unresolvable, which silently disables the import rules
      // that resolve before reporting, e.g., no-relative-parent-imports.
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
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
      // Not import/extensions: with the resolver active it resolves the
      // .js-suffixed import to the .ts file and demands a .ts extension.
      // TypeScript's nodenext resolution already fails the build on a
      // missing or wrong extension, so the rule adds nothing here.
      //
      // Not import/no-relative-parent-imports: with a resolver it bans
      // depending on anything in a parent directory however the import is
      // written, path aliases included. The core rule below bans the ../
      // spelling, which is the actual mistake.
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/no-cycle': [
        'error',
        {
          ignoreExternal: true,
          // A cycle broken by a deferred import() is intentional, e.g., the
          // command registry lists the completion command while the
          // completion command builds a spec from the registry.
          allowUnsafeDynamicCyclicDependency: true,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['..', '../**'],
              message:
                'Import by path alias instead, e.g., lib/foo/bar.js or test/fixtures/blueprint.js.',
            },
          ],
        },
      ],
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
            ['^lib/', '^test/'],
            ['^'],
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
]
