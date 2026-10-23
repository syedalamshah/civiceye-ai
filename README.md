# RoadLens AI

RoadLens AI helps road inspectors turn a photograph into a reviewable pothole report with a location on a map.

**Status:** Working local hackathon prototype. The upload, real detection, save, and map-marker workflow has been manually demonstrated by the project owner. [Judge presentation](docs/judge-pitch.md).

## The public-service problem

A road photograph can show damage, but an inspector still needs to identify what deserves attention and record where it is. A picture without a clear location is difficult to revisit. RoadLens AI brings the photograph, possible potholes, and an entered location into one inspection record.

The intended users are road inspectors, municipal field teams, and campus maintenance staff. They can review a photo and keep a mapped record for follow-up. Residents and road users are the intended beneficiaries of better inspection information. The prototype has not been adopted by a municipality, and no reduction in repair time or accidents has been measured.

## Four steps from photo to report

1. **Upload:** Choose a JPG or PNG road photo and check the preview.
2. **Review:** Click **Analyze road**. Review the highlighted regions and their confidence scores. They are possible potholes, not confirmed defects.
3. **Locate:** Enter the photograph's latitude and longitude. The app validates the coordinates; it does not discover the location.
4. **Save and revisit:** Save the inspection. Click its map marker or saved report to reopen the thumbnail and findings.

The saved image is a compressed thumbnail. The full original photograph is not retained in the report.

## Screenshots

TODO: Add screenshots captured from the real running application. No mock screens are included.

| Real screen to capture | Suggested file |
| --- | --- |
| Uploaded road photo with real detection boxes and scores | `docs/screenshots/detection.png` |
| Entered coordinates and a successfully saved inspection | `docs/screenshots/saved-inspection.png` |
| Clicked map marker with its saved report | `docs/screenshots/map-report.png` |

## What the AI actually does

A pretrained vision model examines the uploaded photograph and proposes areas that look like potholes. RoadLens AI draws boxes around those areas so an inspector can review them. The model does not identify the road's location, confirm that a defect needs repair, or schedule a maintenance crew.

A confidence score describes the model's score for one proposed detection. **A 91% confidence score is not 91% measured accuracy, and it is not a calibrated guarantee that the box is correct.** We have not measured accuracy on a representative set of Pakistani roads.

### Technical architecture

```text
React/Vite + Tailwind
  -> multipart photograph -> FastAPI
  -> pretrained YOLOv8s ONNX detector, running on CPU
  -> detection boxes and scores -> React image overlay
  -> inspector-provided coordinates
  -> browser localStorage -> React Leaflet / OpenStreetMap
```

The backend resizes and pads the image, runs ONNX inference, filters overlapping detections, and scales boxes back to original image coordinates. The frontend scales the overlay with the displayed image. We integrated an existing pretrained model; we did not train it during the hackathon. There is no database, login system, or video processing.

## Local setup

Checked with Node 24 and Python 3.13. From the repository root in PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python backend/download_model.py
$env:CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
backend/.venv/Scripts/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. PowerShell uses `npm.cmd` to avoid npm.ps1 execution-policy restrictions. On Linux/macOS use `backend/.venv/bin/python`, `npm`, and `cp`, with your shell's environment-variable syntax.

`VITE_API_BASE_URL=http://127.0.0.1:8000` is the API origin, **without `/api`**. Restart Vite after changing it. Backend settings (`MODEL_PATH`, `CORS_ORIGINS`, `MAX_UPLOAD_BYTES`) come from process environment variables; `.env` is not automatically loaded. `.env.example` files are public templates, never credentials.

## API

- `GET /health` → `{"status":"ok"}` (liveness, not model readiness).
- `POST /api/detect` → multipart field **`file`**, JPEG/PNG, maximum 10 MiB and 20 million pixels by default.
- Response: `{"detections":[...],"image_width":number,"image_height":number}`. Each real detection contains `label: "pothole"`, confidence between 0 and 1, and `bbox: [xmin,ymin,xmax,ymax]` in original displayed-image pixels. Empty detections are valid.
- Invalid images return 400/415, size violations 413, missing field 422, and unavailable/failed model inference 503. Predictions are never fabricated.

## Model provisioning and credits

Weights are **not in Git**. `python backend/download_model.py` provisions the 44,746,345-byte artifact from [PeterHdd's pothole YOLOv8s model](https://huggingface.co/peterhdd/pothole-detection-yolov8), pinned to revision `da7747eea7abb4319a0f55961f31809a16c1b10a`. It verifies SHA-256 `91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5` before publishing `backend/.cache/pothole.onnx` (or `MODEL_PATH`). Existing files are verified, not overwritten.

Run provisioning on the deployment server before FastAPI. It needs outbound access to Hugging Face and its redirected file host; downloads were blocked in the original development sandbox. If blocked on your host, transfer the verified artifact separately and rerun the script to verify it. The existing local artifact was successfully verified; a fresh download using this new script has not been tested. The server does not automatically download weights.

Credits: pretrained YOLOv8s/Ultralytics, ONNX Runtime, the [publisher-linked pothole dataset](https://huggingface.co/datasets/Ryukijano/Pothole-detection-Yolov8), React Leaflet, and OpenStreetMap contributors. **Licensing remains unresolved:** the publisher card says Apache-2.0, while actual ONNX metadata declares AGPL-3.0. The existing MIT repository license does not remove upstream model obligations. Resolve this before public deployment/distribution.

## Verified evidence

| Check | Observed result |
| --- | --- |
| Real pothole photograph, direct model and HTTP API | 5 detections; main pothole confidence 91.0% |
| Real street-photo negative control | Zero detections |
| Visual review of positive output | Two clear false positives over hills/sky |
| Frontend production build | Passed |
| Frontend validation/storage parsing tests | 3 passed; storage parsing used an in-memory fixture |
| Backend API/error/geometry tests | 3 passed |
| Local browser workflow | Project owner confirmed upload, real detection, save, and map marker |

These are functional checks, not an accuracy benchmark. The positive comes from the publisher-linked dataset, and the negative is a street scene with a bus and paving, not a broad road-surface test set. Automated browser testing was unavailable; the manual workflow confirmation came later. Details and sample sources are in [backend test results](backend/TEST_RESULTS.md) and [frontend validation history](frontend/VALIDATION.md).

## Honest limitations

- The model can produce confident false positives. Every finding needs human review. No detections does not establish road safety.
- Locations are supplied manually and can be entered incorrectly. Automatic GPS or photo-location extraction is not implemented.
- Reports are browser-local, not a shared municipal database. There is no cross-device backup or collaboration.
- There is no automatic repair scheduling, dispatch, severity assessment, or completed-repair tracking.
- No field trial, municipal adoption, measured social impact, or representative accuracy evaluation has been established.

Reports, coordinates, and compressed thumbnails stay in browser localStorage (up to 30 reports). Photos are sent to the configured API. Reports are not shared across devices and can disappear when storage is cleared. Map tiles require internet. Production memory, concurrency, authentication, and rate limiting have not been validated.

```powershell
cd frontend
npm.cmd run build
node --test src/data.test.js
cd ..
backend/.venv/Scripts/python -m pip install httpx==0.28.1
backend/.venv/Scripts/python -m unittest backend.test_backend -v
```

Real image smoke test against a running backend: `python backend/smoke_test.py PATH_TO_POTHOLE.jpg PATH_TO_NEGATIVE.jpg`.

## Deployment

Build frontend `dist/` with the deployed `VITE_API_BASE_URL` and serve via HTTPS. Set backend `CORS_ORIGINS` to that exact frontend origin, provision weights, then start `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1` behind the platform's HTTPS endpoint/request-size limit. No deployment has been performed here.

Details: [backend setup](backend/README.md), [frontend setup](frontend/README.md), [model results](backend/TEST_RESULTS.md), [frontend validation history](frontend/VALIDATION.md).

## Contributors

| Contributor | Confirmed role | Responsibilities |
| --- | --- | --- |
| Masab | Team Lead and Frontend Engineer | React frontend and user interface |
| Syed Alam Shah Bukhari | Backend and AI Engineer | FastAPI, ONNX inference, and pothole detection |
| Kumail Abbas | Deployment and QA Engineer | Hosting, testing, and documentation |

## Submission links

- Repository: [syedalamshah/civiceye-ai](https://github.com/syedalamshah/civiceye-ai)
- Public application: **TODO: Add a verified deployment URL.** Localhost is not a public deployment.
- Demonstration video: **TODO: Record a 3–5-minute demonstration and add the real video URL.**
- Final Google Form: **TODO: Add the official form URL and submit before 4 PM PKT.**

### Confirmed DITE Hackathon 2026–27 requirements

The team confirmed that submission requires a publicly accessible GitHub repository, a working deployed web app with functional AI, a 3–5-minute demonstration video, and final Google Form submission before the deadline. The official guidelines are supplied outside this repository; no absent guidelines file has been reviewed here. Public repository access and deployed AI must be verified before submission. Missing links above remain TODOs.
