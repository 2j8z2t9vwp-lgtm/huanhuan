"""Install local ffmpeg / ffprobe without changing system PATH."""
from pathlib import Path
import urllib.request
import zipfile
import shutil
import os
from app.platform_tools import executable

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / 'tools'

def main():
    if os.name != 'nt':
        if all(executable(name) for name in ('ffmpeg', 'ffprobe')):
            print('FFmpeg and ffprobe ready')
            return
        raise SystemExit('Please install native FFmpeg first: brew install ffmpeg')
    TOOLS.mkdir(exist_ok=True)
    if (TOOLS / 'ffmpeg.exe').exists() and (TOOLS / 'ffprobe.exe').exists():
        print('FFmpeg ready')
        return
    archive = TOOLS / 'ffmpeg.zip'
    urllib.request.urlretrieve('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', archive)
    with zipfile.ZipFile(archive) as z:
        for name in ('ffmpeg.exe', 'ffprobe.exe'):
            member = next(n for n in z.namelist() if n.endswith('/bin/' + name))
            with z.open(member) as src, (TOOLS / name).open('wb') as dst:
                shutil.copyfileobj(src, dst)
    archive.unlink()
    print('FFmpeg and ffprobe ready')

if __name__ == '__main__':
    main()
