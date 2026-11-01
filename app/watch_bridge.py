"""Use the pinned upstream claude-video frame engine in an isolated process.

The upstream source stays unchanged. Downloads and Chinese ASR are provided by
the workbench's existing adapters; no cloud engine or global watch config is used.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'vendor' / 'claude-video' / 'skills' / 'watch'

def main():
    source, destination = map(Path, sys.argv[1:3])
    if not (SKILL / 'scripts' / 'frames.py').is_file():
        raise SystemExit('claude-video source missing from vendor/claude-video')
    sys.path.insert(0, str(SKILL / 'scripts'))
    from frames import auto_fps, extract_scene_or_uniform, format_time, get_metadata
    metadata = get_metadata(str(source.resolve()))
    duration = metadata['duration_seconds']
    if not metadata.get('has_video') or not 0 < duration <= 600:
        raise SystemExit('Expected a video up to 10 minutes long')
    fps, target = auto_fps(duration, max_frames=48)
    destination.mkdir(parents=True, exist_ok=True)
    frames, selection = extract_scene_or_uniform(
        str(source.resolve()), destination / 'frames', fps=fps,
        target_frames=target, resolution=720, max_frames=48,
        start_seconds=None, end_seconds=duration, dedup=True,
    )
    result = {'engine': 'bradautomates/claude-video', 'selection': selection, 'frames': []}
    for frame in frames:
        file = Path(frame['path']).resolve()
        result['frames'].append({
            'file': file.relative_to(destination.resolve()).as_posix(),
            'timestamp_sec': frame['timestamp_seconds'],
            'timestamp': format_time(frame['timestamp_seconds']),
            'selection_reason': frame.get('reason', 'selected'),
        })
    (destination / 'frames.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'engine': result['engine'], 'frame_count': len(frames)}))

if __name__ == '__main__':
    main()
