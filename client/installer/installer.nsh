; electron-builder NSIS 사용자 정의: 서버 주소 입력 페이지 + 화면 보호기 등록
!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var SrvText
Var SrvVal

Function ServerPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 24u "콘텐츠를 가져올 서버의 주소와 포트를 입력하세요.$\r$\n예: http://192.168.0.10:8080"
  Pop $0
  ${NSD_CreateText} 0 34u 100% 12u "http://"
  Pop $SrvText
  nsDialogs::Show
FunctionEnd

; 스택의 문자열에 " \ 공백이 있으면 "1", 없으면 "0" 을 스택에 남긴다
Function ContainsBadChar
  Exch $R0
  Push $R1
  Push $R2
  StrCpy $R1 0
  loop:
    StrCpy $R2 $R0 1 $R1
    StrCmp $R2 "" ok
    StrCmp $R2 '"' bad
    StrCmp $R2 "\" bad
    StrCmp $R2 " " bad
    IntOp $R1 $R1 + 1
    Goto loop
  bad:
    StrCpy $R0 "1"
    Goto done
  ok:
    StrCpy $R0 "0"
  done:
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

Function ServerPageLeave
  ${NSD_GetText} $SrvText $SrvVal
  StrCpy $0 $SrvVal 7
  StrCpy $1 $SrvVal 8
  ${If} $0 != "http://"
  ${AndIf} $1 != "https://"
    MessageBox MB_ICONEXCLAMATION "주소는 http:// 또는 https:// 로 시작해야 합니다.$\r$\n예: http://192.168.0.10:8080"
    Abort
  ${EndIf}
  ; 설정 파일(JSON)을 깨뜨리는 문자 차단
  StrCpy $3 $SrvVal
  ${If} $3 != ""
    Push $SrvVal
    Call ContainsBadChar
    Pop $4
    ${If} $4 == "1"
      MessageBox MB_ICONEXCLAMATION "주소에 사용할 수 없는 문자(따옴표, 역슬래시, 공백)가 있습니다."
      Abort
    ${EndIf}
  ${EndIf}
  StrLen $2 $SrvVal
  ${If} $2 < 12
    MessageBox MB_ICONEXCLAMATION "서버 주소를 끝까지 입력하세요.$\r$\n예: http://192.168.0.10:8080"
    Abort
  ${EndIf}
FunctionEnd
!endif

!macro customWelcomePage
  Page custom ServerPageCreate ServerPageLeave
!macroend

!macro customInit
  nsExec::Exec 'taskkill /F /IM "${PRODUCT_FILENAME}.exe"'
  Pop $0
!macroend

!macro customInstall
  ; 설정 파일
  CreateDirectory "$LOCALAPPDATA\CompanySaver"
  FileOpen $0 "$LOCALAPPDATA\CompanySaver\config.json" w
  FileWrite $0 '{"serverUrl":"$SrvVal","pollMinutes":10}'
  FileClose $0
  ; exe -> .scr (하드링크, 실패 시 복사)
  Delete "$INSTDIR\${PRODUCT_FILENAME}.scr"
  nsExec::Exec 'cmd /c mklink /H "$INSTDIR\${PRODUCT_FILENAME}.scr" "$INSTDIR\${PRODUCT_FILENAME}.exe"'
  Pop $0
  ${If} $0 != 0
    CopyFiles /SILENT "$INSTDIR\${PRODUCT_FILENAME}.exe" "$INSTDIR\${PRODUCT_FILENAME}.scr"
  ${EndIf}
  ; 현재 사용자 화면 보호기로 등록 (대기 10분)
  WriteRegStr HKCU "Control Panel\Desktop" "SCRNSAVE.EXE" "$INSTDIR\${PRODUCT_FILENAME}.scr"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "1"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveTimeOut" "600"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaverIsSecure" "0"
  ; 실행 중인 Windows에도 즉시 반영 (레지스트리만 바꾸면 화면 보호기 설정 창이 옛 값을 보여 줄 수 있음)
  System::Call 'user32::SystemParametersInfoW(i 17, i 1, i 0, i 3)'
  System::Call 'user32::SystemParametersInfoW(i 15, i 600, i 0, i 3)'
!macroend

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM "${PRODUCT_FILENAME}.exe"'
  Pop $0
  Delete "$INSTDIR\${PRODUCT_FILENAME}.scr"
  DeleteRegValue HKCU "Control Panel\Desktop" "SCRNSAVE.EXE"
  WriteRegStr HKCU "Control Panel\Desktop" "ScreenSaveActive" "0"
  System::Call 'user32::SystemParametersInfoW(i 17, i 0, i 0, i 3)'
  RMDir /r "$LOCALAPPDATA\CompanySaver"
!macroend
