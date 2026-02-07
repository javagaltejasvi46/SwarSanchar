@echo off
title Swarsanchar - Install Dependencies
echo ===========================================
echo Swarsanchar Media Suite - Dependency Installer
echo ===========================================
echo.

:: 1. Backend Dependencies
echo [1/2] Installing Backend Dependencies (Python)...
cd backend
if exist requirements.txt (
    pip install -r requirements.txt
) else (
    echo ERROR: backend/requirements.txt not found!
    pause
    exit /b
)
cd ..
echo Backend dependencies installed.
echo.

:: 2. Frontend Dependencies
echo [2/2] Installing Frontend Dependencies (Node.js)...
cd frontend
if exist package.json (
    call npm install
) else (
    echo ERROR: frontend/package.json not found!
    pause
    exit /b
)
cd ..
echo Frontend dependencies installed.
echo.

echo ===========================================
echo Setup Complete!
echo You can now run 'run_app.bat' to start the application.
echo ===========================================
pause
