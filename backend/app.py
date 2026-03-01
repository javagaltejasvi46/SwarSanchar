"""
Swar Sanchar - FastAPI Backend API
Main application entry point with all REST endpoints
Converted from Flask to FastAPI for better performance and async support
"""

import os
import sys
import shutil
import json
import logging
import subprocess
import asyncio
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Pydantic Request/Response Models
class PathBrowseRequest(BaseModel):
    type: str

class AnalyzePitchRequest(BaseModel):
    file_path: str
    delete_after: bool = False

class ProcessPitchRequest(BaseModel):
    file_path: str
    semitones: float
    output_path: Optional[str] = None

class SplitRequest(BaseModel):
    input_file: str
    stems: int = 2
    format: str = "wav"
    output_path: Optional[str] = None
    model: str = "BS-Roformer-ViperX-1297"

class ExportRequest(BaseModel):
    source_files: List[str]
    output_folder: str
    format: str = "wav"

class ConvertRequest(BaseModel):
    input_path: str

class OpenPathRequest(BaseModel):
    path: str

from fastapi.staticfiles import StaticFiles
from settings import settings_manager, AppSettings

from splitter import splitter_manager, SplitStatus
from analysis import audio_analyzer
from modifier import audio_modifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FFmpeg path detection
def get_ffmpeg_path():
    """Get FFmpeg executable path - check bundled first, then system PATH"""
    # Check if running as PyInstaller bundle
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        bundle_dir = Path(sys._MEIPASS)
        ffmpeg_bundled = bundle_dir / "ffmpeg.exe"
        if ffmpeg_bundled.exists():
            return str(ffmpeg_bundled)
    
    # Check in backend folder (development or manual placement)
    backend_dir = Path(__file__).parent
    ffmpeg_local = backend_dir / "ffmpeg.exe"
    if ffmpeg_local.exists():
        return str(ffmpeg_local)
    
    # Check system PATH
    ffmpeg_system = shutil.which("ffmpeg")
    if ffmpeg_system:
        return ffmpeg_system
    
    # Not found
    logger.warning("FFmpeg not found! Audio conversion features may not work.")
    return "ffmpeg"  # Return default and hope it's in PATH

FFMPEG_PATH = get_ffmpeg_path()
logger.info(f"FFmpeg path: {FFMPEG_PATH}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Clean temp folder and ensure directories exist
    temp_path = Path(settings_manager.settings.system.temp_path)
    # Output path is in splitter settings
    output_path = Path(settings_manager.settings.splitter.output_path)
    
    logger.info("--- Startup Cleanup ---")
    if temp_path.exists():
        try:
            # SAFE CLEANUP: Only remove media files and specific subfolders
            logger.info(f"Safe cleanup started for: {temp_path}")
            
            # 1. Subdirectories to fully purge
            purge_dirs = {'converted', 'processed'}
            
            # 2. Extensions to delete (media only)
            media_exts = {'.wav', '.mp3', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.mp4', '.mkv', '.webm'}

            for item in temp_path.iterdir():
                try:
                    if item.is_dir() and item.name in purge_dirs:
                        shutil.rmtree(item)
                        logger.info(f"Cleaned directory: {item.name}")
                    elif item.is_file() and item.suffix.lower() in media_exts:
                        os.remove(item)
                        logger.info(f"Deleted temp file: {item.name}")
                except Exception as inner_e:
                    logger.warning(f"Could not clean item {item.name}: {inner_e}")
                    
        except Exception as e:
            logger.error(f"Failed to clean temp directory: {e}")
    
    # Re-create and ensure directories
    settings_manager.ensure_directories()
    
    logger.info("Swarsanchar Backend starting up...")
    yield
    # Shutdown
    logger.info("Swarsanchar Backend shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Swarsanchar Media Suite",
    description="Audio Stem Splitter API",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ============================================================================
# Health Check & System Endpoints
# ============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "name": "Swarsanchar Splitter"
    }


@app.get("/api/system/check")
async def system_check():
    """Check system dependencies status"""
    status = {
        "demucs": splitter_manager.check_demucs_available()
    }
    return status








# ============================================================================
# Settings Endpoints
# ============================================================================

@app.get("/api/settings")
def get_settings():
    return settings_manager.settings.to_dict()

@app.put("/api/settings")
def update_settings(new_settings: dict):
    """Update settings and persist to disk"""
    try:
        updated = settings_manager.update(new_settings)
        return {"success": True, "settings": updated.to_dict()}
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/settings/paths/browse")

async def browse_path(data: PathBrowseRequest):
    """Open folder browser dialog (used by frontend)"""
    path_type = data.type
    
    if path_type == "splitter":
        return {"path": settings_manager.settings.splitter.output_path}
    elif path_type == "temp":
        return {"path": settings_manager.settings.system.temp_path}
    
    raise HTTPException(status_code=400, detail="Invalid path type")


# ============================================================================
# Download Endpoints
# ============================================================================




# ============================================================================
# Pitch & Analysis Endpoints
# ============================================================================

@app.post("/api/analyze/pitch")
async def analyze_pitch(data: AnalyzePitchRequest):
    """Detect musical key of audio file"""
    try:
        if not data.file_path or not os.path.exists(data.file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        result = audio_analyzer.detect_key(data.file_path)
        
        # Cleanup if requested
        if data.delete_after and os.path.exists(data.file_path):
            try:
                os.remove(data.file_path)
                logger.info(f"Deleted temp file: {data.file_path}")
            except Exception as del_err:
                logger.warning(f"Failed to delete temp file: {del_err}")

        return result
    except Exception as e:
        logger.error(f"Pitch analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/pitch")
async def process_pitch(data: ProcessPitchRequest):
    """Shift pitch of audio file"""
    try:
        input_path = data.file_path
        if not input_path or not os.path.exists(input_path):
            raise HTTPException(status_code=404, detail="Input file not found")
            
        # Determine output path if not provided
        if not data.output_path:
            # Create a 'processed' folder in temp
            temp_dir = Path(settings_manager.settings.system.temp_path) / "processed"
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Add suffix to filename
            stem = Path(input_path).stem
            suffix = Path(input_path).suffix
            sign = "+" if data.semitones >= 0 else ""
            output_name = f"{stem}_pitch{sign}{data.semitones}{suffix}"
            output_path = temp_dir / output_name
        else:
            output_path = Path(data.output_path)
            
        # Process
        success = audio_modifier.shift_pitch(
            input_path=str(input_path), 
            semitones=data.semitones, 
            output_path=str(output_path)
        )
        
        return {
            "success": success,
            "output_path": str(output_path),
            "semitones": data.semitones
        }
        
    except Exception as e:
        logger.error(f"Pitch processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Splitter Endpoints
# ============================================================================

@app.get("/api/split/models")
async def get_available_models():
    """Get list of available Demucs models"""
    return splitter_manager.AVAILABLE_MODELS


@app.post("/api/split")
async def start_split(data: SplitRequest):
    """Start audio stem separation"""
    try:
        if not data.input_file:
            raise HTTPException(status_code=400, detail="Input file is required")
        
        if not os.path.exists(data.input_file):
            raise HTTPException(status_code=404, detail="Input file not found")
        
        split_id = splitter_manager.start_split(
            input_file=data.input_file,
            stems=data.stems,
            output_format=data.format,
            output_path=data.output_path,
            model=data.model
        )
        
        return {"id": split_id, "status": "started"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting split: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/split/progress/{split_id}")
async def get_split_progress(split_id: str):
    """Get split progress"""
    progress = splitter_manager.get_progress(split_id)
    
    if not progress:
        raise HTTPException(status_code=404, detail="Split job not found")
    
    return {
        "id": progress.id,
        "status": progress.status.value,
        "progress": progress.progress,
        "current_step": progress.current_step,
        "input_file": progress.input_file,
        "stems": progress.stems,
        "output_files": progress.output_files,
        "output_path": progress.output_path,
        "error": progress.error
    }


@app.get("/api/split/progress/{split_id}/stream")
async def stream_split_progress(split_id: str):
    """Stream split progress via Server-Sent Events"""
    async def generate():
        while True:
            progress = splitter_manager.get_progress(split_id)
            if not progress:
                yield f"data: {json.dumps({'error': 'Split job not found'})}\n\n"
                break
            
            data = {
                "id": progress.id,
                "status": progress.status.value,
                "progress": progress.progress,
                "current_step": progress.current_step,
                "output_files": progress.output_files,
                "error": progress.error
            }
            yield f"data: {json.dumps(data)}\n\n"
            
            if progress.status in [SplitStatus.COMPLETED, SplitStatus.FAILED, SplitStatus.CANCELLED]:
                break
            
            await asyncio.sleep(1)
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/split/{split_id}/cancel")
async def cancel_split(split_id: str):
    """Cancel a split operation"""
    success = splitter_manager.cancel_split(split_id)
    return {"success": success}


@app.get("/api/split/check")
async def check_splitter():
    """Check if Demucs is available and ready"""
    return splitter_manager.check_demucs_available()


@app.post("/api/split/export")
async def export_stems(request: ExportRequest):
    """Export/copy stems to a specified folder with optional format conversion"""
    import shutil
    
    try:
        source_files = request.source_files
        output_folder = Path(request.output_folder).resolve()
        output_format = request.format.lower()
        
        if not source_files:
            return {"success": False, "error": "No source files provided"}
        
        # Create output folder if it doesn't exist
        output_folder.mkdir(parents=True, exist_ok=True)
        
        files_saved = 0
        
        for source_file in source_files:
            source_path = Path(source_file).resolve()
            if not source_path.exists():
                logger.warning(f"Source file not found: {source_file}")
                continue
            
            # Determine output filename
            stem_name = source_path.stem
            output_file = output_folder / f"{stem_name}.{output_format}"
            
            # Check if we need format conversion
            source_ext = source_path.suffix.lower().lstrip('.')
            
            # Check if source and destination are the same file
            if source_path == output_file:
                logger.info(f"Source and destination are same, skipping copy for: {source_file}")
                files_saved += 1
                continue

            if source_ext == output_format:
                # Just copy the file
                try:
                    shutil.copy2(source_path, output_file)
                    files_saved += 1
                    logger.info(f"Copied: {source_file} -> {output_file}")
                except shutil.SameFileError:
                    files_saved += 1
                    logger.info(f"Same file error (resolved comparison missed it): {source_file}")
                except PermissionError as e:
                    if "WinError 32" in str(e):
                        logger.warning(f"File locked, skipping copy/overwrite for: {output_file}")
                        # If the output file already exists, we can count it as saved
                        if output_file.exists():
                            files_saved += 1
                        else:
                            raise e
                    else:
                        raise e
            else:
                # Need to convert using ffmpeg
                try:
                    ffmpeg_cmd = [FFMPEG_PATH, "-y", "-i", str(source_path)]
                    
                    if output_format == "mp3":
                        ffmpeg_cmd.extend(["-codec:a", "libmp3lame", "-b:a", "320k"])
                    elif output_format == "flac":
                        ffmpeg_cmd.extend(["-codec:a", "flac"])
                    elif output_format == "wav":
                        ffmpeg_cmd.extend(["-codec:a", "pcm_s16le"])
                    
                    ffmpeg_cmd.append(str(output_file))
                    
                    result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
                    
                    if result.returncode == 0:
                        files_saved += 1
                        logger.info(f"Converted: {source_file} -> {output_file}")
                    else:
                        logger.error(f"FFmpeg error: {result.stderr}")
                        # Fall back to copy if conversion fails and we're not overwriting the same file
                        if source_path != output_folder / source_path.name:
                            shutil.copy2(source_path, output_folder / source_path.name)
                            files_saved += 1
                except Exception as conv_err:
                    logger.error(f"Conversion failed: {conv_err}")
                    if source_path != output_folder / source_path.name:
                        shutil.copy2(source_path, output_folder / source_path.name)
                        files_saved += 1
        
        return {
            "success": True,
            "files_saved": files_saved,
            "output_folder": str(output_folder)
        }
        
    except Exception as e:
        logger.error(f"Export failed: {e}")
        return {"success": False, "error": str(e)}



# ============================================================================
# Conversion Utilities (Fix for Electron/Chromium Decoder Hangs)
# ============================================================================

@app.post("/api/convert/wav")
async def convert_to_wav(data: ConvertRequest):
    """Convert any audio to safe 16-bit PCM WAV"""
    try:
        input_path = Path(data.input_path).resolve()
        if not input_path.exists():
             raise HTTPException(status_code=404, detail="Input file not found")
        
        # Output to temp/processed
        # FORCE ABSOLUTE PATH to prevent "file not found" errors in frontend
        temp_dir = (Path(settings_manager.settings.system.temp_path) / "converted").resolve()
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Create output filename (hash + name to avoid collisions but keep name)
        # Using hash of full path to ensure stability
        import hashlib
        path_hash = hashlib.md5(str(input_path).encode('utf-8')).hexdigest()[:8]
        safe_name = f"{path_hash}_{input_path.stem}.wav"
        output_path = temp_dir / safe_name
        
        # If exists, return cached (unless older than input)
        if output_path.exists():
            if output_path.stat().st_mtime > input_path.stat().st_mtime:
                logger.info(f"Using cached WAV: {output_path}")
                return {"success": True, "output_path": str(output_path)}
        
        # FFmpeg Conversion (Force 16-bit PCM, 44.1kHz for maximum compatibility)
        # -ac 2: Stereo
        # -ar 44100: Sample Rate
        ffmpeg_cmd = [
            FFMPEG_PATH, "-y", 
            "-i", str(input_path),
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "2",
            str(output_path)
        ]
        
        # Run conversion
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg conversion failed: {result.stderr}")
            raise Exception(f"Conversion failed: {result.stderr}")
            
        logger.info(f"Converted to WAV: {input_path} -> {output_path}")
        return {"success": True, "output_path": str(output_path)}
        
    except Exception as e:
        logger.error(f"WAV conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# File Upload (for browser mode)
# ============================================================================

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an audio file for processing (browser mode)"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")
        
        # Check file extension
        allowed_extensions = {'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'}
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'
            )
        
        # Save to temp directory
        temp_dir = Path(settings_manager.settings.system.temp_path)
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Create unique filename
        unique_name = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = temp_dir / unique_name
        
        # Read and save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        logger.info(f"File uploaded: {file_path}")
        
        return {
            "success": True,
            "file_path": str(file_path),
            "filename": file.filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# File Operations
# ============================================================================

@app.get("/api/files/serve")
async def serve_audio_file(path: str = Query(...)):
    """Serve an audio/video file for playback"""
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Get proper MIME type based on extension
        ext = os.path.splitext(path)[1].lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.avi': 'video/x-msvideo',
        }
        media_type = mime_types.get(ext, mimetypes.guess_type(path)[0] or 'application/octet-stream')
        
        return FileResponse(
            path=path,
            media_type=media_type,
            filename=os.path.basename(path)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/open")
async def open_file_location(data: OpenPathRequest):
    """Open file location in explorer"""
    path = data.path
    
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    try:
        if os.path.isfile(path):
            folder = os.path.dirname(path)
        else:
            folder = path
        
        if sys.platform == 'win32':
            os.startfile(folder)
        elif sys.platform == 'darwin':
            subprocess.run(['open', folder])
        else:
            subprocess.run(['xdg-open', folder])
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Static Files & Frontend Serving (Must be last)
# ============================================================================

# Mount static assets if they exist (React build)
# We expect the frontend build to be at ../frontend/build relative to this file
# OR in ./frontend/build if we are in the root
frontend_build_path = Path("frontend/build").resolve()
if not frontend_build_path.exists():
    # Try looking 1 level up if we are in 'backend' dir
    frontend_build_path = Path("../frontend/build").resolve()

if frontend_build_path.exists():
    logger.info(f"Serving frontend from: {frontend_build_path}")
    
    # Mount /static for JS/CSS/Media
    static_assets = frontend_build_path / "static"
    if static_assets.exists():
        app.mount("/static", StaticFiles(directory=str(static_assets)), name="static")

    # Serve other root files (manifest.json, favicon.ico, etc.)
    @app.get("/{file_path:path}")
    async def serve_static_or_index(file_path: str):
        # API calls should fail if not found (already handled by router order)
        if file_path.startswith("api/"):
             raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # Check if file exists in build folder
        target_file = frontend_build_path / file_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
            
        # Fallback to index.html for React Router
        index_path = frontend_build_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
            
        return {"error": "Frontend not found", "path": file_path}

    # Root endpoint
    @app.get("/")
    async def serve_root():
        index_path = frontend_build_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Swarsanchar Backend Running (Frontend index.html not found)"}

else:
    logger.warning("Frontend build directory not found. Running in API-only mode.")


# ============================================================================
# Main Entry Point
# ============================================================================

def get_port():
    """Get port from environment or use default"""
    return int(os.environ.get('FLASK_PORT', os.environ.get('PORT', 5000)))


if __name__ == '__main__':
    import uvicorn
    # STARTUP VERIFICATION BANNER
    print("\n\n" + "="*60)
    import sys
    import shutil
    print("   [V] CORRECT CODEBASE LOADED: SPLITTER ONLY MODE   ")
    print("="*60 + "\n\n")
    
    port = get_port()
    logger.info(f"Starting Swarsanchar Backend on port {port}")

    # FIX for PyInstaller noconsole mode (sys.stdout is None)
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
        
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
