@echo off
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
    echo   git clone [YOUR_GITHUB_REPO_URL]
    echo.
    pause
    exit /b 1
)

echo Checking current branch...
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
echo Checking for uncommitted changes...
git status --short
echo.

REM Check if there are uncommitted changes
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo WARNING: You have uncommitted changes!
    echo.
    echo Options:
    echo   1. Stash changes and pull (recommended)
    echo   2. Discard local changes and pull (DANGEROUS)
    echo   3. Cancel update
    echo.
    set /p choice="Enter your choice (1/2/3): "
    
    if "!choice!"=="1" (
        echo.
        echo Stashing local changes...
        git stash push -m "Auto-stash before update on %date% %time%"
        if %errorlevel% neq 0 (
            echo ERROR: Failed to stash changes
            pause
            exit /b 1
        )
        echo Changes stashed successfully
        echo To restore them later, run: git stash pop
    ) else if "!choice!"=="2" (
        echo.
        echo WARNING: This will discard ALL local changes!
        set /p confirm="Are you sure? Type YES to confirm: "
        if /i not "!confirm!"=="YES" (
            echo Update cancelled
            pause
            exit /b 0
        )
        echo Discarding local changes...
        git reset --hard HEAD
        git clean -fd
    ) else (
        echo Update cancelled
        pause
        exit /b 0
    )
)

echo.
echo Pulling latest changes...
git pull origin
if %errorlevel% neq 0 (
    echo ERROR: Failed to pull changes
    echo.
    echo This might be due to:
    echo   - Merge conflicts
    echo   - Network issues
    echo   - Repository access issues
    echo.
    echo Try resolving manually with:
    echo   git status
    echo   git pull
    pause
    exit /b 1
)

echo.
echo ========================================
echo Update Complete!
echo ========================================
echo.
echo Latest changes have been pulled from GitHub
echo.

REM Check if dependencies need updating
echo Checking if dependencies need updating...
echo.

if exist backend\requirements.txt (
    echo Python dependencies may need updating
    echo Run: cd backend ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
    echo.
)

if exist frontend\package.json (
    echo Node.js dependencies may need updating
    echo Run: cd frontend ^&^& npm install
    echo.
)

echo To update all dependencies, run:
echo   setup_dependencies.bat
echo.
pause
