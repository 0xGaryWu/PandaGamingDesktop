Option Explicit

Dim argument, command, exitCode
command = "cmd /d /c scrcpy.exe"

For Each argument In WScript.Arguments
    command = command & " """ & Replace(argument, Chr(34), Chr(34) & Chr(34)) & """"
Next

exitCode = CreateObject("WScript.Shell").Run(command, 0, True)
WScript.Quit exitCode
