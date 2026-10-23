import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, Check, CheckCircle2, ChevronRight, Crosshair, FileImage, FolderOpen, LayoutDashboard, LoaderCircle, MapPin, MapPinned, Menu, Navigation, Plus, ScanLine, ShieldCheck, UploadCloud, X } from 'lucide-react';
import InspectionMap from './InspectionMap';
import { coordinates, loadRecords, MAX_REPORTS, STORAGE_KEY, thumbnail, validateResult } from './data';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const date = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Overlay({ result }) {
  return <svg className="detection-overlay" viewBox={`0 0 ${result.image_width} ${result.image_height}`} aria-label={`${result.detections.length} detected regions`}>
    {result.detections.map((d, i) => { const [x1, y1, x2, y2] = d.bbox; return <g key={i}>
      <rect x={x1} y={y1} width={x2-x1} height={y2-y1} fill="rgba(248,139,51,.08)" stroke="#ff9949" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      <title>{`Possible pothole ${i+1}: ${(d.confidence * 100).toFixed(1)}% confidence`}</title>
      <text x={x1 + 4} y={Math.max(16, y1 + 17)} fill="#fff" stroke="#5b3314" strokeWidth="3" paintOrder="stroke" fontSize={Math.max(13, result.image_width / 48)} fontWeight="700">{i+1} · {(d.confidence*100).toFixed(0)}%</text>
    </g>; })}</svg>;
}

function ReportDialog({ report, onClose }) {
  const dialog = useRef();
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="report-dialog" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="flex items-start justify-between gap-4 mb-5"><div><span className="eyebrow">SAVED INSPECTION</span><h2>{report.name}</h2></div><button className="icon-button" aria-label="Close report" onClick={onClose}><X size={20}/></button></div>
    <div className="report-image"><img src={report.thumbnail} alt="Saved road thumbnail"/><Overlay result={report.result}/></div>
    <p className="mt-4"><strong>{report.result.detections.length} possible potholes</strong> · {date(report.createdAt)}</p>
    <p className="muted text-sm mt-2">{report.lat.toFixed(6)}, {report.lng.toFixed(6)}</p>
    <div className="confidence-list mt-4">{report.result.detections.map((d,i) => <span key={i}>#{i+1} · {(d.confidence*100).toFixed(1)}%</span>)}</div>
    {!report.result.detections.length && <p className="muted mt-3">No potholes detected. This does not guarantee the road is safe.</p>}
  </dialog>;
}

export default function App() {
  const [records, setRecords] = useState([]), [storageError, setStorageError] = useState('');
  const [image, setImage] = useState(null), [result, setResult] = useState(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [connected, setConnected] = useState('checking');
  const [lat, setLat] = useState(''), [lng, setLng] = useState(''), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState(null), [report, setReport] = useState(null), [dragging, setDragging] = useState(false);
  const [mobileNav, setMobileNav] = useState(false), [active, setActive] = useState('inspect');
  const input = useRef(), request = useRef(), generation = useRef(0);
  useEffect(() => { try { setRecords(loadRecords()); } catch { setStorageError('Saved inspections could not be read. Check browser storage settings before saving new reports.'); } }, []);
  useEffect(() => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 6000);
    fetch(`${API}/health`, { signal: controller.signal }).then(async r => setConnected(r.ok && (await r.json()).status === 'ok' ? 'online' : 'offline')).catch(() => setConnected('offline')).finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  useEffect(() => () => request.current?.abort(), []);

  async function choose(file) {
    if (!file) return;
    generation.current += 1; const id = generation.current; request.current?.abort(); setLoading(false);
    setError(''); setNotice(''); setResult(null); setSaved(false);
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPG or PNG photograph.'); return; }
    if (file.size > 10*1024*1024) { setError('This image is too large. Choose a file under 10 MB.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const probe = new Image(); probe.src = url; await probe.decode();
      if (probe.naturalWidth * probe.naturalHeight > 20_000_000) throw new Error('Choose an image under 20 million pixels.');
      if (id !== generation.current) { URL.revokeObjectURL(url); return; }
      setImage({ file, url, width: probe.naturalWidth, height: probe.naturalHeight });
    } catch (e) { URL.revokeObjectURL(url); if (id === generation.current) setError(e.message.includes('pixels') ? e.message : 'This image could not be opened. Try another JPG or PNG.'); }
  }

  async function analyze() {
    if (!image || loading) return;
    const id = generation.current; const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); setNotice(''); setResult(null); setSaved(false);
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const data = new FormData(); data.append('file', image.file);
      const response = await fetch(`${API}/api/detect`, { method: 'POST', body: data, signal: controller.signal });
      let body; try { body = await response.json(); } catch { throw new Error('The API returned an unreadable response.'); }
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `Analysis failed (HTTP ${response.status}).`);
      validateResult(body);
      if (body.image_width !== image.width || body.image_height !== image.height) throw new Error('The detector image dimensions do not match the preview. Try an image without orientation metadata.');
      if (id === generation.current) { setResult(body); setConnected('online'); }
    } catch (e) {
      if (id === generation.current) setError(e.name === 'AbortError' ? 'Analysis timed out. Check the backend and try again.' : e instanceof TypeError ? 'Could not reach the detector. Check the API URL, backend, and CORS settings.' : e.message);
    } finally { clearTimeout(timeout); if (id === generation.current) setLoading(false); }
  }

  async function save(event) {
    event.preventDefault(); if (!result || !image || saved || saving || storageError) return;
    setError(''); setNotice(''); const id = generation.current; setSaving(true);
    try {
      const location = coordinates(lat, lng);
      if (records.length >= MAX_REPORTS) throw new Error(`This browser has reached the ${MAX_REPORTS}-inspection limit.`);
      const compressed = await thumbnail(image.url);
      if (id !== generation.current) return;
      const record = { id: crypto.randomUUID(), name: image.file.name, createdAt: new Date().toISOString(), ...location, thumbnail: compressed, result };
      const next = [record, ...records];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('The inspection could not be saved. Browser storage may be full or disabled.'); }
      setRecords(next); setSelected(record.id); setSaved(true); setNotice('Inspection saved on this device. Its location is now on the map.');
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function navigate(section) { setActive(section); setMobileNav(false); document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  const detectionCount = records.reduce((total, r) => total + r.result.detections.length, 0);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a className="brand" href="#inspect" onClick={() => navigate('inspect')}><span className="brand-icon"><ScanLine size={23}/></span><span>RoadLens<span className="brand-ai"> AI</span><small>SEE THE ROAD AHEAD</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{[[LayoutDashboard, 'inspect', 'Overview'], [MapPinned, 'map', 'Inspection map'], [FolderOpen, 'reports', 'Saved reports']].map(([Icon,id,label]) => <button key={id} onClick={() => navigate(id)} className={active === id ? 'nav-item active' : 'nav-item'}><Icon size={19}/>{label}{id === 'reports' && <span className="nav-count">{records.length}</span>}</button>)}</nav>
      <div className="sidebar-note"><span className="note-icon"><Navigation size={21}/></span><h3>Small reports.<br/>Better roads.</h3><p>Every inspection is a step toward safer communities.</p><div className="mini-route"><span/><i/><span/></div></div>
      <div className="sidebar-footer"><ShieldCheck size={17}/><span>Public service, powered by AI</span></div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="flex items-center gap-3"><button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={22}/></button><span className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>Overview</strong></span></div><span className={`api-badge ${connected}`}><i/>{connected === 'online' ? 'API connected' : connected === 'checking' ? 'Checking API' : 'API offline'}</span></header>
      <main>
        <section id="inspect" className="intro"><div><div className="eyebrow"><span className="tiny-line"/> ROAD INTELLIGENCE, MADE SIMPLE</div><h1>Better roads start<br/>with a <em>closer look.</em></h1><p>Turn a road photo into an actionable inspection.<br className="desktop-break"/> Detect possible potholes, pin the location, and keep a record.</p></div><div className="intro-mark" aria-hidden="true"><svg viewBox="0 0 240 150"><path d="M10 130 C90 130 50 30 120 30 S170 115 230 65" fill="none" stroke="#c6d9c8" strokeWidth="36"/><path d="M10 130 C90 130 50 30 120 30 S170 115 230 65" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="7 8"/><circle cx="120" cy="30" r="20" fill="#164d3e"/><path d="m112 30 6 6 10-12" fill="none" stroke="#d4f393" strokeWidth="3"/></svg><span><span className="green-dot"/> A clearer picture. A safer journey.</span></div></section>
        <section className="stats-grid" aria-label="Inspection statistics">
          {[[FileImage, records.length, 'Saved inspections', 'Stored on this device'], [ScanLine, detectionCount, 'Possible potholes', 'Across your saved reports'], [MapPin, records.length, 'Mapped locations', 'Ready for a closer look']].map(([Icon,value,label,sub]) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={22}/></div><div><span className="stat-value">{value.toString().padStart(2,'0')}</span><span className="stat-label">{label}</span><small>{sub}</small></div></div>)}
        </section>

        <section className="inspection-grid">
          <div className="panel inspect-panel"><div className="panel-heading"><div className="flex items-center gap-3"><span className="step-number">01</span><div><h2>Inspect a road</h2><p>Upload a photo to get started</p></div></div><span className="subtle-badge">JPG / PNG</span></div>
            <input ref={input} id="road-file" className="sr-only" type="file" accept="image/jpeg,image/png" aria-label="Upload road image" onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }}/>
            {!image ? <button className={`upload-zone ${dragging ? 'dragging' : ''}`} onClick={() => input.current.click()} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault();setDragging(false);choose(e.dataTransfer.files?.[0]);}}><span className="upload-icon"><UploadCloud size={29}/></span><strong>Drop your road photo here</strong><span>or <u>browse files</u> from your device</span><small>JPG or PNG · Up to 10 MB · 20 megapixels</small></button> : <div className="preview-area"><div className="image-frame"><img src={image.url} alt="Uploaded road for inspection"/>{result && <Overlay result={result}/>} {loading && <div className="analyzing-layer"><LoaderCircle className="spin" size={24}/><span>Examining your road photo…</span></div>}</div><div className="image-meta"><span><FileImage size={15}/><span className="truncate">{image.file.name}</span></span><button onClick={() => input.current.click()} disabled={loading || saving}>Change photo</button></div></div>}
            <div className="analysis-footer"><span><ShieldCheck size={15}/>AI-assisted, human-reviewed</span><button className="primary-button" onClick={analyze} disabled={!image || loading || saving}>{loading ? <><LoaderCircle className="spin" size={17}/>Analyzing…</> : <><ScanLine size={17}/>{result ? 'Analyze again' : 'Analyze road'}<ArrowRight size={16}/></>}</button></div>
            {error && <div className="message error" role="alert">{error}</div>}
            {notice && <div className="message success" role="status"><CheckCircle2 size={18}/>{notice}</div>}
            <div aria-live="polite">{result && <div className="results"><div className="result-heading"><div><span className="eyebrow">ANALYSIS COMPLETE</span><h3>{result.detections.length ? `${result.detections.length} possible ${result.detections.length === 1 ? 'pothole' : 'potholes'} detected` : 'No potholes detected'}</h3></div><CheckCircle2 size={22}/></div><p>AI can mistake shadows and other features for potholes. Review the highlighted areas before saving.</p><div className="confidence-list">{result.detections.map((d,i) => <span key={i}>#{i+1} · {(d.confidence*100).toFixed(1)}% confidence</span>)}</div>{!result.detections.length && <p>No detections does not guarantee a damage-free road.</p>}</div>}</div>
          </div>

          <div className="panel location-panel"><div className="panel-heading"><div className="flex items-center gap-3"><span className="step-number">02</span><div><h2>Put it on the map</h2><p>Give your inspection a location</p></div></div><MapPin size={20}/></div>
            <form onSubmit={save} noValidate><div className="location-illustration" aria-hidden="true"><div className="location-grid"/><span><MapPin size={27}/></span><i/></div><p className="location-help">Know where this photo was taken?<br/>Add the coordinates to save your report.</p>
              <label htmlFor="latitude">Latitude <span>−90 to 90</span></label><input id="latitude" type="text" inputMode="decimal" placeholder="e.g. 33.6844" value={lat} onChange={e => setLat(e.target.value)} disabled={saving}/>
              <label htmlFor="longitude">Longitude <span>−180 to 180</span></label><input id="longitude" type="text" inputMode="decimal" placeholder="e.g. 73.0479" value={lng} onChange={e => setLng(e.target.value)} disabled={saving}/>
              <button className="save-button" type="submit" disabled={!result || saved || saving || !!storageError}>{saving ? <LoaderCircle className="spin" size={17}/> : saved ? <Check size={17}/> : <Plus size={17}/>} {saving ? 'Saving…' : saved ? 'Inspection saved' : 'Save inspection'}</button>
              <p className="privacy-note"><ShieldCheck size={13}/>{result ? 'Saved only in this browser, on this device.' : 'Analyze a photo to enable saving.'}</p>
            </form>
          </div>
        </section>
        {storageError && <div role="alert" className="message error">{storageError}</div>}

        <section id="map" className="map-section panel"><div className="panel-heading"><div><div className="eyebrow">YOUR INSPECTION NETWORK</div><h2>A local view. A bigger impact.</h2></div><span className="subtle-badge"><MapPin size={13}/>{records.length} locations</span></div><InspectionMap records={records} selected={selected} onSelect={setSelected} onOpen={setReport}/></section>
        <section id="reports" className="reports-section"><div className="section-heading"><div><h2>Recent inspections</h2><p>Your road reports, all in one place.</p></div><span className="subtle-badge">{records.length} / {MAX_REPORTS} saved locally</span></div>
          {!records.length ? <div className="empty-reports"><span><FolderOpen size={25}/></span><div><h3>A fresh start for better roads</h3><p>Your saved inspections will appear here. Upload your first road photo above.</p></div><button onClick={() => navigate('inspect')}>Start an inspection <ArrowRight size={16}/></button></div> : <div className="report-list">{records.map(r => <article className="report-row" key={r.id}><img src={r.thumbnail} alt="Road inspection thumbnail"/><div className="report-description"><h3>{r.name}</h3><p>{date(r.createdAt)} <span>·</span> {r.lat.toFixed(4)}, {r.lng.toFixed(4)}</p></div><span className={`report-count ${r.result.detections.length ? 'has-detections' : ''}`}>{r.result.detections.length} possible potholes</span><button className="map-link" onClick={() => {setSelected(r.id);navigate('map');}} aria-label={`Show ${r.name} on map`}><MapPin size={17}/></button><button className="report-open" onClick={() => setReport(r)}>View report <ArrowRight size={15}/></button></article>)}</div>}
        </section>
        <footer className="page-footer"><span>RoadLens AI <i/> A little attention goes a long way.</span><span><ShieldCheck size={13}/>Reports stay in your browser. Photos are sent to your configured API.</span></footer>
      </main>
    </div>{report && <ReportDialog report={report} onClose={() => setReport(null)}/>}
  </div>;
}
