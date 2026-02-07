/**
 * Swarsanchar Media Suite - Electron Main Process
 * Handles window management and backend process lifecycle
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Check if running in development
const isDev = !app.isPackaged;

// Disable hardware acceleration to prevent black screen/crashes
app.disableHardwareAcceleration();

let mainWindow;
let backendProcess;
const BACKEND_PORT = 5000;

/**
 * Start the Flask backend process
 */
function startBackend() {
    return new Promise((resolve, reject) => {
        let backendPath;

        if (isDev) {
            // In development, run Python directly
            // In development, run Python from venv to ensure dependencies are loaded
            const venvPython = path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe');
            const pythonPath = venvPython; // Force venv usage
            const scriptPath = path.join(__dirname, '..', 'backend', 'app.py');

            console.log('Starting backend in development mode...');
            backendProcess = spawn(pythonPath, [scriptPath], {
                env: { ...process.env, FLASK_PORT: BACKEND_PORT.toString() },
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } else {
            // In production, run the bundled executable
            backendPath = path.join(process.resourcesPath, 'backend', 'swarsanchar-backend.exe');

            console.log('Starting backend from:', backendPath);
            backendProcess = spawn(backendPath, [], {
                env: { ...process.env, FLASK_PORT: BACKEND_PORT.toString() },
                cwd: path.dirname(backendPath), // Set CWD to backend directory
                stdio: ['pipe', 'pipe', 'pipe']
            });
        }

        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend: ${data}`);
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend Error: ${data}`);
        });

        backendProcess.on('error', (err) => {
            console.error('Failed to start backend:', err);
            reject(err);
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
        });

        // Wait for backend to be ready
        waitForBackend(resolve, reject);
    });
}

/**
 * Wait for the backend to be ready to accept connections
 */
function waitForBackend(resolve, reject, attempts = 0) {
    const maxAttempts = 30;
    const delay = 500;

    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
            console.log('Backend is ready!');
            resolve();
        } else {
            retry();
        }
    });

    req.on('error', () => {
        retry();
    });

    req.setTimeout(1000, () => {
        req.destroy();
        retry();
    });

    function retry() {
        if (attempts < maxAttempts) {
            setTimeout(() => waitForBackend(resolve, reject, attempts + 1), delay);
        } else {
            reject(new Error('Backend failed to start within timeout'));
        }
    }
}

/**
 * Stop the backend process
 */
function stopBackend() {
    if (backendProcess) {
        console.log('Stopping backend...');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
        } else {
            backendProcess.kill('SIGTERM');
        }
        backendProcess = null;
    }
}

/**
 * Create the main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#181611',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#181611',
            symbolColor: '#f2b90d',
            height: 32
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Allow loading local resources (audio files)
        },
        icon: path.join(__dirname, 'public', 'icon.ico'),
        show: false
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-file', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] }
        ]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-folder', async (event, folderPath) => {
    shell.openPath(folderPath);
});

ipcMain.handle('get-backend-url', () => {
    return `http://127.0.0.1:${BACKEND_PORT}`;
});

// App lifecycle
app.whenReady().then(async () => {
    try {
        await startBackend(); // Enable backend auto-start
        createWindow();
    } catch (error) {
        console.error('Failed to start application:', error);
        dialog.showErrorBox('Startup Error',
            'Failed to start the backend server. Please check the logs.');
        app.quit();
    }
});

app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    stopBackend();
});
