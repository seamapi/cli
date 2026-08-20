<#
.SYNOPSIS
Install the Seam CLI on Windows.

.DESCRIPTION
Downloads the standalone seam binary from GitHub Releases, verifies its
SHA-256 checksum against the release's checksums.txt in a temporary
directory, installs it, and adds the install directory to the user PATH.

Run directly from the web (parameters are not available this way, use the
environment variables instead):

  iwr -useb https://raw.githubusercontent.com/seamapi/cli/main/install.ps1 | iex

Or download first to pass parameters:

  iwr -useb https://raw.githubusercontent.com/seamapi/cli/main/install.ps1 -OutFile install.ps1
  .\install.ps1 -Version v0.29.0

.PARAMETER Version
Version to install, e.g. v0.29.0 (default: latest).

.PARAMETER BinPath
Install directory (default: SEAM_BIN_PATH environment variable, then
%LOCALAPPDATA%\seam\bin).

.PARAMETER NoInstallCompletion
Accepted for symmetry with install.sh. Shell completions support bash, fish,
and zsh only, so they are never installed on Windows.

.NOTES
Environment variables: SEAM_BIN_PATH (install directory), SEAM_DOWNLOAD_URL
(base URL for release downloads, for mirrors and testing).
#>
[CmdletBinding()]
param(
  [string]$Version = '',
  [string]$BinPath = '',
  [switch]$NoInstallCompletion
)

$ErrorActionPreference = 'Stop'

$AppName = 'seam'
$Repo = 'seamapi/cli'
$DownloadBase = if ($env:SEAM_DOWNLOAD_URL) {
  $env:SEAM_DOWNLOAD_URL
} else {
  "https://github.com/$Repo/releases/download"
}

# Windows PowerShell 5.1 defaults to TLS 1.0, which GitHub rejects.
if ($PSVersionTable.PSVersion.Major -lt 6) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

function Get-LatestTag {
  $release = Invoke-RestMethod -UseBasicParsing `
    -Uri "https://api.github.com/repos/$Repo/releases/latest"
  return $release.tag_name
}

function Test-IsWindows {
  # $IsWindows does not exist on Windows PowerShell 5.1.
  return ($PSVersionTable.PSVersion.Major -lt 6) -or $IsWindows
}

if (Test-IsWindows) {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -eq 'ARM64') {
    Write-Host 'No arm64 binary is published for Windows: installing the x64 binary, which runs under emulation.'
  } elseif ($arch -ne 'AMD64') {
    throw "Unsupported architecture: $arch (supported: AMD64, ARM64)."
  }
}

if (-not $Version) {
  $Version = Get-LatestTag
} elseif ($Version -notmatch '^v') {
  $Version = "v$Version"
}

if (-not $BinPath) {
  if ($env:SEAM_BIN_PATH) {
    $BinPath = $env:SEAM_BIN_PATH
  } elseif ($env:LOCALAPPDATA) {
    $BinPath = Join-Path $env:LOCALAPPDATA "$AppName\bin"
  } else {
    throw 'Cannot determine the install directory: set SEAM_BIN_PATH or LOCALAPPDATA.'
  }
}

$asset = "$AppName-$Version-windows-x64.exe"
$assetUrl = "$DownloadBase/$Version/$asset"
$checksumsUrl = "$DownloadBase/$Version/checksums.txt"

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) "$AppName-install-$([Guid]::NewGuid())"
New-Item -ItemType Directory -Path $tmpDir | Out-Null

try {
  $assetFile = Join-Path $tmpDir $asset
  $checksumsFile = Join-Path $tmpDir 'checksums.txt'

  Write-Host "Downloading $assetUrl"
  Invoke-WebRequest -UseBasicParsing -Uri $assetUrl -OutFile $assetFile

  Write-Host "Verifying the checksum with $checksumsUrl"
  Invoke-WebRequest -UseBasicParsing -Uri $checksumsUrl -OutFile $checksumsFile

  # checksums.txt is in sha256sum format: '<sha256>  <filename>' per line.
  $expected = ''
  foreach ($line in Get-Content $checksumsFile) {
    $parts = $line.Trim() -split '\s+', 2
    if ($parts.Count -eq 2 -and $parts[1].TrimStart('*') -eq $asset) {
      $expected = $parts[0]
      break
    }
  }
  if (-not $expected) {
    throw "$asset is not listed in checksums.txt: refusing to install."
  }
  $actual = (Get-FileHash -Path $assetFile -Algorithm SHA256).Hash
  if ($actual -ne $expected) {
    throw "Checksum mismatch for ${asset}: refusing to install.`n  expected: $expected`n  actual:   $actual"
  }

  New-Item -ItemType Directory -Path $BinPath -Force | Out-Null
  $target = Join-Path $BinPath "$AppName.exe"
  Move-Item -Path $assetFile -Destination $target -Force
  Write-Host "Installed $target ($Version)"
} finally {
  Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Add the install directory to the user PATH (registry) and to the current
# session, so seam is available in new shells without manual setup.
if (Test-IsWindows) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $userPath) { $userPath = '' }
  $onPath = ($userPath -split ';' | Where-Object { $_ -eq $BinPath }).Count -gt 0
  if (-not $onPath) {
    $newPath = if ($userPath) { "$userPath;$BinPath" } else { $BinPath }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Added $BinPath to the user PATH. Open a new shell to use $AppName."
  }
}
if (($env:PATH -split [IO.Path]::PathSeparator) -notcontains $BinPath) {
  $env:PATH = "$BinPath$([IO.Path]::PathSeparator)$env:PATH"
}
if ($env:GITHUB_PATH) {
  Add-Content -Path $env:GITHUB_PATH -Value $BinPath
}

if (-not $NoInstallCompletion) {
  Write-Host "Shell completions support bash, fish, and zsh only, so they are not installed on Windows. In one of those shells, run: $AppName completion --install"
}
