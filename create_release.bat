@echo off
title Create Release
echo Creating Swarsanchar Release Build...

set RELEASE_DIR=release_v2

:: 1. Create Release Directory
if exist %RELEASE_DIR% rd /s /q %RELEASE_DIR%
mkdir %RELEASE_DIR%

:: 2. Copy Backend (Excluding junk)
echo Copying Backend...
mkdir "%RELEASE_DIR%\backend"
robocopy "backend" "%RELEASE_DIR%\backend" /E /XD "__pycache__" "venv" "dist" "build" "temp" ".git" /XF "*.spec" "*.log"

:: 3. Copy Frontend (Excluding node_modules and build artifacts)
echo Copying Frontend...
mkdir "%RELEASE_DIR%\frontend"
robocopy "frontend" "%RELEASE_DIR%\frontend" /E /XD "node_modules" "build" "dist" ".git" /XF ".env" ".DS_Store"

:: 4. Copy Root Scripts
echo Copying Startup Scripts...
copy "run_app.bat" "%RELEASE_DIR%\"
copy "install_deps.bat" "%RELEASE_DIR%\"

:: 5. Create Readme
echo Creating README...
(
echo Swarsanchar Media Suite v2.0
echo ============================
echo.
echo INSTALLATION:
echo 1. Run 'install_deps.bat' to install all requirements.
echo.
echo RUNNING:
echo 1. Double-click 'run_app.bat' to start the application.
echo.
echo Requirements:
echo - Python 3.10+
echo - Node.js 18+
) > "%RELEASE_DIR%\README.txt"

echo.
echo ========================================================
echo Release created in: %RELEASE_DIR%
echo You can now zip this folder and share it.
echo ========================================================
pause
