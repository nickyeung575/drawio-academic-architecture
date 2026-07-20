[CmdletBinding()]
param(
  [string]$SourceRoot = (Join-Path $PSScriptRoot '..\skill\drawio-academic-architecture'),
  [string]$DestinationRoot = $(
    $homeRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
    Join-Path $homeRoot 'skills'
  ),
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$skillName = 'drawio-academic-architecture'
$source = (Resolve-Path -LiteralPath $SourceRoot).Path

if ((Split-Path $source -Leaf) -ne $skillName) {
  throw "Source directory must be named $skillName."
}

New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
$destinationRootResolved = (Resolve-Path -LiteralPath $DestinationRoot).Path
$destination = Join-Path $destinationRootResolved $skillName

function Get-TreeHashes([string]$Root) {
  $rootPath = (Resolve-Path -LiteralPath $Root).Path
  @(Get-ChildItem -LiteralPath $rootPath -Recurse -File | ForEach-Object {
    $relative = ($_.FullName.Substring($rootPath.Length) -replace '^[\\/]+', '').Replace('\', '/')
    $digest = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$relative`:$digest"
  } | Sort-Object)
}

if (Test-Path -LiteralPath $destination) {
  $sourceHashes = Get-TreeHashes $source
  $destinationHashes = Get-TreeHashes $destination
  if ((Compare-Object $sourceHashes $destinationHashes).Count -eq 0) {
    Write-Output "The installed $skillName Skill already matches. Restart Codex if it was installed during this session."
    return
  }
  if (-not $Force) {
    throw "Destination differs from this Skill. Review it, then use -Force to replace it."
  }

  $rootPrefix = $destinationRootResolved.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $destinationFull = [System.IO.Path]::GetFullPath($destination)
  if (-not $destinationFull.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path $destinationFull -Leaf) -ne $skillName) {
    throw "Refusing to replace a destination outside the configured skills root."
  }
  Remove-Item -LiteralPath $destinationFull -Recurse -Force
}

Copy-Item -LiteralPath $source -Destination $destination -Recurse
$copiedHashes = Get-TreeHashes $destination
$expectedHashes = Get-TreeHashes $source
if ((Compare-Object $expectedHashes $copiedHashes).Count -ne 0) {
  throw "Installed Skill hash verification failed."
}
Write-Output "Installed $skillName. Restart Codex to load the Skill."
