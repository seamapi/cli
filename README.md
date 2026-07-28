![seam-cli-chromatic-dark-blog-cover-repo](https://github.com/seamapi/seam-cli/assets/852751/e63bbaaa-d8a9-4417-ac69-d21b172e6de6)

# Seam CLI

[![npm](https://img.shields.io/npm/v/@seamapi/cli.svg)](https://www.npmjs.com/package/@seamapi/cli)
[![GitHub Actions](https://github.com/seamapi/cli/actions/workflows/check.yml/badge.svg)](https://github.com/seamapi/cli/actions/workflows/check.yml)

A command line interface (CLI) for interacting with the Seam API.

## Description

Every command is interactive: the CLI prompts for any missing required
parameter with suggestions pulled from your workspace. Pass `-y` to take the
first suggestion instead of being asked.

The command list is derived at runtime from the [Seam API blueprint], so the
CLI exposes every documented endpoint without needing a release of its own.

[Seam API blueprint]: https://github.com/seamapi/blueprint

## Installation

Install the CLI globally using [npm] with

```
$ npm install --global @seamapi/cli
```

On Arch Linux, install the [`seam-bin`][aur] package from the AUR with

```
$ paru -S seam-bin
```

[aur]: https://aur.archlinux.org/packages/seam-bin
[npm]: https://www.npmjs.com/

## Usage

Every `seam` command is interactive and will prompt you for any missing
required properties with helpful suggestions. To avoid automatic behavior,
pass `-y`

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

MY_DOOR=$(seam devices get --name "Front Door" --id-only)

# Unlock a lock
seam locks unlock-door --device-id $MY_DOOR

# Create an access code
seam access-codes create --code "1234" --name "My Code"

# List you access codes
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

Pass `--json` to read request params from stdin as JSON and write the response
to stdout as JSON.

```bash
# Read params from a file
seam locks unlock-door --json < params.json

# Or from another program
echo '{"device_id": "'"$MY_DOOR"'"}' | seam locks unlock-door --json

# Params given as flags win over params read from stdin
seam devices list --json --limit 5 < params.json
```

The JSON format is enabled automatically whenever stdout is not a terminal, so
piping and redirecting produce JSON without passing `--json`. Pass `--no-json`
to opt out and get the pretty format instead.

Reading params from stdin also implies `-y`: there is nobody to prompt, so the
CLI reports the missing required params rather than waiting for an answer.

An error exits non-zero. A request that fails reports its `error` on stdout,
so it can be inspected from a pipe; anything else is written to stderr only.

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
