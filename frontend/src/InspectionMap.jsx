import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

function Focus({ selected, records }) {
  const map = useMap();
  useEffect(() => {
    const record = records.find(r => r.id === selected);
    if (record) map.flyTo([record.lat, record.lng], 15, { duration: 0.7 });
    else if (records.length) map.fitBounds(records.map(r => [r.lat, r.lng]), { padding: [35, 35], maxZoom: 14 });
  }, [selected, records, map]);
  return null;
}

function ReportMarker({ record, selected, onSelect, onOpen }) {
  const marker = useRef();
  useEffect(() => { if (selected === record.id) marker.current?.openPopup(); }, [selected, record.id]);
  const count = record.result.detections.length;
  return <CircleMarker ref={marker} center={[record.lat, record.lng]} radius={selected === record.id ? 11 : 8}
    pathOptions={{ color: '#fff', weight: 3, fillColor: count ? '#e37c39' : '#237861', fillOpacity: 1 }}
    eventHandlers={{ click: () => onSelect(record.id) }}>
    <Popup><div className="map-popup"><img src={record.thumbnail} alt="Saved road inspection"/><strong>{record.name}</strong>
      <span>{count} possible {count === 1 ? 'pothole' : 'potholes'}</span>
      <button onClick={() => onOpen(record)}>View inspection →</button></div></Popup>
  </CircleMarker>;
}

export default function InspectionMap({ records, selected, onSelect, onOpen }) {
  const [tileError, setTileError] = useState(false);
  return <div className="map-wrap">
    <MapContainer center={[33.6844, 73.0479]} zoom={11} scrollWheelZoom={false} className="inspection-map" aria-label="Saved inspection map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }}/>
      <Focus selected={selected} records={records}/>
      {records.map(record => <ReportMarker key={record.id} record={record} selected={selected} onSelect={onSelect} onOpen={onOpen}/>)}</MapContainer>
    <div className="map-key"><i className="orange-dot"/>Possible potholes <i className="green-dot"/>No detections</div>
    {tileError && <div className="tile-error" role="status">Map tiles are unavailable. Saved coordinates and reports remain accessible.</div>}
    {!records.length && <div className="map-empty">Your first saved inspection will appear here</div>}
  </div>;
}
