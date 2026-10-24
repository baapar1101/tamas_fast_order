param([string]$BuildRoot='C:/tamas-build',[string]$ToolRoot='C:/Users/Techn/.tamas-mobile-build',[switch]$Qa)
$ErrorActionPreference='Stop'
$sourceRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env:EXPO_PUBLIC_TAMAS_QA=if($Qa){'true'}else{'false'}
$version=(Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json).version
$artifactName=if($Qa){'tamas-market-qa.apk'}else{"tamas-market-$version.apk"}
$destination=Join-Path $BuildRoot 'mobile'
Push-Location $sourceRoot
try {
  & npx expo prebuild --platform android --no-install
  if($LASTEXITCODE -ne 0){throw 'Native project generation failed'}
}finally{Pop-Location}
New-Item -ItemType Directory -Force $destination,(Join-Path $BuildRoot 'packages/shared') | Out-Null
& robocopy $sourceRoot $destination /E /SL /NFL /NDL /NJH /NJS /XD (Join-Path $sourceRoot '.expo') (Join-Path $sourceRoot 'dist') (Join-Path $sourceRoot 'android/.gradle') (Join-Path $sourceRoot 'android/app/build') (Join-Path $sourceRoot 'android/app/.cxx') /XF '*.apk' '*.aab'
if($LASTEXITCODE -gt 7){throw 'Copying mobile build inputs failed'}
& robocopy (Join-Path $sourceRoot '../packages/shared') (Join-Path $BuildRoot 'packages/shared') /E /NFL /NDL /NJH /NJS /XD node_modules
if($LASTEXITCODE -gt 7){throw 'Copying shared build inputs failed'}
Push-Location $destination
try{
  & npm prune --ignore-scripts --no-audit --no-fund
  if($LASTEXITCODE -ne 0){throw 'Pruning stale build-only dependencies failed'}
}finally{Pop-Location}
$signingRoot=Join-Path $ToolRoot 'signing'
New-Item -ItemType Directory -Force $signingRoot | Out-Null
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME=Join-Path $ToolRoot 'sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:PATH="$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:PATH"
$credentialsFile=Join-Path $signingRoot 'release-credentials.json'
if(-not(Test-Path -LiteralPath $credentialsFile)){
  $secret=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  $credentials=@{storePassword=$secret;keyPassword=$secret;alias='tamasmarket';path=(Join-Path $signingRoot 'tamas-market-release.jks')}
  [System.IO.File]::WriteAllText($credentialsFile,($credentials|ConvertTo-Json))
  & icacls.exe $signingRoot /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" | Out-Null
}
$credentials=Get-Content -LiteralPath $credentialsFile -Raw | ConvertFrom-Json
$env:TAMAS_KEYSTORE=$credentials.path
$env:TAMAS_STORE_PASSWORD=$credentials.storePassword
$env:TAMAS_KEY_PASSWORD=$credentials.keyPassword
$env:TAMAS_KEY_ALIAS=$credentials.alias
if(-not(Test-Path -LiteralPath $credentials.path)){
  & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -v -storetype JKS -keystore $credentials.path -alias $credentials.alias -keyalg RSA -keysize 4096 -validity 10000 -storepass:env TAMAS_STORE_PASSWORD -keypass:env TAMAS_KEY_PASSWORD -dname 'CN=Tamas Market, OU=Customer App, O=Tamas Market, C=IR'
  if($LASTEXITCODE -ne 0){throw 'Release key generation failed'}
}
[System.IO.File]::WriteAllText((Join-Path $destination 'android/local.properties'),'sdk.dir=' + $env:ANDROID_HOME.Replace('\','/') + "`n")
Push-Location (Join-Path $destination 'android')
try {
  & ./gradlew.bat assembleRelease --no-daemon --console=plain --init-script (Join-Path $destination 'scripts/google-cdn.init.gradle') '-Pandroid.cmakeVersion=4.1.2' '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64' '-Dorg.gradle.jvmargs=-Xmx6g -Dfile.encoding=UTF-8'
  if($LASTEXITCODE -ne 0){throw 'Android release build failed'}
  $output=Join-Path $sourceRoot 'artifacts'
  New-Item -ItemType Directory -Force $output | Out-Null
  Copy-Item -LiteralPath './app/build/outputs/apk/release/app-release.apk' -Destination (Join-Path $output $artifactName)
  Write-Output "APK: $output/$artifactName"
}finally{
  Pop-Location
  Remove-Item Env:TAMAS_STORE_PASSWORD,Env:TAMAS_KEY_PASSWORD -ErrorAction SilentlyContinue
}
