import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

import SplitterPage from './pages/SplitterPage';
import SettingsPage from './pages/SettingsPage';

// API Context for backend communication
const ApiContext = createContext(null);

export const useApi = () => useContext(ApiContext);

// API Provider component
// API Provider component
function ApiProvider({ children }) {
    // Priority: 1. localStorage for overrides, 2. Dynamic determination
    const [backendUrl, setBackendUrl] = useState(() => {
        const stored = localStorage.getItem('swarsanchar_backend_url');
        if (stored) return stored;

        // If running on localhost/127.0.0.1, assume local dev mode (separate ports)
        // If running on a domain (like hf.space), assume same-origin (relative path)
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://127.0.0.1:5000';
        } else {
            return ''; // Relative path for production/same-origin
        }
    });
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const initBackend = async () => {
            try {
                // Standard Web App: Always check default URL or localStorage
                // Removed Electron checks

                // Check connection
                const response = await fetch(`${backendUrl}/api/health`).catch(() => null);
                if (response && response.ok) {
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                }
            } catch (error) {
                console.error('Backend connection error:', error);
                setIsConnected(false);
            }
        };

        initBackend();

        // Poll connection status
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${backendUrl}/api/health`).catch(() => null);
                setIsConnected(response && response.ok);
            } catch {
                setIsConnected(false);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [backendUrl]);

    // Function to update backend URL and persist it
    const changeBackendUrl = (newUrl) => {
        setBackendUrl(newUrl);
        localStorage.setItem('swarsanchar_backend_url', newUrl);
    };

    const api = {
        backendUrl,
        isConnected,
        changeBackendUrl,



        // Split functions
        startSplit: async (options) => {
            const response = await fetch(`${backendUrl}/api/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });
            return response.json();
        },

        getSplitProgress: async (id) => {
            const response = await fetch(`${backendUrl}/api/split/progress/${id}`);
            return response.json();
        },

        checkDemucs: async () => {
            const response = await fetch(`${backendUrl}/api/split/check`);
            return response.json();
        },

        // Settings functions
        getSettings: async () => {
            const response = await fetch(`${backendUrl}/api/settings`);
            return response.json();
        },

        updateSettings: async (settings) => {
            const response = await fetch(`${backendUrl}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            return response.json();
        },

        // System functions
        updateYtdlp: async () => { /* Removed */ },

        analyzePitch: async (filePath, options = {}) => {
            const response = await fetch(`${backendUrl}/api/analyze/pitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath, ...options })
            });
            return response.json();
        },

        processPitch: async (filePath, semitones) => {
            const response = await fetch(`${backendUrl}/api/process/pitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: filePath,
                    semitones: semitones
                })
            });
            return response.json();
        },

        checkSystem: async () => {
            const response = await fetch(`${backendUrl}/api/system/check`);
            return response.json();
        },

        openFolder: async (path) => {
            console.log("Browser mode: Cannot open local folder directly.", path);
            // In web mode, we can't open system folders.
            // Maybe show a toast that files are in their 'Downloads' or specific server folder.
        }
    };

    return (
        <ApiContext.Provider value={api}>
            {children}
        </ApiContext.Provider>
    );
}

// Navigation component
function Navigation() {
    const location = useLocation();
    const api = useApi();

    const navItems = [
        { path: '/', label: 'Splitter', icon: 'call_split' },
        { path: '/settings', label: 'Settings', icon: 'settings' }
    ];

    return (
        <nav className="flex items-center gap-2 no-drag">
            {navItems.map(item => (
                <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium
            ${location.pathname === item.path
                            ? 'bg-surface-dark text-primary border border-primary/30'
                            : 'text-[#bab29c] hover:text-white hover:bg-surface-dark/50'
                        }`}
                >
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    <span className="hidden md:inline">{item.label}</span>
                </Link>
            ))}
            <div className="ml-4 flex items-center gap-2 bg-[#111] px-3 py-1.5 rounded-full border border-[#333] shadow-recessed">
                <div className={`size-2 rounded-full ${api?.isConnected ? 'bg-primary led-active' : 'bg-red-500/50'}`}></div>
                <span className={`text-[10px] font-mono tracking-widest ${api?.isConnected ? 'text-primary' : 'text-red-400'}`}>
                    {api?.isConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>
        </nav>
    );
}

// Main App component
function App() {
    return (
        <ApiProvider>
            <HashRouter>
                <div className="min-h-screen bg-background-dark text-white font-display flex flex-col">
                    {/* Header */}
                    <header className="sticky top-0 flex items-center justify-between px-6 py-3 bg-[#181611] border-b border-[#393528] z-50 shadow-lg">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%274%27 height=%274%27%3E%3Crect width=%274%27 height=%274%27 fill=%27%23181611%27/%3E%3Crect width=%271%27 height=%271%27 fill=%27%23222%27/%3E%3C/svg%3E')] opacity-20 pointer-events-none"></div>

                        <div className="flex items-center gap-4 z-10">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(242,185,13,0.2)] backdrop-blur-sm p-2">
                                <img src={process.env.PUBLIC_URL + '/logo_symbol.png'} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-bold tracking-widest gold-gradient-text uppercase">Swarsanchar</h1>
                                <span className="text-[10px] text-[#666] tracking-[0.2em] font-medium pl-0.5">MEDIA SUITE V2.0</span>
                            </div>
                        </div>

                        <Navigation />
                    </header>

                    {/* Main Content */}
                    <main className="flex-1 overflow-auto">
                        <Routes>
                            <Route path="/" element={<SplitterPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </main>

                    {/* Footer */}
                    <footer className="h-8 bg-[#1f1d16] border-t border-[#393528] flex items-center justify-between px-4 text-xs text-[#bab29c] shrink-0">
                        <div className="flex gap-4">
                            <span>SYS: READY</span>
                            <span className="text-primary">Engine v2.0</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">copyright</span>
                            <span>Swarsanchar Media Suite</span>
                        </div>
                    </footer>
                </div>
            </HashRouter>
        </ApiProvider>
    );
}

export default App;
