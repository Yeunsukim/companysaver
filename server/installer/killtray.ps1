# 실행 중인 트레이 프로그램 종료 (설치/업데이트/제거 시 사용)
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*CompanySaverServer*tray.ps1*' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
