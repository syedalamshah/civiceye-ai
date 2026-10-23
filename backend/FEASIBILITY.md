# Milestone 1: feasibility check

Checked on 2026-10-23. Original feasibility check below is historical. **Update: weights supplied, checksum verified, real inference and multipart tests passed.** See TEST_RESULTS.md for current evidence and model-quality limitations.

## Repository and environment

- Remote: https://github.com/syedalamshah/civiceye-ai.git
- Branch: `feature/backend-ai`; working tree was clean at inspection.
- Initial checkout contained README.md, LICENSE (MIT), and .gitignore; no road images or backend code.
- Python 3.13.5; pip 26.1.1.
- ONNX Runtime 1.26.0 imports successfully with CPUExecutionProvider available.
- Pillow 11.3.0, FastAPI 0.136.1, PyTorch 2.12.0+cpu import successfully. CUDA unavailable.
- Ultralytics and OpenCV are not installed. No dependencies were installed.

## Candidate

Model: https://huggingface.co/peterhdd/pothole-detection-yolov8

The publisher documents YOLOv8s, one class (`pothole`), and a 640-pixel training image size. The repository supplies `best.onnx` (44.7 MB) and `best.pt` (22.5 MB). Pin the observed revision `da7747eea7abb4319a0f55961f31809a16c1b10a`.

Prefer ONNX Runtime CPU + NumPy + Pillow for this project: these avoid requiring the PyTorch/Ultralytics stack in deployment. CPU provider availability was tested, but loading this model, its input/output tensor shapes, latency, accuracy, and memory usage were NOT tested. Full dependency download/install size was NOT measured.

The model card lists Apache-2.0; the publisher's source repository also lists Apache-2.0. However, it derives from Ultralytics YOLOv8. Ultralytics documents AGPL-3.0 or Enterprise licensing: https://www.ultralytics.com/license . Treat the model's downstream licensing as unresolved rather than assuming its Apache tag overrides upstream obligations. The project's existing MIT license was not changed.

The model card says no Hugging Face Inference Provider deploys this model. A ready-to-call hosted endpoint has not been verified; do not assume that a Hugging Face token alone supplies inference.

## Actual network results

1. Sandboxed Python HTTPS request failed with `PermissionError: [WinError 10013]`.
2. Retried with network escalation: public Hugging Face model metadata request succeeded; model is public and ungated.
3. Escalated download of the pinned `best.onnx` failed following an HTTP 302 redirect, with `urllib.error.URLError: <urlopen error [Errno 11001] getaddrinfo failed>`.
4. No model weights were obtained. Dataset inspection was after the failed download in the same script and did not execute.

Positive-image inference: **not run**. Negative-image inference: **not run**. Bounding-box correctness: **not verified**. No predictions or successful inference claims have been generated.

## Exact next action

Restore DNS/network access to the Hugging Face redirected file host, or supply the pinned ONNX file locally as `backend/.cache/pothole.onnx`. Download URL:

https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/da7747eea7abb4319a0f55961f31809a16c1b10a/best.onnx

Then obtain an unannotated pothole road image and a visually checked intact-road negative image, recording sources and usage terms. Load the ONNX session with CPUExecutionProvider, inspect tensor shapes/metadata, and execute both real images. Record elapsed time, scores, and boxes. Inspect overlays and verify inverse letterboxing into original-image pixel coordinates, clipping, and non-max suppression. A negative result must be observed, never forced.

## Follow-up implementation and executed checks

The user subsequently authorized API implementation while weights remain unavailable. Rechecked `backend/.cache`: `pothole.onnx` is absent, so its validity cannot be established. No road images exist in this checkout.

Implemented `main.py`, `detector.py`, requirements, environment example, README/startup commands, a live HTTP smoke script, and contract/geometry tests. The API never substitutes predictions for an unavailable model: valid JPEG/PNG uploads return 503. `/health` remains the agreed liveness response.

Executed `python -m unittest backend.test_backend -v`: **3 tests passed**. These cover health, missing upload field, JPEG/PNG missing-model 503, empty/corrupt/truncated files, invalid content types, GIF rejection, byte/pixel limits, allowed/rejected CORS origins, ONNX Runtime rejection of an invalid model file, and constructed-tensor confidence/NMS/inverse-letterbox checks. Constructed tensors are mathematical fixtures, not model predictions. Python compilation also passed. Real positive/negative inference and the live-server road-image smoke script remain unexecuted.

The missing `python-multipart==0.0.22` dependency was downloaded (24 kB wheel) into ignored `backend/.cache/python-deps`; no global installation occurred. Its downloaded directory was unreadable inside the sandbox, so tests ran with elevated execution and that directory on PYTHONPATH. Normal deployment should install `requirements.txt` into its virtual environment as documented.

Deployment still needs the model file and successful positive/negative inference, plus a measured CPU/RAM budget. Licensing remains unresolved as above. No commits or pushes were performed.
