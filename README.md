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
- FFmpeg (for audio processing)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
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
- **Backend**: Python Flask
- **YouTube**: yt-dlp (actively maintained)
- **AI Splitter**: Demucs (Meta's audio separation)
- **Packaging**: PyInstaller, electron-builder
