import io
import logging
import os
import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .detector import Detector

logger = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(10 * 1024 * 1024)))
MAX_IMAGE_PIXELS = 20_000_000
if MAX_UPLOAD_BYTES <= 0:
    raise ValueError('MAX_UPLOAD_BYTES must be positive')
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
inference_lock = Lock()


@asynccontextmanager
async def lifespan(app):
    app.state.detector = None
    path = os.getenv('MODEL_PATH', str(Path(__file__).parent / '.cache' / 'pothole.onnx'))
    try:
        app.state.detector = await run_in_threadpool(Detector, path)
    except Exception:
        logger.exception('Pothole model unavailable; /api/detect will return 503')
    yield
    app.state.detector = None


app = FastAPI(title='RoadLens AI', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if s.strip()],
    allow_credentials=False,
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


def decode_image(data):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format not in ('JPEG', 'PNG'):
                    raise HTTPException(415, 'Only JPEG and PNG images are supported')
                if probe.width * probe.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, 'Image exceeds 20 million pixels')
                probe.verify()
            with Image.open(io.BytesIO(data)) as source:
                source.load()
                # Matches browser display orientation, including portrait phone photos.
                return ImageOps.exif_transpose(source).convert('RGB')
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(413, 'Image exceeds pixel limit') from None
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise HTTPException(400, 'Invalid or corrupted image') from None


def infer(detector, image):
    with inference_lock:
        return detector.detect(image)


@app.post('/api/detect')
async def detect(file: UploadFile = File(...)):
    try:
        if file.content_type not in ('image/jpeg', 'image/png'):
            raise HTTPException(415, 'Upload must have image/jpeg or image/png content type')
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, 'Image exceeds upload size limit')
        if not data:
            raise HTTPException(400, 'Image is empty')
        image = await run_in_threadpool(decode_image, data)
        detector = getattr(app.state, 'detector', None)
        if detector is None:
            raise HTTPException(503, 'Pothole model unavailable. Configure MODEL_PATH and restart the backend.')
        try:
            detections = await run_in_threadpool(infer, detector, image)
        except Exception:
            logger.exception('Pothole inference failed')
            raise HTTPException(503, 'Pothole model inference failed') from None
        return {'detections': detections, 'image_width': image.width, 'image_height': image.height}
    finally:
        await file.close()
