@echo off
echo ========================================
echo Swarsanchar Media Suite - Build Script
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo [1/4] Installing Python dependencies...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

echo [2/4] Building Python backend executable...
pyinstaller swarsanchar.spec --noconfirm
if %errorlevel% neq 0 (
    echo ERROR: Failed to build backend executable
    pause
    exit /b 1
)
call deactivate
cd ..

echo [3/4] Installing Node.js dependencies...
cd frontend
call npm install --silent
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo [4/4] Building Electron installer...
call npm run dist
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Electron installer
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Installer location: frontend\dist\
echo.
pause
