Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APPNAME "XenoCare Server"
!define VERSION "4.6.0"
!define ROOT "/Users/Kingsolo/projects/xenocare-emr"
!define ICON "${ROOT}/release/build/.icon-ico/icon.ico"

Name "${APPNAME}"
OutFile "${ROOT}/release/build/XenoCare Server Setup ${VERSION}.exe"
InstallDir "$PROGRAMFILES64\XenoCare Server"
InstallDirRegKey HKLM "Software\XenoCare\Server" "InstallDir"
RequestExecutionLevel admin
SetCompressor off
BrandingText "XenoCare Server"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "XenoCare Server" SecMain
  SetOutPath "$INSTDIR"
  File /r "${ROOT}/release/server/*.*"
  File "${ICON}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKLM "Software\XenoCare\Server" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\XenoCare"
  CreateShortcut "$SMPROGRAMS\XenoCare\XenoCare Server.lnk" "$INSTDIR\start-server.cmd" "" "$INSTDIR\icon.ico"
  CreateShortcut "$SMPROGRAMS\XenoCare\Open XenoCare.lnk" "http://127.0.0.1:8080" "" "$INSTDIR\icon.ico"
  CreateShortcut "$DESKTOP\XenoCare Server.lnk" "$INSTDIR\start-server.cmd" "" "$INSTDIR\icon.ico"

  DetailPrint "Starting the XenoCare server setup..."
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\server\install-server.ps1"' $0
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "The server setup did not finish.$\r$\n$\r$\nMake sure Docker Desktop is installed and running, then run this file as Administrator:$\r$\n$INSTDIR\scripts\server\install-server.ps1"
  ${EndIf}
SectionEnd

Section "Uninstall"
  nsExec::Exec 'schtasks /Delete /TN "XenoCare Web Server" /F'
  Delete "$SMPROGRAMS\XenoCare\XenoCare Server.lnk"
  Delete "$SMPROGRAMS\XenoCare\Open XenoCare.lnk"
  RMDir "$SMPROGRAMS\XenoCare"
  Delete "$DESKTOP\XenoCare Server.lnk"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\XenoCareServer"
  DeleteRegKey HKLM "Software\XenoCare\Server"
  RMDir /r "$INSTDIR"
SectionEnd
