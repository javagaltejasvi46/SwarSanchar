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
echo You can now run the application with:
echo   - Development: run_app.bat
echo   - Build: build.bat
echo.
pause
