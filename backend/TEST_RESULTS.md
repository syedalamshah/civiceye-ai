# Real model validation — 2026-10-23

Branch: `feature/backend-ai`. Changes confined to backend/. No commits or pushes.

## Model verification

The supplied file was actually named `backend/.cache/best.onnx`; `pothole.onnx` was absent. Copied the supplied file to `backend/.cache/pothole.onnx` without changing the original.

- File size: 44,746,345 bytes.
- SHA-256: `91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5`.
- Matches Hugging Face LFS SHA-256 for `best.onnx` at model revision `da7747eea7abb4319a0f55961f31809a16c1b10a`, retrieved through the public API.
- ONNX Runtime 1.26.0 successfully loads and executes with CPUExecutionProvider.
- Input: `images`, float32 `[1,3,640,640]`.
- Output: `output0`, float32 `[1,5,8400]`.
- Export metadata: Ultralytics 8.4.7; detection task; no embedded NMS; one class named `0`.
- Fixed a real compatibility issue: class name `0` is mapped to pothole only for the verified exact model hash. Unrelated numeric-class exports remain rejected.
- Actual ONNX metadata explicitly says AGPL-3.0. This conflicts with the publisher's Apache-2.0 model-card tag; licensing needs resolution before deployment.

Publisher: https://huggingface.co/peterhdd/pothole-detection-yolov8

## Samples and direct/API results

Positive source (640×640), from the publisher-linked dataset's test split:
https://huggingface.co/datasets/Ryukijano/Pothole-detection-Yolov8/resolve/main/test/images/0004_jpg.rf.f92ab952cd8544f887caf35fcccbcd10.jpg

Corresponding annotation file contains two potholes. The photo and output overlay were visually inspected. It is part of the source dataset, so this is a functional check rather than an independent generalization benchmark.

Negative control (810×1080):
https://raw.githubusercontent.com/ultralytics/assets/main/im/bus.jpg

This is a real street photo showing a bus, pedestrians, and paving, with no obvious potholes. It is not an unobstructed intact asphalt road; a broader road-negative evaluation remains useful. Downloaded samples and source dataset README are retained only in ignored `.cache/`, not redistributed as source assets. Dataset README provides provenance but no explicit license grant was verified.

Executed `python -m backend.validate_model` using actual ONNX inference (no mocked predictions):

| Check | Result |
| --- | --- |
| Model initialization | 0.761 s |
| Positive direct inference | 5 detections, 1.821 s |
| Positive multipart `/api/detect` | HTTP 200, 1.555 s |
| Negative direct inference | 0 detections, 1.468 s |
| Negative multipart `/api/detect` | HTTP 200, 1.387 s |
| `/health` | HTTP 200, `{"status":"ok"}` |
| Real positive photograph re-encoded as PNG | HTTP 200 |
| Corrupt JPEG upload | HTTP 400 |

In-process FastAPI requests include startup/lifespan and multipart decoding. API detections match direct inference, and returned image dimensions and every box's bounds were asserted. These are individual CPU timings, not a throughput benchmark.

Also started a real Uvicorn server on `127.0.0.1:8765` and executed `backend/smoke_test.py` over HTTP. Health passed; positive upload returned the same 5 detections in 1.309 s, and negative upload returned zero detections in 1.127 s. Both uploads returned HTTP 200 and passed schema/coordinate checks. The temporary server was stopped afterward. Raw output is retained in `.cache/http-smoke-results.txt`.

Positive output at confidence threshold 0.25 and NMS IoU threshold 0.45 (coordinates rounded here; full precision retained in `.cache/real-test-results.json`):

| Confidence | bbox [xmin, ymin, xmax, ymax] | Visual observation |
| --- | --- | --- |
| 0.910094 | [213.38, 433.81, 374.56, 554.03] | Main visible pothole |
| 0.766789 | [481.28, 356.61, 527.90, 380.30] | Second annotated road defect |
| 0.735501 | [3.66, 0.00, 432.90, 78.20] | Clear false positive over hills/sky |
| 0.377276 | [432.17, 390.48, 478.10, 417.57] | Small road mark; unannotated in source |
| 0.256308 | [260.85, 0.00, 640.00, 112.15] | Clear false positive over hills/sky |

Negative response: `{"detections":[],"image_width":810,"image_height":1080}`.

The model demonstrably detects potholes, but also produces confident false positives. Keep the app's “possible potholes” language and user review. No threshold was adjusted to hide these results.

## Regression tests

`python -m unittest backend.test_backend -v`: all 3 tests passed after the metadata compatibility fix. Coverage includes absent model 503, malformed uploads, size limits, CORS, invalid ONNX rejection, and constructed geometry/NMS checks. Constructed mathematical fixtures are not real prediction evidence.

## Current readiness

Local CPU inference and the agreed API contract are working. Weights remain outside Git. Frontend integration can proceed. Remaining limitations: false positives, small/non-independent sample set, unresolved licensing discrepancy, and deployment CPU/RAM/concurrency measurement.
