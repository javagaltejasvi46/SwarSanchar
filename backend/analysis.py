"""
Swarsanchar - Audio Analysis Module
Uses librosa for key detection and musical properties analysis
"""

import os
import logging
import warnings
import numpy as np

# Suppress librosa warnings about audioread/mp3 if any
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class AudioAnalyzer:
    """Analyzes audio for musical properties like key and BPM"""
    
    # Mapping of pitch class integers to note names
    PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    def __init__(self):
        pass
        
    def detect_key(self, file_path: str) -> dict:
        """
        Detect the musical key of an audio file
        Returns: {'key': 'C', 'scale': 'major', 'confidence': 0.85}
        """
        try:
            import librosa
            
            # Load audio (use only first 30 seconds and lower SR for speed/memory)
            y, sr = librosa.load(file_path, duration=30, sr=22050)
            
            # Extract Harmonic component to avoid percussive noise affecting key
            y_harmonic, _ = librosa.effects.hpss(y)
            
            # Compute Chroma features
            chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
            
            # Sum chroma over time to get pitch distribution
            chroma_sum = np.sum(chroma, axis=1)
            
            # Identify the most prominent pitch class (Root note hypothesis)
            root_idx = np.argmax(chroma_sum)
            root_note = self.PITCH_CLASSES[root_idx]
            
            # Simple major/minor correlation (Krumhansl-Schmuckler algorithm simplified)
            # This is a basic estimation. For "Industry Standard" usually means robust estimation
            # We can use librosa's built-in key detection if available or stick to correlation
            
            # Note: librosa doesn't have a direct "key_detection" function in older versions,
            # but we can implement a template matching approach.
            
            # Major profile (rough approximation of Krumhansl-Schmuckler)
            major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
            
            # Circulate profiles to test each root
            max_corr = -1
            best_key = ""
            best_scale = ""
            
            # Normalize chroma sum
            chroma_sum = chroma_sum / np.max(chroma_sum)
            
            for i in range(12):
                # Roll profiles to align with root i
                major_rotated = np.roll(major_profile, i)
                minor_rotated = np.roll(minor_profile, i)
                
                # Correlate
                corr_major = np.corrcoef(chroma_sum, major_rotated)[0, 1]
                corr_minor = np.corrcoef(chroma_sum, minor_rotated)[0, 1]
                
                if corr_major > max_corr:
                    max_corr = corr_major
                    best_key = self.PITCH_CLASSES[i]
                    best_scale = "Major"
                    
                if corr_minor > max_corr:
                    max_corr = corr_minor
                    best_key = self.PITCH_CLASSES[i]
                    best_scale = "Minor"
            
            logger.info(f"Detected Key: {best_key} {best_scale} (Confidence: {max_corr:.2f})")
            
            return {
                "key": best_key,
                "scale": best_scale,
                "full_key": f"{best_key} {best_scale}",
                "confidence": float(max_corr)
            }
            
        except Exception as e:
            logger.error(f"Key detection failed: {e}")
            return {"key": "Unknown", "scale": "", "full_key": "Unknown", "confidence": 0.0}

# Global analyzer instance
audio_analyzer = AudioAnalyzer()
