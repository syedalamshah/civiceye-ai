# RoadLens AI backend

FastAPI + ONNX Runtime CPU. **Real model and multipart endpoint inference verified on 2026-10-23.**
The pothole photo returned detections, and a street-photo negative returned none. The positive also produced clear false positives; results require user review. See TEST_RESULTS.md. The server starts without weights, but detection returns HTTP 503 rather than invented predictions.

## Install and start

Run from the repository root (Python 3.13 was checked):

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
$env:MODEL_PATH = 'backend/.cache/pothole.onnx'
$env:CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
backend/.venv/Scripts/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
```

Linux deployment, from repository root after installing requirements:

```sh
MODEL_PATH=backend/.cache/pothole.onnx CORS_ORIGINS=https://your-frontend.example python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
```

`.env.example` documents settings; the app reads process environment variables, and does not automatically load `.env`. No API credentials are required for a local model. Do not put secrets in source control. Restart after changing the model file or settings. `/health` is liveness only and always returns `{"status":"ok"}`.

## Model

Place the raw single-class YOLOv8 ONNX export at `backend/.cache/pothole.onnx`, or set `MODEL_PATH`. Download the pinned candidate:

```powershell
python backend/download_model.py
```

The standard-library script verifies the pinned SHA-256 before publishing the file. Existing matching weights are verified without downloading again; a nonmatching file is preserved and rejected. Run during deployment setup before FastAPI. Downloads require access to Hugging Face and its redirected file host. If blocked, transfer the verified artifact separately and rerun the script to verify it. No automatic server-startup download occurs.

https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/da7747eea7abb4319a0f55961f31809a16c1b10a/best.onnx

Expected size: 44,746,345 bytes. Verified SHA-256: `91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5`, matching the publisher's pinned file metadata. Loading through ONNX Runtime validates the graph and supported tensor contract. RGB float32 NCHW input, fixed dimensions or dynamic dimensions defaulting to 640, and raw `[1,5,N]` single-class output are supported. Embedded-NMS, multi-class, segmentation, and quantized exports are deliberately rejected. Optional class metadata must identify one `pothole` class; the known publisher export names its class `0`, which is accepted only when the file matches this exact SHA-256.

Inference preserves aspect ratio with centered gray padding, converts pixels to RGB CHW / 255, filters confidence below 0.25, and applies IoU NMS at 0.45. Boxes are unpadded, divided by the resize gain, and clipped to original image dimensions. JPEG EXIF orientation is applied, so returned dimensions/coordinates match the browser's displayed orientation. Pillow bilinear resizing is used. Two-photo inference was executed and the positive overlay visually checked; a broad accuracy benchmark and comparison against the publisher's implementation remain pending.

Publisher model card: Apache-2.0, but the actual ONNX metadata declares AGPL-3.0. Resolve this discrepancy and upstream obligations before deployment; see TEST_RESULTS.md. Runtime dependencies exclude PyTorch and Ultralytics. No training or automatic network download occurs at startup.

## Frontend contract

```javascript
const data = new FormData();
data.append('file', imageFile);
const response = await fetch(`${apiBase}/api/detect`, {method: 'POST', body: data});
if (!response.ok) throw new Error((await response.json()).detail);
const {detections, image_width, image_height} = await response.json();
```

Do not manually set multipart Content-Type. Each detection is `{label:"pothole", confidence:number, bbox:[xmin,ymin,xmax,ymax]}` in original displayed-image pixels. For overlays multiply x coordinates by displayed width / image_width and y coordinates by displayed height / image_height; account for any CSS object-fit offsets. Empty detections are possible only after real inference. Location and localStorage stay in the frontend.

JPEG/PNG only, default 10 MiB per file (`MAX_UPLOAD_BYTES`), maximum 20 million decoded pixels. Invalid/empty images return 400; unsupported media 415; excessive size 413; missing multipart field 422; absent/invalid model or inference error 503. Set the deployment proxy's request-body limit as well: multipart parsing can spool the incoming upload before the endpoint applies its file-size limit. Configure exact deployed frontend origins in `CORS_ORIGINS`, comma separated. CPU inference is serialized; use one worker initially to avoid duplicated model memory. CPU latency/RAM have not been benchmarked.

## Checks

Install `httpx` separately for local contract tests:

```powershell
backend/.venv/Scripts/python -m pip install httpx==0.28.1
backend/.venv/Scripts/python -m unittest backend.test_backend -v
```

These tests validate errors, missing-model behavior, invalid ONNX rejection, and constructed geometry/NMS tensors. They do not demonstrate trained model quality.

Against the running server, use actual road photographs:

```powershell
python backend/smoke_test.py backend/.cache/pothole-road.jpg backend/.cache/intact-road.jpg
```

This stdlib-only script checks health, uploads each image, validates boxes, and prints actual JSON and latency. It exits unsuccessfully on 503. Visually inspect the images and boxes; the script does not assume the negative will produce zero detections. The executed control was `backend/.cache/negative-road.jpg`, a street photo with a bus, people, and paving, rather than an unobstructed intact asphalt road.

To repeat direct inference and in-process multipart checks with those downloaded samples:

```powershell
backend/.venv/Scripts/python -m backend.validate_model
```
