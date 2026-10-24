param([string]$ToolRoot='C:/Users/Techn/.tamas-mobile-build')
$ErrorActionPreference='Stop'
# Uses Google's official repository metadata and checksums, never third-party binaries.
[xml]$repository=Get-Content (Join-Path $ToolRoot 'repository4.xml') -Raw
[xml]$images=Get-Content (Join-Path $ToolRoot 'google-images.xml') -Raw
$packages=@(
  @{manifest=$repository;root='sdk-repository';package=($repository.'sdk-repository'.remotePackage | Where-Object path -EQ 'emulator' | Select-Object -First 1);base='https://redirector.gvt1.com/edgedl/android/repository/'},
  @{manifest=$images;root='sdk-sys-img';package=($images.'sdk-sys-img'.remotePackage | Where-Object path -EQ 'system-images;android-36;google_apis;x86_64');base='https://redirector.gvt1.com/edgedl/android/repository/sys-img/google_apis/'}
)
foreach($entry in $packages){
  $package=$entry.package
  if(-not $package){throw 'Official emulator metadata missing'}
  $archive=$package.archives.archive | Where-Object { $_.'host-os' -eq 'windows' -or -not $_.'host-os' } | Select-Object -First 1
  $zip=Join-Path $ToolRoot $archive.complete.url
  if(-not(Test-Path -LiteralPath $zip) -or (Get-Item -LiteralPath $zip).Length -ne [long]$archive.complete.size){
    & curl.exe -L --fail --retry 2 --continue-at - --silent --show-error -o $zip ($entry.base+$archive.complete.url)
    if($LASTEXITCODE -ne 0){throw 'Official emulator download failed'}
  }
  $algorithm=if($archive.complete.checksum.type -eq 'sha256'){'SHA256'}else{'SHA1'}
  if((Get-FileHash -LiteralPath $zip -Algorithm $algorithm).Hash -ne $archive.complete.checksum.'#text'){throw 'Emulator checksum failed'}
  $destination=Join-Path (Join-Path $ToolRoot 'sdk') $package.path.Replace(';','/')
  if(-not(Test-Path (Join-Path $destination 'source.properties'))){
    $extract=Join-Path $ToolRoot ('extract-'+$package.path.Replace(';','-'))
    New-Item -ItemType Directory -Force $extract,$destination | Out-Null
    & tar.exe -xf $zip -C $extract
    if($LASTEXITCODE -ne 0){throw 'Emulator extraction failed'}
    $contents=@(Get-ChildItem -LiteralPath $extract -Directory)
    if($contents.Count -ne 1){throw 'Unexpected emulator archive structure'}
    Get-ChildItem -LiteralPath $contents[0].FullName | Copy-Item -Destination $destination -Recurse -Force
  }
  $namespaces=($entry.manifest.DocumentElement.Attributes | Where-Object {$_.Name.StartsWith('xmlns')} | ForEach-Object OuterXml)-join ' '
  $elements=($package.ChildNodes | Where-Object {$_.Name -in @('type-details','revision','display-name','uses-license','dependencies')} | ForEach-Object OuterXml)-join ''
  $licenses=($entry.manifest.DocumentElement.license | ForEach-Object OuterXml)-join ''
  [IO.File]::WriteAllText((Join-Path $destination 'package.xml'),"<?xml version=`"1.0`" encoding=`"UTF-8`"?><local:repository xmlns:local=`"http://schemas.android.com/repository/android/common/02`" $namespaces>$licenses<localPackage path=`"$($package.path)`" obsolete=`"false`">$elements</localPackage></local:repository>")
  Write-Output "Verified and installed $($package.path)"
}
