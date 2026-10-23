"""Real local model + FastAPI multipart checks; requires downloaded sample photos."""
import json
from pathlib import Path
import time

from fastapi.testclient import TestClient
import numpy as np
from PIL import Image, ImageDraw

from backend.detector import Detector
from backend.main import app, decode_image


def main():
    cache = Path(__file__).parent / '.cache'
    start = time.perf_counter()
    detector = Detector(cache / 'pothole.onnx')
    results = {'model_load_seconds': time.perf_counter() - start, 'samples': []}
    with TestClient(app) as client:
        health = client.get('/health')
        assert health.status_code == 200 and health.json() == {'status': 'ok'}
        results['health'] = health.json()
        assert app.state.detector is not None
        for name in ['pothole-road.jpg', 'negative-road.jpg']:
            data = (cache / name).read_bytes()
            image = decode_image(data)
            start = time.perf_counter()
            predictions = detector.detect(image)
            direct_seconds = time.perf_counter() - start
            start = time.perf_counter()
            response = client.post('/api/detect', files={'file': (name, data, 'image/jpeg')})
            api_seconds = time.perf_counter() - start
            assert response.status_code == 200, response.text
            body = response.json()
            assert set(body) == {'detections', 'image_width', 'image_height'}
            assert (body['image_width'], body['image_height']) == image.size
            assert len(body['detections']) == len(predictions)
            for actual, expected in zip(body['detections'], predictions):
                assert actual['label'] == 'pothole' and 0 <= actual['confidence'] <= 1
                np.testing.assert_allclose(actual['bbox'], expected['bbox'], atol=0.01)
                np.testing.assert_allclose(actual['confidence'], expected['confidence'], atol=1e-5)
                x1, y1, x2, y2 = actual['bbox']
                assert 0 <= x1 < x2 <= image.width and 0 <= y1 < y2 <= image.height
            draw = ImageDraw.Draw(image)
            for detection in predictions:
                draw.rectangle(detection['bbox'], outline='red', width=3)
                draw.text(tuple(detection['bbox'][:2]), f"pothole {detection['confidence']:.3f}", fill='red')
            image.save(cache / name.replace('.jpg', '-overlay.jpg'))
            results['samples'].append({'file': name, 'direct_seconds': direct_seconds,
                                       'api_seconds': api_seconds, 'http_status': response.status_code,
                                       'response': body})
        # Also exercise PNG encoding with the same real photograph.
        png_path = cache / 'pothole-road.png'
        with Image.open(cache / 'pothole-road.jpg') as photo:
            photo.save(png_path)
        png = client.post('/api/detect', files={'file': ('road.png', png_path.read_bytes(), 'image/png')})
        assert png.status_code == 200, png.text
        results['png_status'] = png.status_code
        results['corrupt_status'] = client.post('/api/detect', files={
            'file': ('bad.jpg', b'not an image', 'image/jpeg')}).status_code
        assert results['corrupt_status'] == 400
    (cache / 'real-test-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
