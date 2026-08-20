#!/bin/sh
# Seam CLI installer.
#
# Downloads the standalone seam binary for this platform from GitHub Releases,
# verifies its SHA-256 checksum against the release's checksums.txt in a
# temporary directory, installs it, adds the install directory to PATH in the
# shell configuration when needed, and installs shell completions.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/seamapi/cli/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/seamapi/cli/main/install.sh \
#     | sh -s -- --version v0.29.0 --no-install-completion
#
# Options:
#   --version <tag>          Version to install, e.g. v0.29.0 (default: latest).
#   --bin-path <dir>         Install directory (default: SEAM_BIN_PATH, then
#                            XDG_BIN_HOME, then XDG_DATA_HOME/../bin, then
#                            ~/.local/bin).
#   --no-install-completion  Do not run `seam completion --install`.
#   --no-modify-path         Do not add the install directory to PATH in the
#                            shell configuration.
#   -h, --help               Show this help.
#
# Environment:
#   SEAM_BIN_PATH        Install directory (same as --bin-path).
#   SEAM_NO_COMPLETIONS  Set to 1 to skip completions (same as
#                        --no-install-completion).
#   SEAM_NO_MODIFY_PATH  Set to 1 to never edit the shell configuration for
#                        PATH (same as --no-modify-path).
#   SEAM_DOWNLOAD_URL    Base URL for release downloads, for mirrors and
#                        testing (default:
#                        https://github.com/seamapi/cli/releases/download).
#
# On Windows, use install.ps1 instead:
#   iwr -useb https://raw.githubusercontent.com/seamapi/cli/main/install.ps1 | iex

set -u

APP_NAME='seam'
REPO='seamapi/cli'
DOWNLOAD_BASE="${SEAM_DOWNLOAD_URL:-https://github.com/${REPO}/releases/download}"
LATEST_RELEASE_URL="https://github.com/${REPO}/releases/latest"

usage() {
  cat <<EOF
Install the Seam CLI.

Usage: install.sh [OPTIONS] [TAG]

Options:
  --version <tag>          Version to install, e.g. v0.29.0 (default: latest).
  --bin-path <dir>         Install directory (default: SEAM_BIN_PATH, then
                           XDG_BIN_HOME, then XDG_DATA_HOME/../bin, then
                           ~/.local/bin).
  --no-install-completion  Do not run 'seam completion --install'.
  --no-modify-path         Do not add the install directory to PATH in the
                           shell configuration.
  -h, --help               Show this help.

Environment:
  SEAM_BIN_PATH        Install directory (same as --bin-path).
  SEAM_NO_COMPLETIONS  Set to 1 to skip completions.
  SEAM_NO_MODIFY_PATH  Set to 1 to never edit the shell configuration for PATH.
  SEAM_DOWNLOAD_URL    Base URL for release downloads (mirrors and testing).
EOF
}

say() {
  echo "install.sh: $1"
}

warn() {
  echo "install.sh: warning: $1" >&2
}

err() {
  echo "install.sh: error: $1" >&2
  exit 1
}

check_cmd() {
  command -v "$1" > /dev/null 2>&1
}

need_cmd() {
  if ! check_cmd "$1"; then
    err "need '$1' (command not found)"
  fi
}

# Pick curl or wget for all downloads.
detect_downloader() {
  if check_cmd curl; then
    _downloader=curl
  elif check_cmd wget; then
    _downloader=wget
  else
    err "need 'curl' or 'wget' (command not found)"
  fi
}

# download <url> <output file>
#
# Enforce HTTPS against GitHub. When SEAM_DOWNLOAD_URL is set the user opted
# in to their own base URL, so other protocols are allowed for mirrors and
# local testing.
download() {
  if [ "$_downloader" = curl ]; then
    if [ -n "${SEAM_DOWNLOAD_URL:-}" ]; then
      curl -fsSL "$1" -o "$2"
    else
      curl --proto '=https' --tlsv1.2 -fsSL "$1" -o "$2"
    fi
  else
    wget -q "$1" -O "$2"
  fi
}

# Resolve the latest release tag by following the releases/latest redirect.
# This avoids the GitHub API and its rate limits.
resolve_latest_tag() {
  if [ "$_downloader" = curl ]; then
    _redirect_url=$(curl --proto '=https' --tlsv1.2 -fsSLI \
      -o /dev/null -w '%{url_effective}' "$LATEST_RELEASE_URL") ||
      err "cannot resolve the latest release of ${REPO}"
  else
    _redirect_url=$(wget --spider --server-response "$LATEST_RELEASE_URL" 2>&1 |
      grep -i '^ *location: ' | tail -n 1 | awk '{print $2}' | tr -d '\r') ||
      err "cannot resolve the latest release of ${REPO}"
  fi
  case "$_redirect_url" in
    */releases/tag/*) _tag="${_redirect_url##*/releases/tag/}" ;;
    *) err "cannot parse the latest release tag from ${_redirect_url}" ;;
  esac
}

detect_platform() {
  _os_name=$(uname -s)
  case "$_os_name" in
    Darwin) _os=darwin ;;
    Linux) _os=linux ;;
    MINGW* | MSYS* | CYGWIN* | Windows_NT)
      err "use install.ps1 on Windows:
  iwr -useb https://raw.githubusercontent.com/${REPO}/main/install.ps1 | iex"
      ;;
    *) err "unsupported operating system: ${_os_name} (supported: Linux, macOS, Windows)" ;;
  esac

  _arch_name=$(uname -m)
  case "$_arch_name" in
    x86_64 | amd64) _arch=x64 ;;
    arm64 | aarch64) _arch=arm64 ;;
    *) err "unsupported architecture: ${_arch_name} (supported: x64, arm64)" ;;
  esac
}

sha256() {
  if check_cmd sha256sum; then
    sha256sum "$1" | awk '{print $1}'
  elif check_cmd gsha256sum; then
    gsha256sum "$1" | awk '{print $1}'
  elif check_cmd shasum; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif check_cmd openssl; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    err "need a SHA-256 tool: sha256sum, gsha256sum, shasum, or openssl (command not found)"
  fi
}

get_home() {
  if [ -n "${HOME:-}" ]; then
    echo "$HOME"
  elif check_cmd getent && check_cmd id; then
    getent passwd "$(id -u)" | cut -d: -f6
  else
    err "cannot determine the home directory: HOME is not set"
  fi
}

# Install directory cascade:
# --bin-path, SEAM_BIN_PATH, XDG_BIN_HOME, XDG_DATA_HOME/../bin, ~/.local/bin.
resolve_bin_dir() {
  if [ -n "$_bin_path" ]; then
    _bin_dir="$_bin_path"
  elif [ -n "${SEAM_BIN_PATH:-}" ]; then
    _bin_dir="$SEAM_BIN_PATH"
  elif [ -n "${XDG_BIN_HOME:-}" ]; then
    _bin_dir="$XDG_BIN_HOME"
  elif [ -n "${XDG_DATA_HOME:-}" ]; then
    _bin_dir="$(dirname "$XDG_DATA_HOME")/bin"
  else
    _bin_dir="$(get_home)/.local/bin"
  fi
}

# shell_name '-/bin/zsh' -> 'zsh'
shell_name() {
  [ -n "$1" ] || return 0
  basename "$1" | sed 's/^-//'
}

is_shell() {
  case "$1" in
    bash | zsh | fish) return 0 ;;
    *) return 1 ;;
  esac
}

# Detect the user's shell the same way 'seam completion --install' does
# (src/lib/completion/detect-shell.ts): walk up to 10 process ancestors,
# preferring procfs over ps, then fall back to SHELL. Sets _shell.
detect_shell() {
  _shell=''
  _pid="${PPID:-0}"
  _depth=0
  while [ "$_depth" -lt 10 ] && [ "$_pid" -gt 1 ] 2> /dev/null; do
    if [ -r "/proc/${_pid}/comm" ]; then
      _comm=$(cat "/proc/${_pid}/comm" 2> /dev/null) || _comm=''
      # In /proc/<pid>/stat the ppid is the second field after the last ')'.
      _ppid=$(sed 's/^.*) *//' "/proc/${_pid}/stat" 2> /dev/null | awk '{print $2}')
    elif check_cmd ps; then
      _psout=$(ps -p "$_pid" -o comm=,ppid= 2> /dev/null) || _psout=''
      [ -n "$_psout" ] || break
      _ppid=$(echo "$_psout" | awk '{print $NF}')
      _comm=$(echo "$_psout" | awk '{$NF = ""; sub(/ +$/, ""); print}')
    else
      break
    fi
    [ -n "$_comm" ] || break
    _name=$(shell_name "$_comm")
    if is_shell "$_name"; then
      _shell="$_name"
      return 0
    fi
    _pid="$_ppid"
    _depth=$((_depth + 1))
  done
  _name=$(shell_name "${SHELL:-}")
  if is_shell "$_name"; then
    _shell="$_name"
    return 0
  fi
  return 1
}

# Pick the configuration file for _shell the same way
# 'seam completion --install' does (src/lib/completion/install.ts).
# Sets _shell_config and _path_line.
resolve_shell_config() {
  case "$_shell" in
    fish)
      _shell_config="${XDG_CONFIG_HOME:-$(get_home)/.config}/fish/config.fish"
      _path_line="fish_add_path \"${_bin_dir}\""
      ;;
    zsh)
      _shell_config="${ZDOTDIR:-$(get_home)}/.zshrc"
      _path_line="export PATH=\"${_bin_dir}:\$PATH\""
      ;;
    bash)
      _home=$(get_home)
      if [ -f "${_home}/.bashrc" ]; then
        _shell_config="${_home}/.bashrc"
      elif [ -f "${_home}/.bash_profile" ]; then
        _shell_config="${_home}/.bash_profile"
      else
        _shell_config="${_home}/.bashrc"
      fi
      _path_line="export PATH=\"${_bin_dir}:\$PATH\""
      ;;
  esac
}

modify_path() {
  if [ "$_modify_path" = 1 ] && detect_shell; then
    resolve_shell_config
    mkdir -p "$(dirname "$_shell_config")"
    if [ -f "$_shell_config" ] && grep -qxF "$_path_line" "$_shell_config"; then
      say "${_bin_dir} is already added to PATH in ${_shell_config}"
    else
      printf '%s\n' "$_path_line" >> "$_shell_config"
      say "added ${_bin_dir} to PATH in ${_shell_config}"
    fi
    say "open a new shell to use ${APP_NAME}, or run 'exec ${_shell}' now"
  else
    warn "make sure ${_bin_dir} is added to your PATH, for example:
  export PATH=\"${_bin_dir}:\$PATH\""
  fi
}

cleanup() {
  if [ -n "${_tmp_dir:-}" ]; then
    rm -rf "$_tmp_dir"
  fi
  if [ -n "${_staged:-}" ] && [ -f "$_staged" ]; then
    rm -f "$_staged"
  fi
}

main() {
  _tag=''
  _bin_path=''
  _install_completion=1
  if [ "${SEAM_NO_COMPLETIONS:-0}" = 1 ]; then
    _install_completion=0
  fi
  _modify_path=1
  if [ "${SEAM_NO_MODIFY_PATH:-0}" = 1 ]; then
    _modify_path=0
  fi

  while [ $# -gt 0 ]; do
    case "$1" in
      --version)
        [ $# -ge 2 ] || err "--version requires a value, e.g. --version v0.29.0"
        _tag="$2"
        shift 2
        ;;
      --bin-path)
        [ $# -ge 2 ] || err "--bin-path requires a value, e.g. --bin-path ~/.local/bin"
        _bin_path="$2"
        shift 2
        ;;
      --no-install-completion)
        _install_completion=0
        shift
        ;;
      --no-modify-path)
        _modify_path=0
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      -*)
        err "unknown option: $1 (try --help)"
        ;;
      *)
        [ -z "$_tag" ] || err "unexpected argument: $1 (try --help)"
        _tag="$1"
        shift
        ;;
    esac
  done

  need_cmd uname
  need_cmd mktemp
  need_cmd mkdir
  need_cmd chmod
  need_cmd rm
  need_cmd grep
  need_cmd awk
  need_cmd cut
  detect_downloader

  detect_platform

  if [ -z "$_tag" ]; then
    resolve_latest_tag
  else
    case "$_tag" in
      v*) ;;
      *) _tag="v${_tag}" ;;
    esac
  fi

  _asset="${APP_NAME}-${_tag}-${_os}-${_arch}"
  _asset_url="${DOWNLOAD_BASE}/${_tag}/${_asset}"
  _checksums_url="${DOWNLOAD_BASE}/${_tag}/checksums.txt"

  resolve_bin_dir

  _tmp_dir=$(mktemp -d) || err "cannot create a temporary directory"
  trap cleanup EXIT HUP INT TERM

  say "downloading ${_asset_url}"
  download "$_asset_url" "${_tmp_dir}/${_asset}" ||
    err "cannot download ${_asset_url}
Check that release ${_tag} exists and has a binary for ${_os}-${_arch}:
  https://github.com/${REPO}/releases"

  say "verifying the checksum with ${_checksums_url}"
  download "$_checksums_url" "${_tmp_dir}/checksums.txt" ||
    err "cannot download ${_checksums_url}"

  _expected=$(awk -v asset="$_asset" \
    '{sum = $1; file = $2; sub(/^\*/, "", file)} file == asset {print sum}' \
    "${_tmp_dir}/checksums.txt")
  [ -n "$_expected" ] || err "${_asset} is not listed in checksums.txt: refusing to install"
  _actual=$(sha256 "${_tmp_dir}/${_asset}")
  if [ "$_actual" != "$_expected" ]; then
    err "checksum mismatch for ${_asset}: refusing to install
  expected: ${_expected}
  actual:   ${_actual}"
  fi

  mkdir -p "$_bin_dir" || err "cannot create ${_bin_dir}"
  # Stage next to the final path so the last step is an atomic rename and a
  # partially written binary is never installed.
  _staged="${_bin_dir}/.${APP_NAME}.tmp.$$"
  cp "${_tmp_dir}/${_asset}" "$_staged" || err "cannot write to ${_bin_dir}"
  chmod +x "$_staged"
  mv -f "$_staged" "${_bin_dir}/${APP_NAME}"
  say "installed ${_bin_dir}/${APP_NAME} ($("${_bin_dir}/${APP_NAME}" --version 2> /dev/null || echo "$_tag"))"

  case ":${PATH}:" in
    *":${_bin_dir}:"*) ;;
    *) modify_path ;;
  esac
  if [ -n "${GITHUB_PATH:-}" ]; then
    echo "$_bin_dir" >> "$GITHUB_PATH"
  fi

  if [ "$_install_completion" = 1 ]; then
    if PATH="${_bin_dir}:${PATH}" "${_bin_dir}/${APP_NAME}" completion --install; then
      :
    else
      warn "cannot install shell completions
Install them later with:
  ${APP_NAME} completion --install [bash|fish|zsh]"
    fi
  fi
}

main "$@"
