
import sys
import os
import torch
import torchaudio
import soundfile as sf
import numpy as np
import traceback

# Add backend to path
sys.path.append('backend')

def generate_test_audio(filename="test_audio.wav"):
    print(f"Generating test audio: {filename}")
    sample_rate = 44100
    duration_seconds = 2
    frequency = 440  # A4
    
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
    audio_data = 0.5 * np.sin(2 * np.pi * frequency * t)
    # Audio data: [samples]
    audio_data = 0.5 * np.sin(2 * np.pi * frequency * t)
    
    # Save using soundfile
    sf.write(filename, audio_data, sample_rate)
        
    return filename

def test_pitch_shift():
    # Redirect stdout/stderr to file
    log_file = open("test_pitch_log.txt", "w")
    sys.stdout = log_file
    sys.stderr = log_file
    
    try:
        print("--- Starting Pitch Shift Test ---")
        try:
            import soundfile
            print(f"Soundfile version: {soundfile.__version__}")
        except ImportError:
            print("Soundfile not installed")

        print(f"Torchaudio version: {torchaudio.__version__}")
        
        # Explicitly set backend
        try:
            torchaudio.set_audio_backend("soundfile")
            print("Set backend to soundfile")
        except Exception as e:
            print(f"Failed to set backend: {e}")

        from modifier import audio_modifier
        
        input_file = generate_test_audio()
        output_file = "test_audio_shifted.wav"
        semitones = 2
        
        print(f"Testing pitch shift: {input_file} -> {output_file} ({semitones} semitones)")
        print(f"Device: {audio_modifier.device}")
        
        success = audio_modifier.shift_pitch(input_file, semitones, output_file)
        
        if success:
            print("SUCCESS: Pitch shift completed.")
        else:
            print("FAILURE: shift_pitch returned False")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()
    finally:
        log_file.close()

if __name__ == "__main__":
    test_pitch_shift()
