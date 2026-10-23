# Render backend deployment

Create a **Blueprint** from this repository's `main` branch using root `render.yaml`. Alternatively create a **Web Service** with these settings. Keep Root Directory empty: imports and paths start at the repository root.

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/syedalamshah/civiceye-ai` |
| Branch | `main` |
| Runtime | Python 3 |
| Root Directory | Empty |
| Build Command | Use the complete command below |
| Start Command | `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/health` |

Build command:

```sh
pip install -r backend/requirements.txt && python backend/download_model.py && python -c "from backend.detector import Detector; from PIL import Image; import os; Detector(os.environ['MODEL_PATH']).detect(Image.new('RGB', (640, 640))); print('Verified ONNX inference check passed')"
```

Environment:

```text
PYTHON_VERSION=3.13.5
MODEL_PATH=backend/.cache/pothole.onnx
REQUIRE_MODEL=true
MAX_UPLOAD_BYTES=10485760
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Once Vercel gives you the real frontend URL, append its exact origin to `CORS_ORIGINS`, for example `https://YOUR-PROJECT.vercel.app`, without a trailing slash. Do not use the placeholder as a real domain. Save the environment change and redeploy/restart Render. Set Vercel `VITE_API_BASE_URL` to the actual Render HTTPS origin without `/api`, then rebuild Vercel. `PORT` is supplied by Render; do not hardcode it.

## What deployment checks

The build downloads the original publisher's pinned Hugging Face ONNX artifact and validates its size and SHA-256, then executes the real model on a blank image. This checks that inference executes, not pothole accuracy. The model stays outside Git and is included in Render's deployed build filesystem; no persistent disk is required. The downloader preserves existing mismatched files and fails instead of overwriting them. If a build cache ever contains the wrong file, use **Manual Deploy > Clear build cache & deploy**.

`REQUIRE_MODEL=true` causes service startup to fail if model initialization fails. Local behavior stays unchanged when that environment flag is absent. `/health` retains the existing API contract. A healthy endpoint alone is not public inference verification.

In Render logs, confirm the model checksum and `Verified ONNX inference check passed`, then confirm service startup. After Render reports Live, verify a real upload from your development machine:

```powershell
python backend/smoke_test.py backend/.cache/pothole-road.jpg backend/.cache/negative-road.jpg --url https://YOUR-ACTUAL-RENDER-HOST
```

Use actual files on your machine; sample photos are intentionally not in Git. Do not consider deployment finished until the real pothole request returns HTTP 200 with detections and original image dimensions. Cold starts can take time; retry after the service is awake. If Render logs show memory exhaustion, choose an instance with more RAM; the free plan has not been benchmarked for this model. No hosted URL or successful Render deployment is claimed yet.

## Model provenance and outstanding license conflict

Publisher: https://huggingface.co/peterhdd/pothole-detection-yolov8

Pinned revision: `da7747eea7abb4319a0f55961f31809a16c1b10a`; file `best.onnx`; size 44,746,345 bytes; SHA-256 `91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5`.

No access token is required for this public, ungated artifact. Render needs outbound access to Hugging Face's redirected file host. A failed download or checksum fails the build. Publisher metadata says Apache-2.0 while the ONNX metadata declares AGPL-3.0. Permissions have not been resolved or assumed; the repository's MIT license does not override model obligations. See backend/TEST_RESULTS.md.
