```
---
title: Swarsanchar Media Suite
emoji: 🎵
colorFrom: yellow
colorTo: black
sdk: docker
app_port: 7860
pinned: false
---

# Swar Sanchar Media Suite v2.0

Hi-Fi Audio/Video Downloader & AI Stem Splitter

## Features

- **YouTube Downloader**: Download videos and audio from YouTube with format selection
- **AI Stem Splitter**: Separate audio into 2 or 4 stems using Demucs AI
- **Settings Management**: Configure output paths, defaults, and update dependencies

## Project Structure

```
Swarsanchar final/
├── backend/                    # Python Flask Backend
│   ├── app.py                 # Main Flask API
│   ├── downloader.py          # yt-dlp integration
│   ├── splitter.py            # Demucs integration
│   ├── settings.py            # Configuration manager
│   ├── requirements.txt       # Python dependencies
│   └── swarsanchar.spec       # PyInstaller spec
│
└── frontend/                   # Electron + React Frontend
    ├── main.js                # Electron main process
    ├── preload.js             # IPC bridge
    ├── package.json           # NPM config & build scripts
    ├── tailwind.config.js     # Tailwind theme
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js             # Main app with routing
        ├── index.js           # React entry point
        ├── index.css          # Global styles
        └── pages/
            ├── DownloaderPage.js
            ├── SplitterPage.js
            └── SettingsPage.js
```

## Development Setup

### Prerequisites

- Node.js 18+ 
- Python 3.8+
- FFmpeg (automatically downloaded by setup script)

### Quick Setup (Recommended)

```bash
# Run the automated setup script
setup_dependencies.bat

# This will:
# 1. Create Python virtual environment
# 2. Install Python dependencies
# 3. Download FFmpeg (if missing)
# 4. Install Node.js dependencies
```

### Manual Setup

#### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

#### Download FFmpeg

```bash
# From project root
python download_ffmpeg.py
```

This will download FFmpeg 8.0.1 to the `backend/` folder.

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Troubleshooting

If you encounter issues, run the troubleshooting tool:

```bash
troubleshoot.bat
```

Or test the backend directly:

```bash
python test_backend.py
```

## Building for Production

### Build Backend Executable

```bash
cd backend
venv\Scripts\activate
pyinstaller swarsanchar.spec
```

### Build Electron Installer

```bash
cd frontend
npm run dist
```

The installer will be created in `frontend/dist/`.

## Technologies

- **Frontend**: Electron, React, TailwindCSS
- **Backend**: Python FastAPI
- **AI Splitter**: BS-RoFormer via audio-separator (Meta's audio separation)
- **Audio Processing**: librosa, torchaudio, soundfile
- **Pitch Detection**: librosa with Krumhansl-Schmuckler algorithm
- **Packaging**: PyInstaller, electron-builder

## Recent Bug Fixes (March 2026)

### Critical Issues Resolved:
1. ✅ **FFmpeg Dependency** - Automated download and bundling
2. ✅ **Missing Logger** - Proper logging initialization
3. ✅ **Pydantic Models** - All API request/response models defined
4. ✅ **soundfile Dependency** - Added to requirements
5. ✅ **Path Detection** - Smart FFmpeg path resolution (bundled/local/system)

### New Tools:
- `setup_dependencies.bat` - Automated setup script
- `troubleshoot.bat` - System diagnostics tool
- `test_backend.py` - Backend verification script
- `download_ffmpeg.py` - Enhanced FFmpeg downloader

See `BUG_FIXES_APPLIED.md` for detailed information.
