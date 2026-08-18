import { expect, test } from 'vitest'

import { detectShell } from 'lib/completion/detect-shell.js'

const noAncestors = () => []

test('detectShell: reads the shell that ran the CLI', () => {
  expect(detectShell({ ancestors: () => ['/usr/bin/fish'], env: {} })).toBe(
    'fish',
  )
  expect(detectShell({ ancestors: () => ['zsh'], env: {} })).toBe('zsh')
  expect(detectShell({ ancestors: () => ['-bash'], env: {} })).toBe('bash')
})

test('detectShell: looks past whatever the shell ran to reach the CLI', () => {
  expect(
    detectShell({
      ancestors: () => ['node', 'sh', 'npm', '/usr/bin/fish'],
      env: {},
    }),
  ).toBe('fish')
})

test('detectShell: prefers the shell running it to the login shell', () => {
  expect(
    detectShell({
      ancestors: () => ['/usr/bin/fish'],
      env: { SHELL: '/bin/bash' },
    }),
  ).toBe('fish')
})

test('detectShell: falls back to SHELL when no ancestor is a shell', () => {
  expect(
    detectShell({ ancestors: noAncestors, env: { SHELL: '/bin/zsh' } }),
  ).toBe('zsh')
  expect(
    detectShell({ ancestors: () => ['node', 'tmux'], env: { SHELL: '-zsh' } }),
  ).toBe('zsh')
})

test('detectShell: gives up on a shell completions cannot be installed into', () => {
  expect(
    detectShell({ ancestors: noAncestors, env: { SHELL: '/bin/sh' } }),
  ).toBe(null)
  expect(detectShell({ ancestors: noAncestors, env: { SHELL: '' } })).toBe(null)
  expect(detectShell({ ancestors: noAncestors, env: {} })).toBe(null)
})
