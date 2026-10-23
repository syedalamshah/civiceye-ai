import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates, loadRecords, STORAGE_KEY, validateResult } from './data.js';

test('coordinates accept edge/zero values and reject blanks, infinities and out-of-range input', () => {
  assert.deepEqual(coordinates('0', '0'), { lat: 0, lng: 0 });
  assert.deepEqual(coordinates('-90', '180'), { lat: -90, lng: 180 });
  for (const pair of [['', '0'], ['0',' '], ['91','0'], ['0','181'], ['NaN','0'], ['0','Infinity']]) {
    assert.throws(() => coordinates(...pair));
  }
});

test('API response validation permits real empty responses and rejects unsafe coordinates', () => {
  const empty = { image_width: 810, image_height: 1080, detections: [] };
  assert.equal(validateResult(empty), empty);
  assert.throws(() => validateResult({ ...empty, image_width: 0 }));
  assert.throws(() => validateResult({ ...empty, detections: [{ label: 'pothole', confidence: 0.8, bbox: [-1, 2, 50, 60] }] }));
  assert.throws(() => validateResult({ ...empty, detections: [{ label: 'pothole', confidence: 3, bbox: [1, 2, 50, 60] }] }));
  assert.throws(() => validateResult({ ...empty, detections: [{ label: 'person', confidence: 0.8, bbox: [1, 2, 50, 60] }] }));
});

test('storage parsing preserves an inspection and rejects corrupt records without overwriting them', () => {
  const record = { id: 'test', name: 'street.jpg', createdAt: new Date().toISOString(), lat: 0, lng: 0,
    thumbnail: 'data:image/jpeg;base64,fixture', result: { image_width: 810, image_height: 1080, detections: [] } };
  let stored = JSON.stringify([record]);
  globalThis.localStorage = { getItem(key) { assert.equal(key, STORAGE_KEY); return stored; } };
  assert.deepEqual(loadRecords(), [record]);
  stored = '{invalid'; assert.throws(loadRecords); assert.equal(stored, '{invalid');
  stored = JSON.stringify([{ ...record, lat: 91 }]); assert.throws(loadRecords);
  delete globalThis.localStorage;
});
