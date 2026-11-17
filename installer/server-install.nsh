!include "LogicLib.nsh"

!macro customInstall
  DetailPrint "Setting up the XenoCare database and web server..."
  ExecWait 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\server\scripts\server\install-server.ps1"' $0
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "The server setup did not finish.$\r$\n$\r$\nSee the log for the exact reason:$\r$\nC:\ProgramData\XenoCare\install.log$\r$\n$\r$\nAfter fixing it, run this file as Administrator:$\r$\n$INSTDIR\resources\server\scripts\server\install-server.ps1"
  ${EndIf}
!macroend

!macro customUnInstall
  nsExec::Exec 'schtasks /Delete /TN "XenoCare Web Server" /F'
!macroend
