![seam-cli-chromatic-dark-blog-cover-repo](https://github.com/seamapi/seam-cli/assets/852751/e63bbaaa-d8a9-4417-ac69-d21b172e6de6)

# Seam CLI

[![npm](https://img.shields.io/npm/v/@seamapi/cli.svg)](https://www.npmjs.com/package/@seamapi/cli)
[![GitHub Actions](https://github.com/seamapi/cli/actions/workflows/check.yml/badge.svg)](https://github.com/seamapi/cli/actions/workflows/check.yml)

A command-line interface (CLI) for interacting with the Seam API.

## Description

Commands run as soon as every required parameter is given. Anything missing is
prompted for, with suggestions pulled from your workspace. Pass
`--non-interactive` (or `-y`) to never be prompted: the command fails instead.

## Installation

Install the CLI globally using [npm] with

```
$ npm install --global @seamapi/cli
```

Alternatively, download a standalone binary for your platform from the
[latest GitHub release].

On Arch Linux, install the [`seam-bin`][aur] package from the AUR with

```
$ paru -S seam-bin
```

[aur]: https://aur.archlinux.org/packages/seam-bin
[latest GitHub release]: https://github.com/seamapi/cli/releases/latest
[npm]: https://www.npmjs.com/
[Seam Wizard]: https://github.com/seamapi/wizard

## Usage

Every `seam` command makes its request as soon as every required property is
given. When something is missing, the CLI prompts you for it with helpful
suggestions.

Pass `--interactive` (or `-i`) to always be prompted to review and edit
properties before the request is made. The prompt is prefilled with whatever
you passed as arguments, so this is the way to add optional properties, or to
check a request before making it.

For scripts and CI, pass `--non-interactive` (or `-y`) to never be prompted.
The command must then be complete: if the command itself is ambiguous, or any
required property is missing, the CLI exits with an error naming what is
missing instead of asking for it.

To take a project from zero to a working Seam integration, run the
[Seam Wizard] from the project's root:

```bash
seam wizard
```

For API commands:

```bash
# Login to Seam
seam login

# Select your workspace
seam select workspace

# Interactively select commands to execute
seam

# Create a connect webview to connect devices
seam connect-webviews create

# List devices in your workspace
seam devices list

# Review and edit filters before listing devices
seam devices list --interactive

# List devices, failing instead of prompting
seam devices list --non-interactive

# Fails with: Missing required parameter for /locks/unlock_door: --device-id
seam locks unlock-door --non-interactive

MY_DOOR=$(seam devices get --name "Front Door" --id-only)

# Unlock a lock
seam locks unlock-door --device-id $MY_DOOR

# Create an access code
seam access-codes create --code "1234" --name "My Code"

# List your access codes
seam access-codes list --device-id $MY_DOOR
```

### Output

Only the response is written to stdout, so any command may be piped or
redirected. Prompts, progress, and other information are written to stderr.

The response is trimmed to the response key and pagination: no other top level
fields are reported.

```bash
# The response, and nothing else, ends up in the file
seam devices list > devices.json

# Prompts and progress still show up in the terminal
seam devices list | jq '.devices[].device_id'
```

### JSON

Request params may be piped or redirected in as a JSON object. Params given as
arguments win over params read from stdin.

```bash
# Read params from a file
seam locks unlock-door < params.json

# Or from another program
echo '{"device_id": "'"$MY_DOOR"'"}' | seam locks unlock-door

# --device-id wins over any device_id in params.json
seam devices list --limit 5 < params.json
```

Pass `--json` to write the response as JSON. It is enabled automatically
whenever stdout is not a terminal, so piping and redirecting produce JSON
without passing anything. Pass `--no-json` to opt out and get the pretty
format instead.

```bash
# Both write JSON
seam devices list --json
seam devices list | jq

# Pretty printed, even though it is piped
seam devices list --no-json | less
```

Without a terminal to prompt on, the CLI behaves as though
`--non-interactive` was given: rather than waiting for an answer nobody can
give, it exits with an error naming what is missing.

```bash
$ echo '{}' | seam locks unlock-door
Missing required parameter for /locks/unlock_door: --device-id
```

An error exits non-zero. A request that fails reports its `error` on stdout,
so it can be inspected from a pipe; anything else is written to stderr only.

### Environment variables

Credentials may be given in the environment instead of being stored by
`seam login` and `seam select workspace`:

- `SEAM_CLI_TOKEN`: a Personal Access Token or API Key,
- `SEAM_CLI_WORKSPACE_ID`: the workspace requests are made against.

Either one, both, or neither may be set. Whatever is set wins over what is
stored, which makes them useful for CI, for a single command, or for working
against another workspace in one shell.

```bash
# One command against another workspace
SEAM_CLI_WORKSPACE_ID=$OTHER_WORKSPACE seam devices list

# No login needed: authenticate from the environment
export SEAM_CLI_TOKEN=$SEAM_API_KEY
seam devices list
```

An API Key is scoped to a single workspace, so it needs no workspace id. A
Personal Access Token works across workspaces, so it needs one from either
`SEAM_CLI_WORKSPACE_ID` or `seam select workspace`.

Commands that store credentials still store them while these are set, and
report that the environment overrides what was stored.

## Help

Pass `--help` to any command to see what it accepts. Without a command, it
lists every top level command; with an incomplete command, it lists the
subcommands under it; with a full command, it documents that command's
options, marking the required ones.

```bash
# Every top level command
seam --help

# The commands under seam devices
seam devices --help

# The options accepted by seam devices list
seam devices list --help
```

## Shell completion

The CLI can print a completion script for bash, fish, and zsh that completes
commands, flags, and flag values such as device types.

Load completions into the current shell with

```bash
# bash
source <(seam completion bash)

# zsh
source <(seam completion zsh)
```

Install them for every shell with

```bash
# bash
seam completion bash > /usr/share/bash-completion/completions/seam

# fish
seam completion fish > ~/.config/fish/completions/seam.fish

# zsh
seam completion zsh > "${fpath[1]}/_seam"
```

System packages install completion loaders instead: small scripts packaged
under `completions/` in the published package, and released as
`seam-completions-v<version>.tar.gz` on each [GitHub release]. A loader runs
`seam completion` the first time the shell completes a seam command, so
installed completions always match the CLI's current Seam API definitions and
never go stale between package updates. The `seam-bin` AUR package installs
the loaders for all three shells.

Completions are generated from the cached Seam API definitions, so they may
briefly lag a newly released API. Pass `--update` to refresh the cache first,
e.g., `seam completion bash --update`. They do not reflect definitions served
by another Seam API server when `seam config use-remote-api-defs` is enabled.

If completions do not appear after installing them system wide:

- Bash reads them via the [bash-completion] package,
  so it must be installed and sourced by the shell.
- Zsh caches the completion functions it found at startup: after installing,
  rebuild the cache with `rm -f ~/.zcompdump*` and start a new shell.
  This applies to frameworks that call `compinit -C`, e.g., oh-my-zsh.
- Fish needs nothing extra: completions load on demand in new sessions.

[bash-completion]: https://github.com/scop/bash-completion
[GitHub release]: https://github.com/seamapi/cli/releases/latest

## Development and Testing

### Quickstart

```
$ git clone https://github.com/seamapi/cli.git
$ cd cli
$ nvm install
$ npm install
$ npm run test:watch
```

Run the CLI from source with

```
$ npm run seam -- devices list
```

Primary development tasks are defined under `scripts` in `package.json`
and available via `npm run`.
View them with

```
$ npm run
```

### Source code

The [source code] is hosted on GitHub.
Clone the project with

```
$ git clone git@github.com:seamapi/cli.git
```

[source code]: https://github.com/seamapi/cli

### Requirements

You will need [Node.js] with [npm] and a [Node.js debugging] client.

Be sure that all commands run under the correct Node version, e.g.,
if using [nvm], install the correct version with

```
$ nvm install
```

Set the active version for each shell session with

```
$ nvm use
```

Install the development dependencies with

```
$ npm install
```

[Node.js]: https://nodejs.org/
[Node.js debugging]: https://nodejs.org/en/docs/guides/debugging-getting-started/
[npm]: https://www.npmjs.com/
[nvm]: https://github.com/creationix/nvm

### Publishing

#### Automatic

New versions are released automatically with [semantic-release]
as long as commits follow the [Angular Commit Message Conventions].

[Angular Commit Message Conventions]: https://semantic-release.gitbook.io/semantic-release/#commit-message-format
[semantic-release]: https://semantic-release.gitbook.io/

#### Manual

Publish a new version by triggering a [version workflow_dispatch on GitHub Actions].
The `version` input will be passed as the first argument to [npm-version].

This may be done on the web or using the [GitHub CLI] with

```
$ gh workflow run version.yml --raw-field version=<version>
```

[GitHub CLI]: https://cli.github.com/
[npm-version]: https://docs.npmjs.com/cli/version
[version workflow_dispatch on GitHub Actions]: https://github.com/seamapi/cli/actions?query=workflow%3Aversion

## GitHub Actions

_GitHub Actions should already be configured: this section is for reference only._

The following repository secrets must be set on [GitHub Actions]:

- `GH_TOKEN`: A personal access token for the bot user with
  `packages:write` and `contents:write` permission.
- `GIT_USER_NAME`: The GitHub bot user's real name.
- `GIT_USER_EMAIL`: The GitHub bot user's email.
- `GPG_PRIVATE_KEY`: The GitHub bot user's [GPG private key].
- `GPG_PASSPHRASE`: The GitHub bot user's GPG passphrase.

[GitHub Actions]: https://github.com/features/actions
[GPG private key]: https://github.com/marketplace/actions/import-gpg#prerequisites

## Contributing

> If using squash merge, edit and ensure the commit message follows the [Angular Commit Message Conventions] specification.
> Otherwise, each individual commit must follow the [Angular Commit Message Conventions] specification.

1. Create your feature branch (`git checkout -b my-new-feature`).
2. Make changes.
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin my-new-feature`).
5. Create a new draft pull request.
6. Ensure all checks pass.
7. Mark your pull request ready for review.
8. Wait for the required approval from the code owners.
9. Merge when ready.

[Angular Commit Message Conventions]: https://semantic-release.gitbook.io/semantic-release/#commit-message-format

## License

This npm package is licensed under the MIT license.

## Warranty

This software is provided by the copyright holders and contributors "as is" and
any express or implied warranties, including, but not limited to, the implied
warranties of merchantability and fitness for a particular purpose are
disclaimed. In no event shall the copyright holder or contributors be liable for
any direct, indirect, incidental, special, exemplary, or consequential damages
(including, but not limited to, procurement of substitute goods or services;
loss of use, data, or profits; or business interruption) however caused and on
any theory of liability, whether in contract, strict liability, or tort
(including negligence or otherwise) arising in any way out of the use of this
software, even if advised of the possibility of such damage.
