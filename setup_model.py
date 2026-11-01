from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parent
os.environ['HF_HOME'] = str(ROOT / 'data' / 'models')
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

if __name__ == '__main__':
    from faster_whisper import WhisperModel
    model = sys.argv[1] if len(sys.argv) > 1 else 'base'
    if model not in ('tiny', 'base', 'small'):
        raise ValueError('Choose tiny, base or small')
    WhisperModel(model, device='cpu', compute_type='int8', download_root=str(ROOT / 'data' / 'models' / 'whisper'))
    print(model + ' Chinese-capable speech model ready locally.')
