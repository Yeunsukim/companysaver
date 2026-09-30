; 스크린세이버 서버 설치 프로그램 (NSIS). build.ps1 이 stage 폴더를 준비한 뒤 컴파일한다.
Unicode true
!define APP "CompanySaverServer"
!define TASK "CompanySaverServer"
!define VERSION "1.0.0"

Name "스크린세이버 서버"
OutFile "..\release\CompanySaverServer-Setup.exe"
InstallDir "$PROGRAMFILES64\${APP}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText "스크린세이버 서버 ${VERSION}"

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var PortText
Var PassText
Var PortVal
Var PassVal
Var DataDir

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "관리 화면 열기"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenAdmin

!insertmacro MUI_PAGE_WELCOME
Page custom SettingsCreate SettingsLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Function .onInit
  SetShellVarContext all
  SetRegView 64
  StrCpy $PortVal "8080"
FunctionEnd

Function SettingsCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 12u "웹 포트 (기본 8080)"
  Pop $0
  ${NSD_CreateNumber} 0 14u 60u 12u "$PortVal"
  Pop $PortText
  ${NSD_CreateLabel} 0 40u 100% 24u "관리자(admin) 비밀번호 - 6자 이상.$\r$\n이미 설치된 서버를 업데이트하는 경우 기존 계정이 유지되며 이 값은 무시됩니다."
  Pop $0
  ${NSD_CreatePassword} 0 68u 160u 12u ""
  Pop $PassText
  ${NSD_CreateLabel} 0 92u 100% 36u "방화벽에서 TCP 포트(위 값)를 자동으로 허용하고,$\r$\nPC를 켤 때마다 서버가 자동 실행되도록 등록하고, 알림 영역에 상태 아이콘(트레이)을 표시합니다.$\r$\n클라이언트에는 이 PC의 IP와 위 포트를 직접 입력해야 합니다.(트레이 아이콘 우클릭 → 접속 주소 복사)"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function SettingsLeave
  ${NSD_GetText} $PortText $PortVal
  ${NSD_GetText} $PassText $PassVal
  ${If} $PortVal < 1
  ${OrIf} $PortVal > 65535
    MessageBox MB_ICONEXCLAMATION "포트는 1 ~ 65535 사이여야 합니다."
    Abort
  ${EndIf}
  StrLen $0 $PassVal
  ${If} $0 < 6
    MessageBox MB_ICONEXCLAMATION "비밀번호는 6자 이상 입력하세요."
    Abort
  ${EndIf}
  ; 포트가 이미 사용 중인지 검사 (업데이트 설치인 경우는 자기 자신일 수 있으므로 건너뜀)
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "DisplayName"
  ${If} $2 == ""
    nsExec::ExecToStack 'cmd /c netstat -ano -p tcp | findstr /R /C:":$PortVal .*LISTENING"'
    Pop $0
    Pop $1
    ${If} $0 == 0
      MessageBox MB_ICONEXCLAMATION|MB_YESNO "포트 $PortVal 을(를) 이미 다른 프로그램이 사용 중입니다.$\r$\n다른 포트를 입력하시겠습니까?$\r$\n(아니오: 그대로 진행)" IDNO +2
      Abort
    ${EndIf}
  ${EndIf}
FunctionEnd

Function OpenAdmin
  ExecShell "open" "http://localhost:$PortVal/admin/"
FunctionEnd

Section "Install"
  SetShellVarContext all
  SetRegView 64
  StrCpy $DataDir "$APPDATA\${APP}\data"

  ; 실행 중이면 중지 (업데이트)
  nsExec::Exec 'schtasks /End /TN "${TASK}"'
  Pop $0
  nsExec::Exec 'taskkill /F /IM ${APP}.exe'
  Pop $0
  IfFileExists "$INSTDIR\killtray.ps1" 0 +3
    nsExec::Exec 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\killtray.ps1"'
    Pop $0
  Sleep 1500

  SetOutPath "$INSTDIR"
  File "/oname=${APP}.exe" "stage\node.exe"
  File /r "stage\src"
  File /r "stage\public"
  File /r "stage\node_modules"
  File "stage\package.json"
  File "stage\tray.ps1"
  File "stage\killtray.ps1"

  CreateDirectory "$DataDir"

  ; 트레이 프로그램이 읽는 포트 정보
  FileOpen $0 "$INSTDIR\port.txt" w
  FileWrite $0 "$PortVal"
  FileClose $0

  ; 실행 스크립트
  FileOpen $0 "$INSTDIR\run.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "set PORT=$PortVal$\r$\n"
  FileWrite $0 "set DATA_DIR=$DataDir$\r$\n"
  FileWrite $0 "del $\"$APPDATA\${APP}\stop.flag$\" 2>nul$\r$\n"
  FileWrite $0 ":loop$\r$\n"
  FileWrite $0 "if exist $\"$APPDATA\${APP}\stop.flag$\" exit /b$\r$\n"
  FileWrite $0 "$\"%~dp0${APP}.exe$\" --no-warnings src\index.js >> $\"$APPDATA\${APP}\server.log$\" 2>&1$\r$\n"
  FileWrite $0 "if exist $\"$APPDATA\${APP}\stop.flag$\" exit /b$\r$\n"
  FileWrite $0 "ping -n 6 127.0.0.1 >nul$\r$\n"
  FileWrite $0 "goto loop$\r$\n"
  FileClose $0

  ; DB 생성 + 관리자 계정 (비밀번호는 환경변수로만 전달, 파일에 저장하지 않음)
  System::Call 'Kernel32::SetEnvironmentVariable(t "ADMIN_PASS", t "$PassVal")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "DATA_DIR", t "$DataDir")i'
  nsExec::ExecToLog '"$INSTDIR\${APP}.exe" --no-warnings "$INSTDIR\src\setup-admin.js"'
  Pop $0
  System::Call 'Kernel32::SetEnvironmentVariable(t "ADMIN_PASS", t "")i'

  ; 방화벽
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${APP} TCP"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${APP} UDP"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall add rule name="${APP} TCP" dir=in action=allow protocol=TCP localport=$PortVal profile=any'
  Pop $0

  ; 부팅 시 자동 실행 (SYSTEM 계정, 로그인 불필요)
  nsExec::Exec 'schtasks /Create /TN "${TASK}" /TR "\"$INSTDIR\run.cmd\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F'
  Pop $0
  nsExec::Exec 'schtasks /Run /TN "${TASK}"'
  Pop $0

  ; 실제로 응답하는지 확인 (최대 20초)
  DetailPrint "서버 응답 확인 중..."
  nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -Command "for($$i=0;$$i -lt 20;$$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:$PortVal/api/playlist -TimeoutSec 2 | Out-Null; exit 0}catch{Start-Sleep 1}}; exit 1"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION "서버가 시작되지 않았습니다.$\r$\n로그: $APPDATA\${APP}\server.log$\r$\n(포트 충돌이 흔한 원인입니다. 제거 후 다른 포트로 다시 설치하세요.)"
  ${EndIf}

  ; 트레이 프로그램: 로그인할 때마다 자동 실행 + 지금 바로 실행
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APP}Tray" 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\tray.ps1"'
  Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\tray.ps1"'

  ; 관리 화면 바로가기
  WriteINIStr "$DESKTOP\스크린세이버 관리.url" "InternetShortcut" "URL" "http://localhost:$PortVal/admin/"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "DisplayName" "스크린세이버 서버"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "Publisher" "Company"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}" "NoModify" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  SetRegView 64
  nsExec::Exec 'schtasks /End /TN "${TASK}"'
  Pop $0
  nsExec::Exec 'schtasks /Delete /TN "${TASK}" /F'
  Pop $0
  nsExec::Exec 'taskkill /F /IM ${APP}.exe'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${APP} TCP"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${APP} UDP"'
  Pop $0
  nsExec::Exec 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\killtray.ps1"'
  Pop $0
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APP}Tray"
  Sleep 1000
  Delete "$DESKTOP\스크린세이버 관리.url"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}"
  RMDir /r "$INSTDIR"
  ; 등록된 콘텐츠/DB($APPDATA\${APP})는 안전을 위해 남겨 둔다
  MessageBox MB_OK "제거되었습니다.$\r$\n등록된 콘텐츠와 DB는 다음 위치에 남겨 두었습니다:$\r$\n$APPDATA\${APP}"
SectionEnd
