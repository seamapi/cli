# TypeScript Module Package Skeleton

[![npm](https://img.shields.io/npm/v/@seamapi/makenew-tsmodule.svg)](https://www.npmjs.com/package/@seamapi/makenew-tsmodule)
[![GitHub Actions](https://github.com/seamapi/makenew-tsmodule/actions/workflows/check.yml/badge.svg)](https://github.com/seamapi/makenew-tsmodule/actions/workflows/check.yml)

Package skeleton for a TypeScript module.

## Description

Bootstrap a new TypeScript module in five minutes or less.

### Features

- Strongly typed JavaScript with [TypeScript].
- Native [ECMAScript module] compatible with [Node.js].
- Package management with [npm].
- Publish as a package to [GitHub Packages] and [npm].
- Examples with configurable options and arguments powered by [yargs] with [landlubber].
- Linting with the [JavaScript neostandard Style] using [ESLint].
- [Prettier] code.
- Futuristic debuggable unit testing with [AVA].
- Robust static dependency analysis with [DPDM].
- Fully automated version management and package publishing with [semantic-release].
- Continuous testing and package publishing with [GitHub Actions].
- Consistent coding with [EditorConfig].
- Start coding instantly with [GitHub Codespaces].
- Get PR reviews directly from [code owners].
- Automatically close [stale] Issues and Pull Requests.
- Badges from [Shields.io].

[AVA]: https://github.com/avajs/ava
[code owners]: https://github.blog/2017-07-06-introducing-code-owners/
[DPDM]: https://github.com/acrazing/dpdm
[ECMAScript module]: https://nodejs.org/api/esm.html
[ESLint]: https://eslint.org/
[EditorConfig]: https://editorconfig.org/
[GitHub Actions]: https://github.com/features/actions
[GitHub Codespaces]: https://github.com/features/packages
[GitHub Packages]: https://github.com/features/packages
[JavaScript neostandard Style]: https://github.com/neostandard/neostandard
[Node.js]: https://nodejs.org/
[Prettier]: https://prettier.io/
[semantic-release]: https://semantic-release.gitbook.io/
[Shields.io]: https://shields.io/
[stale]: https://github.com/marketplace/stale
[TypeScript]: https://www.typescriptlang.org/
[landlubber]: https://github.com/razor-x/landlubber
[npm]: https://www.npmjs.com/
[yargs]: https://yargs.js.org/

### Bootstrapping a new project

1. Enable [trusted publishing for this npm package][npm trusted publishing].
2. [Trigger a makenew workflow from this repository][makenew workflow]. 🚀
   - Provide a value for each required input.
   - There are no defaults.
   - Example values are shown in parentheses.
3. When the workflow completes, clone your new repo and start coding!

[makenew workflow]: https://github.com/seamapi/makenew-tsmodule/actions/workflows/makenew.yml
[npm trusted publishing]: https://docs.npmjs.com/trusted-publishers#supported-cicd-providers

### Updating from this skeleton

If you want to pull in future updates from this skeleton,
you can fetch and merge in changes from this repository.

Add this as a new remote with

```
$ git remote add makenew git@github.com:seamapi/makenew-tsmodule.git
```

You can then fetch and merge changes with

```
$ git fetch --no-tags makenew
$ git merge makenew/main
```

## Installation

Add this as a dependency to your project using [npm] with

```
$ npm install @seamapi/makenew-tsmodule
```

[npm]: https://www.npmjs.com/

## Development and Testing

### Quickstart

```
$ git clone https://github.com/seamapi/makenew-tsmodule.git
$ cd makenew-tsmodule
$ nvm install
$ npm install
$ npm run test:watch
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
$ git clone git@github.com:seamapi/makenew-tsmodule.git
```

[source code]: https://github.com/seamapi/makenew-tsmodule

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
[version workflow_dispatch on GitHub Actions]: https://github.com/seamapi/makenew-tsmodule/actions?query=workflow%3Aversion

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
