export const STORAGE_KEY = 'roadlens.inspections.v1';
export const MAX_REPORTS = 30;

export function coordinates(latitude, longitude) {
  if (!String(latitude).trim() || !String(longitude).trim()) throw new Error('Enter both latitude and longitude.');
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be between −90 and 90.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('Longitude must be between −180 and 180.');
  return { lat, lng };
}

export function validateResult(data) {
  if (!data || !Number.isInteger(data.image_width) || !Number.isInteger(data.image_height) ||
      data.image_width <= 0 || data.image_height <= 0 || !Array.isArray(data.detections) || data.detections.length > 300) {
    throw new Error('The detector returned an invalid response.');
  }
  for (const d of data.detections) {
    if (d.label !== 'pothole' || !Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 1 ||
        !Array.isArray(d.bbox) || d.bbox.length !== 4 || !d.bbox.every(Number.isFinite)) throw new Error('The detector returned invalid detections.');
    const [x1, y1, x2, y2] = d.bbox;
    if (!(0 <= x1 && x1 < x2 && x2 <= data.image_width && 0 <= y1 && y1 < y2 && y2 <= data.image_height)) {
      throw new Error('The detector returned out-of-bounds boxes.');
    }
  }
  return data;
}

export function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.length > MAX_REPORTS) throw new Error('Invalid saved inspections');
  for (const record of records) {
    coordinates(record.lat, record.lng);
    validateResult(record.result);
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || !Number.isFinite(Date.parse(record.createdAt)) ||
        typeof record.thumbnail !== 'string' || !record.thumbnail.startsWith('data:image/jpeg;base64,')) throw new Error('Invalid saved inspection');
  }
  return records;
}

export async function thumbnail(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const scale = Math.min(1, 420 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create a thumbnail.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.65);
}
