"""Provision the pinned, checksum-verified model outside Git. No extra dependencies."""
import hashlib
import os
from pathlib import Path
import tempfile
import urllib.request

URL = ('https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/'
       'da7747eea7abb4319a0f55961f31809a16c1b10a/best.onnx')
SHA256 = '91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5'
SIZE = 44_746_345


def verify(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    if path.stat().st_size != SIZE or digest.hexdigest() != SHA256:
        raise ValueError(f'Model size/checksum mismatch: {path}. Existing files are preserved.')


def main():
    target = Path(os.getenv('MODEL_PATH', str(Path(__file__).parent / '.cache' / 'pothole.onnx')))
    if target.exists():
        verify(target)
        print(f'Verified existing model: {target} (SHA-256 {SHA256})')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.tmp', delete=False) as output:
            temporary = Path(output.name)
            with urllib.request.urlopen(URL, timeout=30) as response:
                total = 0
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    total += len(chunk)
                    if total > SIZE:
                        raise ValueError('Download exceeds expected model size')
                    output.write(chunk)
        verify(temporary)
        # Exclusive creation prevents overwriting weights supplied concurrently.
        os.link(temporary, target)
        print(f'Downloaded and verified: {target} (SHA-256 {SHA256})')
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'Model setup failed: {error}') from None
