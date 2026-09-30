# 스크린세이버 클라이언트 설치 (현재 사용자 기준, 관리자 권한 불필요)
#   .\install.ps1 -ServerUrl http://192.168.0.10:8080 -Department 영업팀 -TimeoutMinutes 10
# 사전 준비: client 폴더에서  npm run pack  -> dist\CompanySaver-win32-x64 생성
param(
  [Parameter(Mandatory = $true)][string]$ServerUrl,
  [string]$Department = '',
  [int]$TimeoutMinutes = 10,
  [string]$Source = (Join-Path $PSScriptRoot '..\dist\CompanySaver-win32-x64')
)
$ErrorActionPreference = 'Stop'
$dest = Join-Path $env:LOCALAPPDATA 'CompanySaver\app'
if (-not (Test-Path $Source)) { throw "패키지 폴더가 없습니다: $Source  (먼저 npm run pack 실행)" }

Get-Process CompanySaver -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item "$Source\*" $dest -Recurse -Force

# exe -> .scr (Electron은 확장자와 무관하게 동작)
Copy-Item (Join-Path $dest 'CompanySaver.exe') (Join-Path $dest 'CompanySaver.scr') -Force

# 서버 주소/부서 설정
$cfgDir = Join-Path $env:LOCALAPPDATA 'CompanySaver'
@{ serverUrl = $ServerUrl; department = $Department; pollMinutes = 10 } | ConvertTo-Json |
  Set-Content (Join-Path $cfgDir 'config.json') -Encoding UTF8

# 현재 사용자의 화면 보호기로 지정
$reg = 'HKCU:\Control Panel\Desktop'
Set-ItemProperty $reg SCRNSAVE.EXE (Join-Path $dest 'CompanySaver.scr')
Set-ItemProperty $reg ScreenSaveActive '1'
Set-ItemProperty $reg ScreenSaveTimeOut ([string]($TimeoutMinutes * 60))
Set-ItemProperty $reg ScreenSaverIsSecure '0'
Write-Host "설치 완료: $dest  (대기 $TimeoutMinutes 분 후 실행)"
Write-Host "테스트: & '$dest\CompanySaver.scr' /s     설정: & '$dest\CompanySaver.scr' /c"
