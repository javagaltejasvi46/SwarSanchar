"""
Swarsanchar - Audio Modifier Module
Handles high-quality pitch shifting and time stretching
"""

import os
import logging
import torch
import torchaudio
import soundfile as sf
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

class AudioModifier:
    """Modifies audio properties (pitch, speed) while preserving quality"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Force Soundfile backend for Windows stability
        try:
            torchaudio.set_audio_backend("soundfile")
            logger.info("Torchaudio backend set to: soundfile")
        except Exception as e:
            logger.warning(f"Could not set torchaudio backend: {e}")

        logger.info(f"AudioModifer initialized on {self.device}")
        
    def shift_pitch(self, input_path: str, semitones: float, output_path: str) -> bool:
        """
        Shift pitch by N semitones without changing tempo
        Uses basic resampling + time stretching or specialized pitch algorithms
        """
        try:
            if semitones == 0:
                # Just copy if no shift
                import shutil
                shutil.copy2(input_path, output_path)
                return True
                
            logger.info(f"Shifting pitch of {input_path} by {semitones} semitones")
            
            # Load audio using soundfile (more robust on Windows than torchaudio.load)
            # data is [samples, channels]
            data, sample_rate = sf.read(input_path)
            
            # Convert to torch tensor: [channels, samples]
            if len(data.shape) == 1:
                # Mono
                waveform = torch.from_numpy(data).float().unsqueeze(0)
            else:
                # Stereo/Multi: Transpose to [channels, samples]
                waveform = torch.from_numpy(data.T).float()
                
            waveform = waveform.to(self.device)
            
            # Calculate pitch shift factor
            # n_steps = semitones
            # torchaudio.transforms.PitchShift is available in newer versions
            
            effects = [
                ["pitch", str(semitones * 100)] # SoX effect: pitch shift in cents
            ]
            
            # Note: torchaudio.sox_effects might be better if available and sox is installed,
            # but strict dependency on system sox can be tricky on Windows.
            # We will use torchaudio functional processing if possible.
            
            # Method 1: Torchaudio Functional pitch_shift (High Quality)
            # Available in torchaudio >= 0.12
            try:
                import torchaudio.functional as F
                
                # Check if it has pitch_shift
                if hasattr(F, "pitch_shift"):
                     # n_steps is semitones
                    shifted_waveform = F.pitch_shift(waveform, sample_rate, n_steps=semitones)
                else:
                    # Fallback to resampling (changes speed) + time stretch (restore speed) -> Artefacts risk
                    # Better fallback: Use resampling method
                    # New Rate = Old Rate * 2^(semitones/12)
                    # Resample to new rate, then play at old rate -> Pitch changes, speed changes
                    # To keep speed: Pitch change, then Time Stretch inverse amount
                    
                    # Let's try to use resampling for Speed+Pitch, avoiding complex graph if possible
                    # Implementation of simple pitch shift without speed change is complex without PitchShift
                    
                    # Assuming torchaudio>2.0.0 is installed per requirements
                    # It definitely has transforms.PitchShift
                    
                    transform = torchaudio.transforms.PitchShift(
                        sample_rate, 
                        n_steps=semitones
                    ).to(self.device)
                    
                    shifted_waveform = transform(waveform)

            except Exception as e:
                logger.warning(f"Torchaudio PitchShift failed: {e}, falling back to CPU or other method")
                # Ensure we are on CPU if CUDA failed
                waveform = waveform.cpu()
                transform = torchaudio.transforms.PitchShift(
                    sample_rate, 
                    n_steps=semitones
                )
                shifted_waveform = transform(waveform)
            
            # Normalize to prevent clipping if gain increased
            max_val = torch.max(torch.abs(shifted_waveform))
            if max_val > 1.0:
                shifted_waveform = shifted_waveform / max_val
            
            # Save output using soundfile
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Convert back to numpy [samples, channels]
            output_data = shifted_waveform.cpu().numpy().T
            
            sf.write(output_path, output_data, sample_rate)
            
            logger.info(f"Pitch shift successful: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Pitch shift failed: {e}")
            raise e

# Global modifier instance
audio_modifier = AudioModifier()
