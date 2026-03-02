@echo off
title Swarsanchar - Install Dependencies
echo ===========================================
echo Swarsanchar Media Suite - Dependency Installer
echo ===========================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Setting up Python virtual environment...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python dependencies...
echo This may take a few minutes...
pip install --upgrade pip

REM Install core dependencies first
pip install fastapi uvicorn python-multipart torch torchaudio onnxruntime librosa numpy scipy soundfile pydantic python-dotenv requests urllib3 pyinstaller

REM Install audio-separator without problematic dependencies
pip install --no-deps audio-separator

REM Install audio-separator dependencies manually (skip diffq-fixed)
pip install beartype==0.18.5 einops julius ml_collections pydub resampy "rotary-embedding-torch<0.7.0,>=0.6.1" samplerate==0.1.0 six tqdm onnx-weekly

if %errorlevel% neq 0 (
    echo WARNING: Some dependencies may have failed to install
    echo The app should still work for basic features
)

cd ..
echo Backend dependencies installed.
echo.

echo [2/4] Checking FFmpeg...
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

echo [3/4] Installing Frontend Dependencies (Node.js)...
cd frontend
if exist package.json (
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Node.js dependencies
        cd ..
        pause
        exit /b 1
    )
) else (
    echo ERROR: frontend/package.json not found!
    cd ..
    pause
    exit /b 1
)
cd ..
echo Frontend dependencies installed.
echo.

echo [4/4] Creating desktop shortcut...
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

echo ===========================================
echo Setup Complete!
echo ===========================================
echo.
echo You can now run the application with:
echo   - Desktop shortcut: Swarsanchar
echo   - Or run: run_app.bat
echo ===========================================
pause
