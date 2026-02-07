import os
import urllib.request
import zipfile
import shutil
from pathlib import Path

FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
ZIP_PATH = "ffmpeg.zip"
EXTRACT_DIR = "ffmpeg_temp"
DEST_DIR = Path("backend")

def download_ffmpeg():
    print(f"Downloading FFmpeg from {FFMPEG_URL}...")
    try:
        urllib.request.urlretrieve(FFMPEG_URL, ZIP_PATH)
        print("Download complete.")
    except Exception as e:
        print(f"Download failed: {e}")
        return

    print("Extracting...")
    try:
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(EXTRACT_DIR)
        
        # Find ffmpeg.exe
        found = False
        for root, dirs, files in os.walk(EXTRACT_DIR):
            if "ffmpeg.exe" in files:
                source = Path(root) / "ffmpeg.exe"
                dest = DEST_DIR / "ffmpeg.exe"
                print(f"Moving {source} to {dest}")
                shutil.move(str(source), str(dest))
                found = True
                break
        
        if not found:
            print("ffmpeg.exe not found in downloaded archive.")
    except Exception as e:
        print(f"Extraction failed: {e}")
    finally:
        # Cleanup
        print("Cleaning up...")
        if os.path.exists(ZIP_PATH):
            os.remove(ZIP_PATH)
        if os.path.exists(EXTRACT_DIR):
            shutil.rmtree(EXTRACT_DIR)
        
    if found:
        print("FFmpeg setup successful!")
    else:
        print("FFmpeg setup failed.")

if __name__ == "__main__":
    download_ffmpeg()
