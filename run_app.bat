@echo off
title Swarsanchar Media Suite
echo Starting Swarsanchar...

:: 1. Start Backend (in a separate window)
echo Starting Backend Server...
start "Swarsanchar Backend" /min cmd /c "cd backend && python app.py"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: 2. Start Frontend (in this window)
echo Starting Frontend...
cd frontend
npm start
