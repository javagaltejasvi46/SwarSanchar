# -*- mode: python ; coding: utf-8 -*-
"""
Swar Sanchar Backend - PyInstaller Spec File
Creates a standalone executable for the Flask backend
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all required data and hidden imports
demucs_imports = collect_submodules('demucs')
torch_imports = collect_submodules('torch')
torchaudio_imports = collect_submodules('torchaudio')

hidden_imports = [
    'yt_dlp',
    'flask',
    'flask_cors',
    'pydantic',
    'engineio.async_drivers.threading',
] + demucs_imports + torch_imports + torchaudio_imports

# Collect data files
demucs_data = collect_data_files('demucs')

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=demucs_data,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'notebook',
        'jupyter',
        'PIL',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='swarsanchar-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Keep console for debugging, can be set to False for release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../frontend/public/icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='swarsanchar-backend',
)
