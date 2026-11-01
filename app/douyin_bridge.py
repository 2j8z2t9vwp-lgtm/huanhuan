"""Call the requested upstream DouyinProcessor without its broken packaging/CLI."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'vendor' / 'integrations' / 'douyin-mcp'))

def main():
    payload = json.load(sys.stdin)
    keys = [payload.get('alapi', ''), payload.get('siliconflow', '')]
    try:
        from douyin_mcp.main import DouyinProcessor
        import requests
        original = requests.sessions.Session.request
        def bounded(self, method, url, **kwargs):
            kwargs.setdefault('timeout', 40)
            return original(self, method, url, **kwargs)
        requests.sessions.Session.request = bounded
        processor = DouyinProcessor(alapi_token=keys[0], siliconflow_api_key=keys[1])
        if payload['action'] == 'parse':
            if not keys[0]:
                raise ValueError('需要先配置 ALAPI Token；上游实际解析代码也使用此密钥。')
            result = processor.parse_share_url(payload['url'])
        elif payload['action'] == 'transcribe':
            if not keys[1]:
                raise ValueError('需要先配置硅基流动 API Key。')
            audio = Path(payload['audio']).resolve()
            media = Path(payload['media_root']).resolve()
            if not audio.is_relative_to(media) or audio.suffix != '.mp3' or not audio.is_file():
                raise ValueError('音频路径无效')
            result = {'text': processor.transcribe_audio(audio)}
        else:
            raise ValueError('不支持的操作')
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        message = str(error)
        for key in keys:
            if key:
                message = message.replace(key, '[密钥已隐藏]')
        print(json.dumps({'error': message[:600]}, ensure_ascii=False))
        raise SystemExit(1)

if __name__ == '__main__':
    main()
