import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { DriverIcon } from './driver-icons';
import { openStreetMapProvider, panMapPoint, projectMapPoint, validMapPoint, visibleMapTiles, type MapPoint } from './maps-provider';

const INITIAL_CENTER: MapPoint = { latitude: -16.62, longitude: -48.74 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const DEMO_CALLS = [
  { id: 'centro', place: 'Centro', km: '5 km', price: 'R$ 25,99', latitude: -16.62, longitude: -48.74 },
  { id: 'jundiai', place: 'Setor Central', km: '8 km', price: 'R$ 32,50', latitude: -16.6188, longitude: -48.7388 },
  { id: 'jaiara', place: 'Leopoldo de Bulhões, GO', km: '12 km', price: 'R$ 41,90', latitude: -16.6213, longitude: -48.7420 },
];

export function DriverMap({ location }: { location: MapPoint | null }) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; center: MapPoint } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const followLocation = useRef(false);
  const [center, setCenter] = useState<MapPoint>(INITIAL_CENTER);
  const [zoom, setZoom] = useState(14);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (validMapPoint(location) && followLocation.current) {
      setCenter(location);
      setZoom(value => value < 12 ? 15 : value);
    }
  }, [location?.latitude, location?.longitude]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button,a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
      followLocation.current = false;
      return;
    }
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, center };
    followLocation.current = false;
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const delta = Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance);
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.current.zoom + delta)));
      return;
    }
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    setCenter(panMapPoint(active.center, zoom, event.clientX - active.x, event.clientY - active.y));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  function changeZoom(amount: number) {
    followLocation.current = false;
    setZoom(current => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + amount)));
  }

  function recenter() {
    if (!validMapPoint(location)) return;
    followLocation.current = true;
    setCenter(location);
    setZoom(15);
  }

  const tileZoom = Math.floor(zoom);
  const tileScale = 2 ** (zoom - tileZoom);
  const marker = validMapPoint(location) ? projectMapPoint(location, tileZoom) : null;
  const projectedCenter = projectMapPoint(center, tileZoom);
  const worldSize = 256 * 2 ** tileZoom;
  const markerX = marker ? ((marker.x - projectedCenter.x + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2 : 0;
  const markerY = marker ? marker.y - projectedCenter.y : 0;

  return <div ref={container} className="driver-map" role="region" aria-label="Mapa da região">
    <div className="driver-map__tiles" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div className="driver-map__scale" style={{ transform: `scale(${tileScale})` }}>
      {visibleMapTiles(center, tileZoom, size.width, size.height).map(tile => <img
        key={`${tileZoom}/${tile.x}/${tile.y}/${retry}`}
        className="driver-map__tile"
        src={openStreetMapProvider.tileUrl(tileZoom, tile.x, tile.y)}
        alt=""
        draggable={false}
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ left: tile.left, top: tile.top }}
        onError={() => setTileError(true)}
      />)}
      {marker && <span className="driver-map__marker" aria-label="Sua localização no mapa" style={{ left: size.width / 2 + markerX, top: size.height / 2 + markerY }} />}
      {DEMO_CALLS.map(call => {
        const point = projectMapPoint({ latitude: call.latitude, longitude: call.longitude }, tileZoom);
        const x = ((point.x - projectedCenter.x + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2;
        const y = point.y - projectedCenter.y;
        return <div key={call.id} className="driver-call-marker" style={{ left: size.width / 2 + x, top: size.height / 2 + y }} aria-label={`Capital Encomendas, ${call.place}, ${call.km}, ${call.price}`}>
          <div className="driver-call-card"><div className="driver-call-company"><span className="driver-call-avatar"><DriverIcon name="package" size={17}/></span><strong>Capital Encomendas</strong></div><strong className="driver-call-place">{call.place}</strong><div className="driver-call-details"><span>{call.km}</span><b>{call.price}</b></div></div>
          <div className="driver-call-box"><svg viewBox="0 0 64 62" aria-hidden="true"><path d="M32 3 59 16v28L32 58 5 44V16Z" fill="#ff5e00" stroke="white" strokeWidth="3" strokeLinejoin="round"/><path d="m5 16 27 13 27-13M32 29v29" fill="none" stroke="white" strokeWidth="2"/><path d="m18 9.5 27 13" stroke="#ffddb9" strokeWidth="3.5" strokeLinecap="round"/></svg></div><svg className="driver-call-arrow" viewBox="0 0 34 26" aria-hidden="true"><path d="M4 3 17 22 30 3" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 3 17 22 30 3" fill="none" stroke="#0b5187" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>;
      })}
      </div>
    </div>
    <div className="driver-map__controls" aria-label="Controles do mapa">
      <button type="button" onClick={recenter} disabled={!validMapPoint(location)} aria-label="Centralizar na minha localização" title="Centralizar na minha localização"><DriverIcon name="location" size={22}/></button>
    </div>
    {!validMapPoint(location) && <div className="driver-map__waiting" role="status">Aguardando localização do aparelho</div>}
    {tileError && <div className="driver-map__error" role="status">Não foi possível carregar o mapa. Verifique a conexão. <button type="button" onClick={() => { setTileError(false); setRetry(value => value + 1); }}>Tentar novamente</button></div>}
    <a className="driver-map__credit" href="https://www.openstreetmap.org/copyright" rel="noreferrer">© colaboradores do OpenStreetMap</a>
  </div>;
}
