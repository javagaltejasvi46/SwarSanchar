import os
import urllib.request
import zipfile
import shutil
import sys
from pathlib import Path

FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
ZIP_PATH = "ffmpeg.zip"
EXTRACT_DIR = "ffmpeg_temp"
DEST_DIR = Path("backend")

def download_with_progress(url, dest):
    """Download file with progress indicator"""
    def reporthook(count, block_size, total_size):
        percent = int(count * block_size * 100 / total_size)
        sys.stdout.write(f"\rDownloading: {percent}%")
        sys.stdout.flush()
    
    urllib.request.urlretrieve(url, dest, reporthook)
    print()  # New line after progress

def download_ffmpeg():
    """Download and extract FFmpeg to backend folder"""
    
    # Check if ffmpeg already exists
    dest_ffmpeg = DEST_DIR / "ffmpeg.exe"
    if dest_ffmpeg.exists():
        print(f"FFmpeg already exists at {dest_ffmpeg}")
        response = input("Do you want to re-download? (y/n): ")
        if response.lower() != 'y':
            print("Skipping download.")
            return True
    
    print(f"Downloading FFmpeg from {FFMPEG_URL}...")
    print("This may take a few minutes (file size ~100MB)...")
    
    try:
        download_with_progress(FFMPEG_URL, ZIP_PATH)
        print("Download complete.")
    except Exception as e:
        print(f"Download failed: {e}")
        print("\nAlternative: You can manually download FFmpeg from:")
        print("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip")
        print(f"Extract it and place ffmpeg.exe in the '{DEST_DIR}' folder")
        return False

    print("Extracting...")
    try:
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(EXTRACT_DIR)
        
        # Find ffmpeg.exe in the extracted files
        found = False
        for root, dirs, files in os.walk(EXTRACT_DIR):
            if "ffmpeg.exe" in files:
                source = Path(root) / "ffmpeg.exe"
                
                # Ensure destination directory exists
                DEST_DIR.mkdir(parents=True, exist_ok=True)
                
                print(f"Moving {source} to {dest_ffmpeg}")
                shutil.move(str(source), str(dest_ffmpeg))
                found = True
                break
        
        if not found:
            print("ERROR: ffmpeg.exe not found in downloaded archive.")
            print("The archive structure may have changed.")
            return False
            
    except Exception as e:
        print(f"Extraction failed: {e}")
        return False
    finally:
        # Cleanup temporary files
        print("Cleaning up temporary files...")
        try:
            if os.path.exists(ZIP_PATH):
                os.remove(ZIP_PATH)
            if os.path.exists(EXTRACT_DIR):
                shutil.rmtree(EXTRACT_DIR)
        except Exception as e:
            print(f"Warning: Cleanup failed: {e}")
    
    if found:
        print("\n" + "="*50)
        print("FFmpeg setup successful!")
        print(f"Location: {dest_ffmpeg}")
        print("="*50)
        return True
    else:
        print("\nFFmpeg setup failed.")
        return False

if __name__ == "__main__":
    success = download_ffmpeg()
    sys.exit(0 if success else 1)
