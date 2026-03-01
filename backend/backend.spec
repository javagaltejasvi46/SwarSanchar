# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all
import os
from pathlib import Path

# Check if ffmpeg.exe exists in backend folder
ffmpeg_path = Path('ffmpeg.exe')
if ffmpeg_path.exists():
    datas = [('ffmpeg.exe', '.')]
    print(f"Including FFmpeg: {ffmpeg_path.absolute()}")
else:
    datas = []
    print("WARNING: ffmpeg.exe not found! Run download_ffmpeg.py first.")
    print("The application will try to use system FFmpeg if available.")

binaries = []
hiddenimports = [
    'sklearn.utils._cython_blas', 
    'sklearn.neighbors.typedefs',
    'sklearn.neighbors.quad_tree',
    'sklearn.tree._utils',
    'scipy.special.cython_special',
    'torchaudio',
    'demucs',
    'demucs.apply',
    'demucs.separate',
    'librosa',
    'soundfile'
]

# Collect all resources for complex packages
tmp_ret = collect_all('torchaudio')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('demucs')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('librosa')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('audio_separator')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PySide2', 'PyQt6', 'PySide6', 'tkinter', 'IPython', 'pytest', 'pycparser'],
    noarchive=False,
)
pyz = PYZ(a.pure)

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
    console=False, # Windowed mode (no terminal)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='swarsanchar-backend',
)
