import sys
import os
sys.path.append('backend')

print("Importing modules...")
try:
    from backend.analysis import audio_analyzer
    from backend.modifier import audio_modifier
    import librosa
    import torchaudio
    print("Imports successful!")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

print("Verifying AudioAnalyzer...")
if hasattr(audio_analyzer, 'detect_key'):
    print(" - detect_key present")
else:
    print(" - detect_key MISSING")
    
print("Verifying AudioModifier...")
if hasattr(audio_modifier, 'shift_pitch'):
    print(" - shift_pitch present")
else:
    print(" - shift_pitch MISSING")

print("Backend verification complete.")
