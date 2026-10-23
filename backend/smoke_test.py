"""Run against a live server: python backend/smoke_test.py IMAGE [NEGATIVE_IMAGE]."""
import argparse
import json
import mimetypes
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('images', nargs='+', type=Path)
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    with urllib.request.urlopen(args.url.rstrip('/') + '/health', timeout=10) as response:
        assert json.load(response) == {'status': 'ok'}
    print('health: PASS')
    for path in args.images:
        boundary = uuid.uuid4().hex
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                f'filename="image"\r\nContent-Type: {mime}\r\n\r\n').encode()
        body += path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
        request = urllib.request.Request(args.url.rstrip('/') + '/api/detect', data=body,
                    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise SystemExit(f'{path}: HTTP {error.code}: {error.read().decode()}') from None
        assert set(result) == {'detections', 'image_width', 'image_height'}
        width, height = result['image_width'], result['image_height']
        assert width > 0 and height > 0
        for detection in result['detections']:
            assert detection['label'] == 'pothole'
            assert 0 <= detection['confidence'] <= 1
            x1, y1, x2, y2 = detection['bbox']
            assert 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height
        print(f'{path}: {time.perf_counter() - start:.3f}s {json.dumps(result)}')


if __name__ == '__main__':
    main()
