@echo off
echo ========================================
echo Swarsanchar - Dependency Setup
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/3] Setting up Python virtual environment...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Checking FFmpeg...
cd ..
if exist backend\ffmpeg.exe (
    echo FFmpeg already exists in backend folder
) else (
    echo FFmpeg not found. Downloading...
    python download_ffmpeg.py
    if %errorlevel% neq 0 (
        echo WARNING: FFmpeg download failed
        echo You can manually download it from:
        echo https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
        echo Extract and place ffmpeg.exe in the backend folder
    )
)

echo.
echo [3/3] Installing Node.js dependencies...
cd frontend
call npm install

if %errorlevel% neq 0 (
    echo ERROR: Failed to install Node.js dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.

REM Create desktop shortcut
echo Creating desktop shortcut...
set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%run_app.bat"
set "ICON=%SCRIPT_DIR%frontend\public\icon.ico"
set "DESKTOP=%USERPROFILE%\Desktop"
set "VBS_SCRIPT=%TEMP%\create_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%DESKTOP%\Swarsanchar.lnk" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET%" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Swarsanchar Media Suite - Audio Stem Splitter" >> "%VBS_SCRIPT%"
echo oLink.IconLocation = "%ICON%" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%" >nul 2>&1
del "%VBS_SCRIPT%" >nul 2>&1

if exist "%DESKTOP%\Swarsanchar.lnk" (
    echo Desktop shortcut created successfully!
) else (
    echo Note: Could not create desktop shortcut automatically.
    echo You can run create_shortcut.bat manually to create it.
)

echo.
echo You can now run the application with:
echo   - Desktop shortcut: Swarsanchar
echo   - Or run: run_app.bat
echo   - Build: build.bat
echo.
pause
