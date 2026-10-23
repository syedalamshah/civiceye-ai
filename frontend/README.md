# RoadLens AI frontend

React + Vite + JavaScript, Tailwind CSS v4, and React Leaflet/OpenStreetMap. Connects to the existing FastAPI detector; no mock predictions.

## Start locally

From `frontend/`:

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open `http://localhost:5173`. On macOS/Linux use `npm` instead of `npm.cmd`, and `cp` instead of `Copy-Item`.

`VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`. Set it in `.env.local` before starting Vite; restart after changing it. Vite environment variables are public build-time configuration, never put credentials in them.

Start the existing backend from the **repository root** using its documented Python environment:

```powershell
$env:CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Install backend requirements in that environment first, and ensure its ONNX file is available. No backend code changes are needed. The health badge reports API liveness, not model readiness; the backend may return 503 for unavailable weights.

## Production build and logic checks

```powershell
npm.cmd run build
node --test src/data.test.js
npm.cmd run preview
```

`dist/` is static output. Set `VITE_API_BASE_URL` to the deployed API URL before building and configure the backend's exact frontend CORS origin. Serve both over HTTPS in production. Preview runs on port 4173, so allow that origin if testing its API connection. No deployment or publication is included.

## Demo flow

1. Upload a JPG or PNG (maximum 10 MiB and 20 million pixels).
2. Click **Analyze road**. The original image is sent as multipart field `file` to `/api/detect`.
3. Review real boxes and confidence scores. False positives are possible. Empty results do not guarantee a safe road.
4. Enter the photo location as latitude (−90 to 90) and longitude (−180 to 180). Coordinates are entered manually; GPS is not requested.
5. Click **Save inspection**. A JPEG thumbnail, coordinates, timestamp, and returned detections are stored in this browser's localStorage.
6. Select a marker or a saved row to navigate to the report. Click **View inspection** or **View report** for details.

The image and overlay share an intrinsic aspect ratio. An SVG viewBox uses the API's original image dimensions; boxes therefore scale with the displayed image without object-fit offsets. The API dimensions must match the browser-decoded image dimensions; unsupported orientation differences produce an error instead of misleading boxes.

Reports use key `roadlens.inspections.v1`, with up to 30 records. Thumbnails are at most 420 pixels on the longest side, JPEG quality 0.65; full uploaded images are not stored. Reports are device/browser-local, are not a backup, and disappear if browser storage is cleared. Storage denial, quota exhaustion, or corrupt saved data produce visible errors. Photos are transmitted to the configured API during analysis. OpenStreetMap tiles require an internet connection; their attribution remains visible. Tile failures do not hide saved coordinates or report access.

## Manual browser acceptance checklist

- Upload a real pothole photo, analyze, verify the boxes remain aligned at desktop and mobile widths.
- Try the negative control and confirm an empty response is shown accurately.
- Check bad coordinates, an unsupported file, corrupted images, and an unavailable API.
- Save a report, open its map marker and report, reload the page, and verify persistence.
- Confirm compressed thumbnail size and browser storage quota handling.

See VALIDATION.md for checks actually executed and any remaining limitations.
