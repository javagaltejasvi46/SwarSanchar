from PIL import Image
import os

input_path = r"C:\my codings\Swarsanchar final\logo\logo with name.png"
output_path = r"c:\my codings\Swarsanchar final\frontend\public\icon.ico"

try:
    img = Image.open(input_path)
    # Resize to 256x256 for optimal ICO quality
    img = img.resize((256, 256), Image.Resampling.LANCZOS)
    img.save(output_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print(f"Successfully created {output_path}")
except Exception as e:
    print(f"Error converting image: {e}")
    exit(1)
