[CmdletBinding()]
param(
  [string]$SourceRoot,
  [string]$DestinationRoot,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$skillName = 'drawio-academic-architecture'
if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
  $SourceRoot = Join-Path $PSScriptRoot '..\skill\drawio-academic-architecture'
}
if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
  $homeRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
  $DestinationRoot = Join-Path $homeRoot 'skills'
}
$source = (Resolve-Path -LiteralPath $SourceRoot).Path

if ((Split-Path $source -Leaf) -ne $skillName) {
  throw "Source directory must be named $skillName."
}

New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
$destinationRootResolved = (Resolve-Path -LiteralPath $DestinationRoot).Path
$destination = Join-Path $destinationRootResolved $skillName

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      $digestBytes = $algorithm.ComputeHash($stream)
      return ([System.BitConverter]::ToString($digestBytes)).Replace('-', '').ToLowerInvariant()
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-TreeHashes([string]$Root) {
  $rootPath = (Resolve-Path -LiteralPath $Root).Path
  function Get-TreeHashRows([string]$CurrentPath, [string]$RelativePath) {
    foreach ($entry in Get-ChildItem -LiteralPath $CurrentPath -Force) {
      $relative = if ($RelativePath) { "$RelativePath/$($entry.Name)" } else { $entry.Name }
      if ($entry.PSIsContainer) {
        Get-TreeHashRows $entry.FullName $relative
      } else {
        $digest = Get-Sha256 $entry.FullName
        "$relative`:$digest"
      }
    }
  }
  @(Get-TreeHashRows $rootPath '' | Sort-Object)
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

  $rootItem = Get-Item -LiteralPath $destinationRootResolved -Force
  $destinationItem = Get-Item -LiteralPath $destination -Force
  $isReparsePoint = [bool]($destinationItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
  if (-not $destinationItem.PSIsContainer -or
      $isReparsePoint -or
      -not [string]::Equals($destinationItem.Parent.FullName, $rootItem.FullName, [System.StringComparison]::OrdinalIgnoreCase) -or
      $destinationItem.Name -ne $skillName) {
    throw "Refusing to replace a destination outside the configured skills root."
  }
  $destinationFull = $destinationItem.FullName
  Remove-Item -LiteralPath $destinationFull -Recurse -Force
}

Copy-Item -LiteralPath $source -Destination $destination -Recurse
$copiedHashes = Get-TreeHashes $destination
$expectedHashes = Get-TreeHashes $source
if ((Compare-Object $expectedHashes $copiedHashes).Count -ne 0) {
  throw "Installed Skill hash verification failed."
}
Write-Output "Installed $skillName. Restart Codex to load the Skill."
