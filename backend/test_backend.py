"""Contract/error tests and mathematical checks; these are NOT real model inference."""
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from backend.detector import Detector, postprocess, preprocess
from backend.main import app


def image_bytes(format='PNG', size=(640, 480)):
    stream = io.BytesIO()
    Image.new('RGB', size).save(stream, format=format)
    return stream.getvalue()


class BackendTests(unittest.TestCase):
    def test_missing_model_and_upload_validation(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent / '.cache') as directory:
            with patch.dict(os.environ, {'MODEL_PATH': str(Path(directory) / 'absent.onnx')}):
                with TestClient(app) as client:
                    self.assertEqual(client.get('/health').json(), {'status': 'ok'})
                    self.assertEqual(client.post('/api/detect').status_code, 422)
                    def upload(data, mime='image/png'):
                        return client.post('/api/detect', files={'file': ('image.png', data, mime)})
                    result = upload(image_bytes())
                    self.assertEqual(result.status_code, 503)
                    self.assertIn('model unavailable', result.json()['detail'])
                    self.assertNotIn('detections', result.json())
                    self.assertEqual(upload(image_bytes('JPEG'), 'image/jpeg').status_code, 503)
                    self.assertEqual(upload(b'broken').status_code, 400)
                    self.assertEqual(upload(b'').status_code, 400)
                    self.assertEqual(upload(b'text', 'text/plain').status_code, 415)
                    self.assertEqual(upload(image_bytes('GIF')).status_code, 415)
                    self.assertEqual(upload(image_bytes()[:40]).status_code, 400)
                    with patch('backend.main.MAX_UPLOAD_BYTES', 100):
                        self.assertEqual(upload(image_bytes()).status_code, 413)
                    with patch('backend.main.MAX_IMAGE_PIXELS', 10):
                        self.assertEqual(upload(image_bytes()).status_code, 413)
                    cors = client.options('/api/detect', headers={
                        'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'})
                    self.assertEqual(cors.headers['access-control-allow-origin'], 'http://localhost:5173')
                    denied = client.options('/api/detect', headers={
                        'Origin': 'https://unknown.invalid', 'Access-Control-Request-Method': 'POST'})
                    self.assertNotIn('access-control-allow-origin', denied.headers)

    def test_invalid_onnx_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent / '.cache') as directory:
            path = Path(directory) / 'invalid.onnx'
            path.write_bytes(b'not an ONNX model')
            with self.assertRaises(Exception):
                Detector(path)

    def test_letterbox_scaling_nms(self):
        # Constructed tensors test geometry only; no mock detector serves API predictions.
        image = Image.new('RGB', (1000, 500), (255, 0, 0))
        tensor, gain, padding = preprocess(image, (640, 640))
        self.assertEqual(tensor.shape, (1, 3, 640, 640))
        self.assertEqual(tensor.dtype, np.float32)
        self.assertEqual(padding, (0, 160))
        self.assertAlmostEqual(float(tensor[0, 0, 320, 320]), 1)
        self.assertEqual(float(tensor[0, 2, 320, 320]), 0)
        output = np.array([[[192, 192, 500], [288, 288, 500], [256, 256, 20],
                            [128, 128, 20], [0.9, 0.8, 0.1]]], dtype=np.float32)
        detections = postprocess(output, gain, padding, image.size)
        self.assertEqual(len(detections), 1)
        np.testing.assert_allclose(detections[0]['bbox'], [100, 100, 500, 300], atol=1e-4)
        self.assertEqual(postprocess(np.zeros((1, 5, 10)), gain, padding, image.size), [])
        with self.assertRaises(ValueError):
            postprocess(np.zeros((1, 84, 10)), gain, padding, image.size)


if __name__ == '__main__':
    unittest.main()
