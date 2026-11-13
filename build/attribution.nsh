!macro customInstall
  FileOpen $0 "$INSTDIR\resources\download-name.txt" w
  FileWrite $0 "$EXEFILE"
  FileClose $0
!macroend
