@echo off
echo ========================================
echo   Swar Sanchar Development Environment
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Backend Server...
start "SwarSanchar Backend" cmd /k "cd backend && python app.py"

echo [2/3] Starting Frontend Dev Server...
cd frontend
start "SwarSanchar Frontend" cmd /k "npm run dev:react"

echo.
echo ========================================
echo   Servers Starting...
echo   - Backend: http://127.0.0.1:5000
echo   - Frontend: http://localhost:3000
echo ========================================
echo.
echo Wait for React to compile, then open http://localhost:3000 in your browser
echo Or run 'npm start' in frontend folder for Electron app
pause
