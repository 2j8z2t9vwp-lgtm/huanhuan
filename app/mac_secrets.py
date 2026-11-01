"""Authenticated secret files; the encryption key lives only in macOS Keychain."""
import hashlib
from pathlib import Path
import threading

_LOCK = threading.Lock()
PREFIX = b'HUANHUAN-MAC-1:'


def crypt(raw, data_dir, decrypt=False):
    try:
        from cryptography.fernet import Fernet
        # Select the native backend explicitly; never fall back to plaintext.
        from keyring.backends.macOS import Keyring
        backend = Keyring()
        account = hashlib.sha256(str(Path(data_dir).resolve()).encode()).hexdigest()
        with _LOCK:
            key = backend.get_password('huanhuan-workbench', account)
            if not key:
                if decrypt:
                    raise ValueError('钥匙串中没有此工作台的密钥，请在设置重新填写 API Key。')
                key = Fernet.generate_key().decode('ascii')
                backend.set_password('huanhuan-workbench', account, key)
        if decrypt:
            if not raw.startswith(PREFIX):
                raise ValueError('此密钥来自其他系统，请在 Mac 的设置页重新填写。')
            return Fernet(key.encode('ascii')).decrypt(raw[len(PREFIX):])
        return PREFIX + Fernet(key.encode('ascii')).encrypt(raw)
    except ValueError:
        raise
    except Exception:
        raise ValueError('无法访问 Mac 钥匙串或解密密钥。请确认已运行安装入口、解锁登录钥匙串，并在设置重新填写密钥。') from None
