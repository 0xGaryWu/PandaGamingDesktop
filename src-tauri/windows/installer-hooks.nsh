!macro StopPandaAdbServer
  IfFileExists "$INSTDIR\tools\adb.exe" 0 +3
    DetailPrint "Stopping the bundled ADB server before updating files..."
    nsExec::ExecToLog '"$INSTDIR\tools\adb.exe" kill-server'

  IfFileExists "$INSTDIR\resources\tools\adb.exe" 0 +3
    DetailPrint "Stopping the bundled ADB server before updating files..."
    nsExec::ExecToLog '"$INSTDIR\resources\tools\adb.exe" kill-server'

  Sleep 800
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro StopPandaAdbServer
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro StopPandaAdbServer
!macroend
