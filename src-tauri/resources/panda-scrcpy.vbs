Option Explicit
On Error Resume Next

Dim argument, command, exitCode, fileSystem, logFile, logPath, index
logPath = WScript.Arguments(0)
command = "cmd /d /c scrcpy.exe"

For index = 1 To WScript.Arguments.Count - 1
    argument = WScript.Arguments(index)
    command = command & " """ & Replace(argument, Chr(34), Chr(34) & Chr(34)) & """"
Next

command = command & " >""" & Replace(logPath, Chr(34), Chr(34) & Chr(34)) & """ 2>&1"
Err.Clear
exitCode = CreateObject("WScript.Shell").Run(command, 0, True)

If Err.Number <> 0 Then
    Set fileSystem = CreateObject("Scripting.FileSystemObject")
    Set logFile = fileSystem.OpenTextFile(logPath, 8, True)
    logFile.WriteLine "Panda launcher error " & Err.Number & ": " & Err.Description
    logFile.Close
    WScript.Quit 1
End If

WScript.Quit exitCode
