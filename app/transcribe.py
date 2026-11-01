import json
import sys
from pathlib import Path
from faster_whisper import WhisperModel

if __name__ == '__main__':
    source, target, model = sys.argv[1:]
    from app import store
    bundled = store.ROOT / 'models' / 'whisper' / model
    if model in ('tiny', 'base', 'small') and (bundled / 'model.bin').is_file():
        model = str(bundled)
    engine = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=4, download_root=str(store.DATA / 'models' / 'whisper'))
    segments, _ = engine.transcribe(source, language='zh', vad_filter=True, beam_size=3, condition_on_previous_text=False)
    result = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segments]
    Path(target).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
