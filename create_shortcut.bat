@echo off
echo ========================================
echo Creating Desktop Shortcut
echo ========================================
echo.

REM Get the current directory (where this script is located)
set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%run_app.bat"
set "ICON=%SCRIPT_DIR%frontend\public\icon.ico"

REM Get the desktop path
set "DESKTOP=%USERPROFILE%\Desktop"

REM Create a VBScript to generate the shortcut
set "VBS_SCRIPT=%TEMP%\create_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%DESKTOP%\Swarsanchar.lnk" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET%" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Swarsanchar Media Suite - Audio Stem Splitter" >> "%VBS_SCRIPT%"
echo oLink.IconLocation = "%ICON%" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

REM Execute the VBScript
cscript //nologo "%VBS_SCRIPT%"

REM Clean up
del "%VBS_SCRIPT%"

echo.
echo ========================================
echo Shortcut created successfully!
echo ========================================
echo.
echo Location: %DESKTOP%\Swarsanchar.lnk
echo.
pause
