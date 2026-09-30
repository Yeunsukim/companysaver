# 스크린세이버 서버 트레이 프로그램
#  - 트레이 아이콘 색으로 서버 상태 표시 (초록: 실행 중, 빨강: 중지)
#  - 관리 화면 열기 / 클라이언트 접속 주소 복사 / 서버 시작·재시작·중지(관리자 권한 요청) / 로그 보기
#  - 서버는 SYSTEM 예약 작업(CompanySaverServer)으로 실행되며, 트레이를 종료해도 계속 실행된다.
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$ErrorActionPreference = 'SilentlyContinue'

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'CompanySaverServerTray', [ref]$created)
if (-not $created) { exit }

$port = 8080
try { $port = [int]((Get-Content (Join-Path $PSScriptRoot 'port.txt') -Raw).Trim()) } catch {}
$dataDir = Join-Path $env:ProgramData 'CompanySaverServer'
$TASK = 'CompanySaverServer'
$EXE = 'CompanySaverServer.exe'
$flag = '"%ProgramData%\CompanySaverServer\stop.flag"'
$script:running = $null
$script:task = $null

function New-StatusIcon($color) {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(79, 70, 229))
  $g.FillEllipse($bg, 1, 1, 30, 30)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 2.2
  $g.DrawRectangle($pen, 6, 7, 17, 11)
  $g.DrawLine($pen, 14.5, 18, 14.5, 22)
  $g.DrawLine($pen, 10, 22.5, 19, 22.5)
  $g.FillEllipse([System.Drawing.Brushes]::White, 17, 17, 14, 14)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $color), 19, 19, 10, 10)
  $g.Dispose()
  [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$iconOn = New-StatusIcon ([System.Drawing.Color]::FromArgb(34, 197, 94))
$iconOff = New-StatusIcon ([System.Drawing.Color]::FromArgb(220, 38, 38))

function Invoke-Admin($command) {
  try { Start-Process cmd.exe -ArgumentList "/c `"$command`"" -Verb RunAs -WindowStyle Hidden } catch {}
}
$stopCmd = "echo.> $flag & schtasks /End /TN $TASK & taskkill /F /IM $EXE"
$startCmd = "del $flag 2>nul & schtasks /Run /TN $TASK"

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $iconOff
$tray.Text = '스크린세이버 서버 - 확인 중'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add('확인 중...')
$statusItem.Enabled = $false
$statusItem.Font = New-Object System.Drawing.Font($statusItem.Font, [System.Drawing.FontStyle]::Bold)
[void]$menu.Items.Add('-')
$menu.Items.Add('관리 화면 열기').add_Click({ Start-Process "http://localhost:$port/admin/" })
$copyMenu = New-Object System.Windows.Forms.ToolStripMenuItem '클라이언트 접속 주소 복사'
[void]$menu.Items.Add($copyMenu)
[void]$menu.Items.Add('-')
$menu.Items.Add('서버 시작').add_Click({ Invoke-Admin $startCmd })
$menu.Items.Add('서버 재시작').add_Click({ Invoke-Admin "$stopCmd & ping -n 4 127.0.0.1 >nul & $startCmd" })
$menu.Items.Add('서버 중지').add_Click({ Invoke-Admin $stopCmd })
[void]$menu.Items.Add('-')
$menu.Items.Add('로그 보기').add_Click({
  $log = Join-Path $dataDir 'server.log'
  if (Test-Path $log) { Start-Process notepad.exe "`"$log`"" }
  else { $tray.ShowBalloonTip(2000, '스크린세이버 서버', '로그 파일이 아직 없습니다.', 'Info') }
})
[void]$menu.Items.Add('-')
$ctx = New-Object System.Windows.Forms.ApplicationContext
$menu.Items.Add('트레이 종료 (서버는 계속 실행)').add_Click({ $tray.Visible = $false; $ctx.ExitThread() })

# 메뉴를 열 때마다 현재 PC의 IPv4 주소 목록으로 갱신
$menu.add_Opening({
  $copyMenu.DropDownItems.Clear()
  $ips = @()
  foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($ni.OperationalStatus -ne 'Up' -or $ni.NetworkInterfaceType -in 'Loopback', 'Tunnel') { continue }
    foreach ($ua in $ni.GetIPProperties().UnicastAddresses) {
      if ($ua.Address.AddressFamily -eq 'InterNetwork' -and -not $ua.Address.ToString().StartsWith('169.254.')) { $ips += $ua.Address.ToString() }
    }
  }
  if (-not $ips) { $n = $copyMenu.DropDownItems.Add('사용 가능한 네트워크 주소 없음'); $n.Enabled = $false; return }
  foreach ($ip in $ips) {
    $url = "http://${ip}:$port"
    $item = $copyMenu.DropDownItems.Add($url)
    $item.add_Click({ [System.Windows.Forms.Clipboard]::SetText($url); $tray.ShowBalloonTip(2000, '주소 복사됨', "$url`n클라이언트 설치 화면에 붙여 넣으세요.", 'Info') }.GetNewClosure())
  }
})
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Start-Process "http://localhost:$port/admin/" })

function Set-State($ok) {
  $changed = ($script:running -ne $ok)
  $script:running = $ok
  $tray.Icon = if ($ok) { $iconOn } else { $iconOff }
  $text = if ($ok) { "서버 실행 중 (포트 $port)" } else { '서버 중지됨' }
  $statusItem.Text = "● $text"
  $statusItem.ForeColor = if ($ok) { [System.Drawing.Color]::FromArgb(21, 128, 61) } else { [System.Drawing.Color]::FromArgb(185, 28, 28) }
  $tray.Text = "스크린세이버 - $text"
  if ($env:TRAY_DEBUG) { Add-Content $env:TRAY_DEBUG "$(Get-Date -Format HH:mm:ss) $text" }
  if ($changed -and -not $ok) { $tray.ShowBalloonTip(3000, '스크린세이버 서버', '서버가 응답하지 않습니다. 우클릭 → 서버 시작', 'Warning') }
}

# 비동기 상태 확인 (메뉴가 멈추지 않도록 다음 tick에서 결과를 확인)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({
  if ($script:task) {
    if ($script:task.IsCompleted) {
      $ok = $false
      if (-not $script:task.IsFaulted -and -not $script:task.IsCanceled) { $ok = ($script:task.Result.StatusCode -eq 'OK'); $script:task.Result.Close() }
      $script:task = $null; Set-State $ok
    } elseif ((Get-Date) -gt $script:deadline) { $script:task = $null; Set-State $false }
  }
  if (-not $script:task) {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port/api/playlist")
    $req.Timeout = 1500; $req.Proxy = $null
    $script:deadline = (Get-Date).AddSeconds(4)
    $script:task = $req.GetResponseAsync()
  }
})
$tray.Visible = $true
$timer.Start()
[System.Windows.Forms.Application]::Run($ctx)
$tray.Dispose()
$mutex.ReleaseMutex()
