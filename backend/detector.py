"""CPU inference for single-class YOLOv8 ONNX exports (without embedded NMS)."""
import ast
import hashlib
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

# Publisher revision da7747eea7abb4319a0f55961f31809a16c1b10a exports
# its documented pothole class as the generic name '0'. Only this exact
# verified artifact may use that alias; arbitrary single-class models may not.
POTHOLE_MODEL_SHA256 = '91dd7de7a110c61314ea19a958fcc85c7b3461cc6d60d87fefc08b41ac6e32c5'


def preprocess(image, size):
    width, height = image.size
    target_h, target_w = size
    gain = min(target_w / width, target_h / height)
    resized = (round(width * gain), round(height * gain))
    left = round((target_w - resized[0]) / 2 - 0.1)
    top = round((target_h - resized[1]) / 2 - 0.1)
    canvas = Image.new('RGB', (target_w, target_h), (114, 114, 114))
    canvas.paste(image.resize(resized, Image.Resampling.BILINEAR), (left, top))
    tensor = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    return np.ascontiguousarray(tensor), gain, (left, top)


def postprocess(output, gain, padding, image_size, confidence=0.25, iou=0.45):
    # YOLOv8 has class probabilities directly; there is no objectness channel.
    if output.ndim != 3 or output.shape[0] != 1 or output.shape[1] != 5:
        raise ValueError('Expected single-class YOLOv8 output [1,5,N] without embedded NMS')
    rows = output[0].T
    rows = rows[np.isfinite(rows).all(axis=1) & (rows[:, 4] >= confidence)
                & (rows[:, 4] <= 1) & (rows[:, 2] > 0) & (rows[:, 3] > 0)]
    rows = rows[np.argsort(-rows[:, 4])[:30000]]
    boxes = np.concatenate((rows[:, :2] - rows[:, 2:4] / 2,
                            rows[:, :2] + rows[:, 2:4] / 2), axis=1)
    order = np.arange(len(rows))
    keep = []
    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    while len(order) and len(keep) < 300:
        best = order[0]
        keep.append(best)
        remaining = order[1:]
        overlap = np.maximum(0, np.minimum(boxes[best, 2:], boxes[remaining, 2:])
                             - np.maximum(boxes[best, :2], boxes[remaining, :2]))
        intersection = overlap[:, 0] * overlap[:, 1]
        union = areas[best] + areas[remaining] - intersection
        order = remaining[intersection / np.maximum(union, 1e-9) <= iou]
    detections = []
    width, height = image_size
    for index in keep:
        box = (boxes[index] - np.array([*padding, *padding])) / gain
        box[[0, 2]] = np.clip(box[[0, 2]], 0, width)
        box[[1, 3]] = np.clip(box[[1, 3]], 0, height)
        if box[2] > box[0] and box[3] > box[1]:
            detections.append({'label': 'pothole', 'confidence': float(rows[index, 4]),
                               'bbox': box.tolist()})
    return detections


class Detector:
    def __init__(self, path):
        if not Path(path).is_file():
            raise FileNotFoundError('ONNX model file is missing')
        self.session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
        inputs, outputs = self.session.get_inputs(), self.session.get_outputs()
        if len(inputs) != 1 or len(outputs) != 1:
            raise ValueError('Expected one image input and one detection output')
        self.input = inputs[0]
        shape = self.input.shape
        if (self.input.type != 'tensor(float)' or len(shape) != 4 or shape[1] != 3
                or shape[0] not in (1, 'batch', 'batch_size', None)):
            raise ValueError('Expected float32 RGB NCHW batch-one input')
        self.size = tuple(d if isinstance(d, int) else 640 for d in shape[2:])
        if any(d <= 0 or d > 2048 for d in self.size):
            raise ValueError('Unsupported model input dimensions')
        out = outputs[0].shape
        if len(out) != 3 or out[1] != 5:
            raise ValueError('Expected single-class raw YOLOv8 output [1,5,N]')
        names = self.session.get_modelmeta().custom_metadata_map.get('names')
        if names:
            names = ast.literal_eval(names)
            values = list(names.values()) if isinstance(names, dict) else names
            known_numeric_alias = (values == ['0'] and
                hashlib.sha256(Path(path).read_bytes()).hexdigest() == POTHOLE_MODEL_SHA256)
            if len(values) != 1 or (str(values[0]).lower() != 'pothole' and not known_numeric_alias):
                raise ValueError('Model class must be pothole')

    def detect(self, image):
        tensor, gain, padding = preprocess(image, self.size)
        output = self.session.run(None, {self.input.name: tensor})[0]
        return postprocess(output, gain, padding, image.size)
