@echo off
setlocal enabledelayedexpansion
echo ========================================
echo Swarsanchar - Update from GitHub
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM Check if this is a git repository
if not exist .git (
    echo ERROR: This is not a Git repository
    echo.
    echo To clone the repository, use:
    echo   git clone https://github.com/javagaltejasvi46/SwarSanchar.git
    echo.
    pause
    exit /b 1
)

echo Current branch: 
git branch --show-current
echo.

echo Fetching latest changes from GitHub...
git fetch origin
if %errorlevel% neq 0 (
    echo ERROR: Failed to fetch from GitHub
    echo Check your internet connection and repository access
    pause
    exit /b 1
)

echo.
echo Checking for local changes...

REM Check if there are uncommitted changes
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo WARNING: You have uncommitted changes!
    echo ========================================
    echo.
    git status --short
    echo.
    echo What would you like to do?
    echo.
    echo   1 - Keep my changes and update (stash and restore)
    echo   2 - Discard my changes and update (LOSE ALL CHANGES)
    echo   3 - Cancel update
    echo.
    set /p choice="Enter 1, 2, or 3: "
    
    if "!choice!"=="1" (
        echo.
        echo Saving your changes temporarily...
        git stash push -m "Auto-stash before update"
        if !errorlevel! neq 0 (
            echo ERROR: Failed to save changes
            pause
            exit /b 1
        )
        
        echo Pulling latest version...
        git pull origin main
        if !errorlevel! neq 0 (
            echo ERROR: Failed to pull changes
            echo Restoring your changes...
            git stash pop
            pause
            exit /b 1
        )
        
        echo.
        echo Restoring your changes...
        git stash pop
        if !errorlevel! neq 0 (
            echo WARNING: Could not automatically restore changes
            echo Your changes are saved in stash
            echo Run 'git stash list' to see them
            echo Run 'git stash pop' to restore them manually
        ) else (
            echo Your changes have been restored!
        )
        
    ) else if "!choice!"=="2" (
        echo.
        echo ========================================
        echo DANGER: This will DELETE all your changes!
        echo ========================================
        set /p confirm="Type YES to confirm: "
        if /i not "!confirm!"=="YES" (
            echo Update cancelled
            pause
            exit /b 0
        )
        echo.
        echo Discarding all local changes...
        git reset --hard HEAD
        git clean -fd
        
        echo Pulling latest version...
        git pull origin main
        if !errorlevel! neq 0 (
            echo ERROR: Failed to pull changes
            pause
            exit /b 1
        )
        
    ) else (
        echo.
        echo Update cancelled
        pause
        exit /b 0
    )
) else (
    echo No local changes detected
    echo.
    echo Pulling latest version from GitHub...
    git pull origin main
    if %errorlevel% neq 0 (
        echo ERROR: Failed to pull changes
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Update Complete!
echo ========================================
echo.
echo Latest version has been downloaded from GitHub
echo.

echo ========================================
echo IMPORTANT: Update Dependencies
echo ========================================
echo.
echo After updating code, you should update dependencies:
echo.
echo Option 1 (Recommended): Run full setup
echo   setup_dependencies.bat
echo.
echo Option 2: Update manually
echo   Backend:  cd backend ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
echo   Frontend: cd frontend ^&^& npm install
echo.

set /p update_deps="Would you like to update dependencies now? (y/n): "
if /i "!update_deps!"=="y" (
    echo.
    echo Running dependency update...
    call setup_dependencies.bat
) else (
    echo.
    echo Remember to update dependencies before running the app!
)

echo.
pause
endlocal
