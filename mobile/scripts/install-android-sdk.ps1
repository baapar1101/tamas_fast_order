param([string]$BuildRoot = 'C:/Users/Techn/.tamas-mobile-build')
$ErrorActionPreference = 'Stop'
$sdkRoot = Join-Path $BuildRoot 'sdk'
[xml]$manifest = Get-Content (Join-Path $BuildRoot 'repository4.xml') -Raw
$paths = @('platforms;android-37.0','build-tools;37.0.0','build-tools;36.0.0','platform-tools','ndk;27.1.12297006','cmake;4.1.2')
foreach ($packagePath in $paths) {
  $package = $manifest.'sdk-repository'.remotePackage | Where-Object path -EQ $packagePath | Select-Object -First 1
  if (-not $package) { throw "Official manifest does not contain $packagePath" }
  $archive = $package.archives.archive | Where-Object { $_.'host-os' -eq 'windows' -or -not $_.'host-os' } | Select-Object -First 1
  $zipFile = Join-Path $BuildRoot $archive.complete.url
  if (-not (Test-Path -LiteralPath $zipFile)) {
    & curl.exe -L --fail --retry 2 --silent --show-error -o $zipFile "https://redirector.gvt1.com/edgedl/android/repository/$($archive.complete.url)"
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $packagePath" }
  }
  $algorithm = if ($archive.complete.checksum.type -eq 'sha256') { 'SHA256' } else { 'SHA1' }
  $expected = $archive.complete.checksum.'#text'
  if ((Get-FileHash -LiteralPath $zipFile -Algorithm $algorithm).Hash -ne $expected) { throw "Checksum failed: $packagePath" }
  $destination = Join-Path $sdkRoot ($packagePath.Replace(';','/'))
  if (-not(Test-Path (Join-Path $destination 'source.properties'))) {
    $extractPath = Join-Path $BuildRoot ('extract-' + $packagePath.Replace(';','-'))
    New-Item -ItemType Directory -Force $extractPath,$destination | Out-Null
    Expand-Archive -LiteralPath $zipFile -DestinationPath $extractPath -Force
    $contents = @(Get-ChildItem -LiteralPath $extractPath -Directory)
    $contentRoot = if ($packagePath.StartsWith('cmake;')) { $extractPath } elseif ($contents.Count -eq 1) { $contents[0].FullName } else { throw "Unexpected archive layout for $packagePath" }
    Get-ChildItem -LiteralPath $contentRoot | Copy-Item -Destination $destination -Recurse -Force
  }
  # Modern full API versions (37.0) need official local-package metadata; legacy source.properties detection cannot parse them.
  $namespaces = ($manifest.DocumentElement.Attributes | Where-Object { $_.Name.StartsWith('xmlns') } | ForEach-Object OuterXml) -join ' '
  $localElements = ($package.ChildNodes | Where-Object { $_.Name -in @('type-details','revision','display-name','uses-license','dependencies') } | ForEach-Object OuterXml) -join ''
  $licenses = ($manifest.'sdk-repository'.license | ForEach-Object OuterXml) -join ''
  $packageXml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?><local:repository xmlns:local=`"http://schemas.android.com/repository/android/common/02`" $namespaces>$licenses<localPackage path=`"$packagePath`" obsolete=`"false`">$localElements</localPackage></local:repository>"
  [System.IO.File]::WriteAllText((Join-Path $destination 'package.xml'),$packageXml)
  Write-Output "Installed and verified $packagePath"
}
# User approved the standard Android SDK license for this local APK build.
$licenseDirectory = Join-Path $sdkRoot 'licenses'
New-Item -ItemType Directory -Force $licenseDirectory | Out-Null
foreach ($license in $manifest.'sdk-repository'.license) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($license.'#text'.Trim())
  $hash = [Convert]::ToHexString([System.Security.Cryptography.SHA1]::HashData($bytes)).ToLowerInvariant()
  [System.IO.File]::WriteAllText((Join-Path $licenseDirectory $license.id),$hash + "`n")
}
