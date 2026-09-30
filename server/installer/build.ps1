# 서버 설치 파일 빌드:  .\build.ps1   ->  server\release\CompanySaverServer-Setup.exe
# 필요: 이 PC에 Node.js(22.13+), client 에서 한 번 electron-builder 를 실행해 NSIS 가 캐시에 있어야 함
$ErrorActionPreference = 'Stop'
$server = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $PSScriptRoot 'stage'

$makensis = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\nsis*" -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $makensis) { throw 'makensis.exe 를 찾을 수 없습니다. client 폴더에서 npm run dist 를 한 번 실행하세요.' }

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
Copy-Item (Join-Path $server 'src') $stage -Recurse
Copy-Item (Join-Path $server 'public') $stage -Recurse
Copy-Item (Join-Path $server 'package.json') $stage
if (Test-Path (Join-Path $server 'package-lock.json')) { Copy-Item (Join-Path $server 'package-lock.json') $stage }
Copy-Item (Get-Command node).Source (Join-Path $stage 'node.exe')
Copy-Item (Join-Path $PSScriptRoot 'tray.ps1') $stage      # 트레이 (PowerShell 스크립트: 컴파일된 exe는 백신이 지우는 경우가 있어 사용하지 않음)
Copy-Item (Join-Path $PSScriptRoot 'killtray.ps1') $stage

Push-Location $stage
npm install --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install 실패' }
Pop-Location

New-Item -ItemType Directory -Force (Join-Path $server 'release') | Out-Null
Push-Location $PSScriptRoot
& $makensis.FullName server.nsi
if ($LASTEXITCODE -ne 0) { throw 'makensis 실패' }
Pop-Location
Get-Item (Join-Path $server 'release\CompanySaverServer-Setup.exe') | Select-Object Name, @{n='MB'; e={[math]::Round($_.Length / 1MB)}}
