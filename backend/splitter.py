"""
Swar Sanchar - Audio Splitter Module
Uses BS-RoFormer via audio-separator for AI-powered audio stem separation
"""

import os
import re
import sys
import uuid
import logging
import threading
import subprocess
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Dict, List, Callable
from enum import Enum
from io import StringIO

from settings import settings_manager

logger = logging.getLogger(__name__)

# FFmpeg path detection
def get_ffmpeg_path():
    """Get FFmpeg executable path"""
    if getattr(sys, 'frozen', False):
        bundle_dir = Path(sys._MEIPASS)
        ffmpeg_bundled = bundle_dir / "ffmpeg.exe"
        if ffmpeg_bundled.exists():
            return str(ffmpeg_bundled)
    
    backend_dir = Path(__file__).parent
    ffmpeg_local = backend_dir / "ffmpeg.exe"
    if ffmpeg_local.exists():
        return str(ffmpeg_local)
    
    ffmpeg_system = shutil.which("ffmpeg")
    if ffmpeg_system:
        return ffmpeg_system
    
    return "ffmpeg"

FFMPEG_PATH = get_ffmpeg_path()


class TqdmProgressCapture:
    """Captures tqdm progress output and calls a callback with percent progress"""
    
    def __init__(self, callback: Callable[[float, str], None] = None):
        self.callback = callback
        self.original_stderr = sys.stderr
        self.original_stdout = sys.stdout
        self.buffer = StringIO()
        self.last_percent = 0
        
    def write(self, text):
        # Write to original stderr for logging
        self.original_stderr.write(text)
        
        # Parse tqdm progress: "  2%|▎                | 1/46 [03:27<2:35:20, 207.13s/it]"
        if text.strip():
            # Try to extract percentage
            percent_match = re.search(r'(\d+)%\|', text)
            if percent_match:
                percent = int(percent_match.group(1))
                if percent != self.last_percent:
                    self.last_percent = percent
                    # Scale 0-100% of separation to 35-90% of total progress
                    scaled_progress = 35 + (percent * 0.55)
                    if self.callback:
                        self.callback(scaled_progress, f"Separating stems... {percent}%")
    
    def flush(self):
        self.original_stderr.flush()
        
    def __enter__(self):
        sys.stderr = self
        return self
        
    def __exit__(self, *args):
        sys.stderr = self.original_stderr


class SplitStatus(Enum):
    PENDING = "pending"
    LOADING = "loading"
    PROCESSING = "processing"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class SplitProgress:
    """Tracks stem separation progress"""
    id: str
    status: SplitStatus = SplitStatus.PENDING
    progress: float = 0.0
    current_step: str = ""
    input_file: str = ""
    stems: int = 4
    output_files: List[str] = None
    output_path: str = ""
    error: str = ""
    
    def __post_init__(self):
        if self.output_files is None:
            self.output_files = []


class SplitterManager:
    """Manages audio stem separation using BS-RoFormer via audio-separator"""
    
    STEM_NAMES_4 = ['vocals', 'drums', 'bass', 'other']
    STEM_NAMES_2 = ['vocals', 'instrumental']
    
    # Available BS-RoFormer models with descriptions and correct filenames
    AVAILABLE_MODELS = {
        'BS-Roformer-ViperX-1297': {
            'name': 'BS-RoFormer ViperX 1297',
            'description': 'Best quality BS-RoFormer model - state-of-the-art vocal separation',
            'quality': 'Excellent',
            'stems': 2,
            'model_type': 'bs_roformer',
            'filename': 'model_bs_roformer_ep_317_sdr_12.9755.ckpt'
        },
        'BS-Roformer-ViperX-1296': {
            'name': 'BS-RoFormer ViperX 1296',
            'description': 'Alternative checkpoint with excellent quality',
            'quality': 'Excellent',
            'stems': 2,
            'model_type': 'bs_roformer',
            'filename': 'model_bs_roformer_ep_368_sdr_12.9628.ckpt'
        },
        'mel_band_roformer': {
            'name': 'Mel-Band RoFormer',
            'description': 'Mel-band variant with very high quality',
            'quality': 'Very High',
            'stems': 2,
            'model_type': 'mel_band_roformer',
            'filename': 'mel_band_roformer_kim_ft_unwa.ckpt'
        },
        'htdemucs': {
            'name': 'HT Demucs (Fallback)',
            'description': 'Hybrid Demucs model - 4 stem separation',
            'quality': 'High',
            'stems': 4,
            'model_type': 'htdemucs',
            'filename': 'htdemucs_ft.yaml'
        }
    }
    
    def __init__(self):
        self.splits: Dict[str, SplitProgress] = {}
        self._lock = threading.Lock()
        self._separator_available = None
    
    def check_demucs_available(self) -> Dict[str, any]:
        """Check if audio-separator is available and return status"""
        try:
            from audio_separator.separator import Separator
            import torch
            
            cuda_available = torch.cuda.is_available()
            device = "cuda" if cuda_available else "cpu"
            
            return {
                'available': True,
                'library': 'audio-separator',
                'model': 'BS-RoFormer',
                'cuda_available': cuda_available,
                'device': device,
                'torch_version': torch.__version__
            }
        except ImportError as e:
            return {
                'available': False,
                'error': str(e)
            }
    
    def get_progress(self, split_id: str) -> Optional[SplitProgress]:
        """Get split progress by ID"""
        return self.splits.get(split_id)
    
    def start_split(
        self,
        input_file: str,
        stems: int = 2,  # BS-RoFormer primarily does 2-stem (vocals/instrumental)
        output_format: str = "wav",
        output_path: Optional[str] = None,
        model: str = "BS-Roformer-ViperX-1297"  # Default to best BS-RoFormer
    ) -> str:
        """Start stem separation and return the split ID"""
        split_id = str(uuid.uuid4())
        
        # Validate input file exists
        if not os.path.exists(input_file):
            raise FileNotFoundError(f"Input file not found: {input_file}")
        
        # Get output path from settings if not provided
        if not output_path:
            output_path = settings_manager.settings.splitter.output_path
        
        # Create output directory
        Path(output_path).mkdir(parents=True, exist_ok=True)
        
        # Create progress tracker
        progress = SplitProgress(
            id=split_id,
            status=SplitStatus.PENDING,
            input_file=input_file,
            stems=stems,
            output_path=output_path
        )
        self.splits[split_id] = progress
        
        # Start processing in background thread
        thread = threading.Thread(
            target=self._split_thread,
            args=(split_id, input_file, stems, output_format, output_path, model)
        )
        thread.daemon = True
        thread.start()
        
        return split_id
    
    def _split_thread(
        self,
        split_id: str,
        input_file: str,
        stems: int,
        output_format: str,
        output_path: str,
        model: str = "BS-Roformer-ViperX-1297"
    ):
        """Background thread for stem separation using BS-RoFormer"""
        progress = self.splits.get(split_id)
        if not progress:
            return
        
        try:
            progress.status = SplitStatus.LOADING
            progress.current_step = f"Loading {model} model..."
            progress.progress = 5
            
            # Import audio-separator
            from audio_separator.separator import Separator
            import torch
            
            # Validate model
            if model not in self.AVAILABLE_MODELS:
                model = "BS-Roformer-ViperX-1297"  # Fallback to best model
            
            model_info = self.AVAILABLE_MODELS[model]
            
            # Determine device
            use_gpu = torch.cuda.is_available() and settings_manager.settings.system.use_gpu
            
            # Create output subdirectory based on input filename
            input_name = Path(input_file).stem
            output_dir = Path(output_path) / input_name
            output_dir.mkdir(parents=True, exist_ok=True)
            
            progress.progress = 15
            progress.current_step = "Initializing separator..."
            
            # Initialize separator with appropriate model
            # The audio-separator library handles model downloading automatically
            separator = Separator(
                output_dir=str(output_dir),
                output_format=output_format.upper(),
            )
            
            progress.progress = 25
            progress.current_step = f"Loading {model_info['name']}..."
            
            # Load the model using the correct filename from model info
            model_filename = model_info.get('filename', 'model_bs_roformer_ep_317_sdr_12.9755.ckpt')
            logger.info(f"Loading model: {model_filename}")
            separator.load_model(model_filename=model_filename)
            
            progress.status = SplitStatus.PROCESSING
            progress.current_step = "Separating stems with BS-RoFormer AI..."
            progress.progress = 35
            
            logger.info(f"Processing {input_file} with {model} (CPU Mode)")
            
            # Create progress callback to update our progress object
            def update_progress(pct, step_text):
                progress.progress = pct
                progress.current_step = step_text
            
            # Perform separation with progress capture
            logger.info(f"Starting separation for: {input_file}")
            
            with TqdmProgressCapture(callback=update_progress):
                output_files_result = separator.separate(input_file)
            
            # Log the raw result
            logger.info(f"Separator returned: {output_files_result}")
            logger.info(f"Output directory: {output_dir}")
            
            progress.progress = 90
            progress.current_step = "Finalizing output files..."
            progress.status = SplitStatus.FINALIZING
            
            # Get the output files - check what separator returned
            output_files = []
            
            # Method 1: Check files returned by separator
            if output_files_result:
                for output_file in output_files_result:
                    if output_file and os.path.exists(output_file):
                        output_files.append(output_file)
                        logger.info(f"Found from separator: {output_file}")
            
            # Method 2: If no files found, scan the output directory
            if not output_files:
                logger.info(f"Scanning output directory for files: {output_dir}")
                for root, dirs, files in os.walk(output_dir):
                    for file in files:
                        if file.endswith(('.wav', '.mp3', '.flac')):
                            file_path = os.path.join(root, file)
                            output_files.append(file_path)
                            logger.info(f"Found in directory: {file_path}")
            
            progress.output_files = output_files
            progress.status = SplitStatus.COMPLETED
            progress.progress = 100
            progress.current_step = "Complete!"
            
            logger.info(f"Split completed: {len(output_files)} stems created")
            
        except Exception as e:
            logger.error(f"Split failed: {e}")
            progress.status = SplitStatus.FAILED
            progress.error = str(e)
    
    def _convert_to_mp3(self, input_path: str, output_path: str, bitrate: str = "320k"):
        """Convert audio file to MP3 using FFmpeg"""
        try:
            subprocess.run([
                FFMPEG_PATH, '-y', '-i', input_path,
                '-codec:a', 'libmp3lame', '-b:a', bitrate,
                output_path
            ], capture_output=True, check=True)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"FFmpeg conversion failed: {e.stderr.decode()}")
    
    def cancel_split(self, split_id: str) -> bool:
        """Cancel a split operation"""
        progress = self.splits.get(split_id)
        if progress and progress.status in [SplitStatus.PENDING, SplitStatus.LOADING, SplitStatus.PROCESSING]:
            progress.status = SplitStatus.CANCELLED
            return True
        return False


# Global splitter manager instance
splitter_manager = SplitterManager()
