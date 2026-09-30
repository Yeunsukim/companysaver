# 스크린세이버 제거 (현재 사용자)
Get-Process CompanySaver -ErrorAction SilentlyContinue | Stop-Process -Force
$reg = 'HKCU:\Control Panel\Desktop'
Remove-ItemProperty $reg SCRNSAVE.EXE -ErrorAction SilentlyContinue
Set-ItemProperty $reg ScreenSaveActive '0'
Remove-Item (Join-Path $env:LOCALAPPDATA 'CompanySaver') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host '제거 완료'
