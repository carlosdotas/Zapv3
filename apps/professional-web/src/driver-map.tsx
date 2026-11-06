import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { DriverIcon } from './driver-icons';
import { openStreetMapProvider, panMapPoint, projectMapPoint, validMapPoint, visibleMapTiles, type MapPoint } from './maps-provider';

const INITIAL_CENTER: MapPoint = { latitude: -16.62, longitude: -48.74 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const DEMO_PLACE = { name: 'Capital Encomendas', place: 'Centro, Leopoldo de Bulhões - GO', closingTime: 'Fecha às 18h', latitude: -16.62, longitude: -48.74 };
type Route = { points: MapPoint[]; distance: number };

type LocationStatus = 'searching'|'active'|'permission'|'gps_disabled'|'stale'|'unavailable'|'inactive'|'unsupported';
const LOCATION_MESSAGES: Record<LocationStatus, string> = {
  searching: 'Buscando sinal do GPS. Aguarde alguns instantes.', active: 'Atualizando sua localização.',
  permission: 'Permita a localização precisa do aplicativo.', gps_disabled: 'Ative o GPS do aparelho para mostrar sua posição.',
  stale: 'A posição ficou desatualizada. Tente localizar novamente.', unavailable: 'Não foi possível obter a localização. Verifique o sinal do GPS.',
  inactive: 'A localização será ativada ao entrar em serviço.', unsupported: 'Este navegador não oferece acesso à localização.',
};

function ContactRow({ label, name, phone }: { label: string; name: string; phone: string }) {
  const digits = phone.replace(/\D/g, '');
  const icon = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.7a2 2 0 0 1-.6 1.7L7.6 9.4a16 16 0 0 0 7 7l1.3-1.3a2 2 0 0 1 1.7-.6l2.7.4a2 2 0 0 1 1.7 2Z"/></svg>;
  return <div className="driver-place-sheet__company">
    <span className="driver-place-sheet__company-avatar"><DriverIcon name={label === 'Cliente' ? 'pin' : 'package'} size={19}/></span>
    <span className="driver-place-sheet__company-info"><small>{label}</small><strong>{name}</strong>{!digits && <small>(00) 00000-0000 · Exemplo</small>}</span>
    {digits.length >= 12 ? <a className="driver-place-sheet__whatsapp" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" aria-label={`Abrir WhatsApp: ${label}`}>{icon}<span>WhatsApp</span></a> : <button type="button" className="driver-place-sheet__whatsapp" onClick={() => window.alert("Contato de exemplo. O WhatsApp ficará disponível quando o número for cadastrado.")} aria-label={`WhatsApp de ${label}: contato de exemplo`}>{icon}<span>WhatsApp</span></button>}
  </div>;
}

export function DriverMap({ location, locationStatus, onRequestLocation }: { location: MapPoint | null; locationStatus: LocationStatus; onRequestLocation: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; center: MapPoint } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const followLocation = useRef(true);
  const mapTap = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const sheetSwipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const [center, setCenter] = useState<MapPoint>(validMapPoint(location) ? location : INITIAL_CENTER);
  const [zoom, setZoom] = useState(14);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [currentPlace, setCurrentPlace] = useState('Localizando…');
  const geocodeRef = useRef<{ key: string; controller?: AbortController; timer?: number }>({ key: '' });
  const locationKey = validMapPoint(location) ? `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}` : '';

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
    if (!locationKey) {
      setCurrentPlace('Aguardando localização');
      geocodeRef.current.controller?.abort();
      geocodeRef.current = { key: '' };
      return;
    }
    const key = locationKey;
    if (geocodeRef.current.key === key) return;
    geocodeRef.current.controller?.abort();
    if (geocodeRef.current.timer) window.clearTimeout(geocodeRef.current.timer);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      geocodeRef.current = { key, controller };
      setCurrentPlace('Localizando…');
      try {
        const [latitude, longitude] = key.split(',').map(Number);
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', zoom: '16', lat: String(latitude), lon: String(longitude) }).toString();
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('reverse geocoding failed');
        const result = await response.json() as { name?: string; address?: Record<string, string> };
        const address = result.address || {};
        const neighborhood = address.neighbourhood || address.suburb || address.quarter || address.residential;
        const city = address.city || address.town || address.village || address.municipality;
        setCurrentPlace([neighborhood || result.name, city].filter(Boolean).join(' · ') || 'Sua localização');
      } catch {
        if (!controller.signal.aborted) setCurrentPlace('Sua localização');
      }
    }, 1100);
    geocodeRef.current = { key, controller, timer };
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [locationKey]);

  useEffect(() => {
    if (!locationKey || !validMapPoint(location)) { setRoute(null); setRouteError(false); return; }
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => { controller.abort(); if (active) setRouteError(true); }, 12000);
    const { latitude, longitude } = location;
    setRoute(null); setRouteError(false);
    const url = `https://router.project-osrm.org/route/v1/driving/${longitude},${latitude};${DEMO_PLACE.longitude},${DEMO_PLACE.latitude}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('route unavailable'); return response.json(); })
      .then((data: { code?: string; routes?: Array<{ distance: number; geometry?: { coordinates?: number[][] } }> }) => {
        const result = data.routes?.[0];
        const points = result?.geometry?.coordinates?.map(([longitude, latitude]) => ({ latitude, longitude }));
        if (data.code !== 'Ok' || !result || !Number.isFinite(result.distance) || result.distance < 0 || !points || points.length < 2 || !points.every(validMapPoint)) throw new Error('invalid route');
        if (active) setRoute({ points, distance: result.distance });
      })
      .catch(() => { if (active && !controller.signal.aborted) setRouteError(true); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [locationKey]);

  useEffect(() => {
    if (validMapPoint(location) && followLocation.current) {
      setCenter(location);
      setZoom(value => value < 12 ? 15 : value);
    }
  }, [location?.latitude, location?.longitude]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button,a,[role="button"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (placeOpen) {
      if (pointers.current.size === 1) mapTap.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      else if (mapTap.current) mapTap.current.moved = true;
    }
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
    const tap = mapTap.current;
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap.moved = true;
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
    const tap = mapTap.current;
    if (tap?.id === event.pointerId) {
      if (placeOpen && !tap.moved) setPlaceOpen(false);
      mapTap.current = null;
    }
  }

  function beginSheetSwipe(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button,a,[role="button"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetSwipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function endSheetSwipe(event: PointerEvent<HTMLElement>) {
    const swipe = sheetSwipe.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    if (deltaY > 72 && deltaY > Math.abs(deltaX) * 1.2) setPlaceOpen(false);
    sheetSwipe.current = null;
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

  const routePoints = route?.points.map(point => {
    const projected = projectMapPoint(point, tileZoom);
    const x = ((projected.x - projectedCenter.x + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2;
    return { x: size.width / 2 + x * tileScale, y: size.height / 2 + (projected.y - projectedCenter.y) * tileScale };
  }) ?? [];
  const lengths = routePoints.slice(1).map((point, index) => Math.hypot(point.x - routePoints[index].x, point.y - routePoints[index].y));
  const halfway = lengths.reduce((sum, length) => sum + length, 0) / 2;
  let walked = 0;
  let routeLabel = routePoints[0];
  for (let i = 0; i < lengths.length; i++) {
    if (walked + lengths[i] >= halfway && lengths[i] > 0) {
      const fraction = (halfway - walked) / lengths[i];
      routeLabel = { x: routePoints[i].x + (routePoints[i + 1].x - routePoints[i].x) * fraction, y: routePoints[i].y + (routePoints[i + 1].y - routePoints[i].y) * fraction };
      break;
    }
    walked += lengths[i];
  }
  const distanceText = route ? route.distance < 1000 ? `${Math.round(route.distance)} m` : `${(route.distance / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '';

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
      </div>
      {routePoints.length > 1 && <svg className="driver-map__route" width={size.width} height={size.height} aria-label={`Rota de ${distanceText}`} role="img"><polyline points={routePoints.map(point => `${point.x},${point.y}`).join(' ')} className="driver-map__route-outline"/><polyline points={routePoints.map(point => `${point.x},${point.y}`).join(' ')} className="driver-map__route-line"/></svg>}
      {route && routeLabel && <div className="driver-map__route-distance" style={{ left: routeLabel.x, top: routeLabel.y }}>{distanceText}</div>}
      {marker && <div className="driver-you-marker" style={{ left: size.width / 2 + markerX * tileScale, top: size.height / 2 + markerY * tileScale }} aria-label={`Você: ${currentPlace}`}>
        <span className="driver-you-marker__place">{currentPlace}</span><span className="driver-you-marker__dot"/><span className="driver-you-marker__caption">Você</span>
      </div>}
      {(() => {
        const point = projectMapPoint(DEMO_PLACE, tileZoom);
        const x = ((point.x - projectedCenter.x + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2;
        const y = point.y - projectedCenter.y;
        return <button type="button" className="driver-call-marker" style={{ left: size.width / 2 + x * tileScale, top: size.height / 2 + y * tileScale }} aria-label={`Ver detalhes de ${DEMO_PLACE.name} em ${DEMO_PLACE.place}`} onClick={() => setPlaceOpen(open => !open)}>
          <span className="driver-call-place-label">{DEMO_PLACE.place}</span>
          <span className="driver-call-box"><svg viewBox="0 0 64 62" aria-hidden="true"><path d="M32 3 59 16v28L32 58 5 44V16Z" fill="#ff5e00" stroke="white" strokeWidth="3" strokeLinejoin="round"/><path d="m5 16 27 13 27-13M32 29v29" fill="none" stroke="white" strokeWidth="2"/><path d="m18 9.5 27 13" stroke="#ffddb9" strokeWidth="3.5" strokeLinecap="round"/></svg></span>
          <svg className="driver-call-arrow" viewBox="0 0 34 26" aria-hidden="true"><path d="M4 3 17 22 30 3" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 3 17 22 30 3" fill="none" stroke="#0b5187" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>;
      })()}
    </div>
    <div className="driver-map__controls" aria-label="Controles do mapa">
      <button type="button" onClick={recenter} disabled={!validMapPoint(location)} aria-label="Centralizar na minha localização" title="Centralizar na minha localização"><DriverIcon name="location" size={22}/></button>
    </div>
    {placeOpen && createPortal(<div className="driver-place-sheet-backdrop">
      <section className="driver-place-sheet" role="dialog" aria-modal="false" aria-label={`Detalhes de ${DEMO_PLACE.name}`} onPointerDown={beginSheetSwipe} onPointerUp={endSheetSwipe} onPointerCancel={() => { sheetSwipe.current = null; }}>
        <div className="driver-place-sheet__handle" />
        <button type="button" className="driver-place-sheet__close" onClick={() => setPlaceOpen(false)} aria-label="Fechar detalhes">×</button>
        <div className="driver-place-sheet__photo"><DriverIcon name="package" size={30}/><span>Foto</span></div>
        <div className="driver-place-sheet__content">
          <strong className="driver-place-sheet__title">{DEMO_PLACE.name}</strong>
          <span className="driver-place-sheet__address">{DEMO_PLACE.place}</span>
          <div className="driver-place-sheet__meta"><span><DriverIcon name="location" size={17}/>{route ? distanceText : routeError ? 'Rota indisponível' : 'Calculando rota…'}</span><b>{DEMO_PLACE.closingTime}</b></div>
        </div>
        <ContactRow label="Transportadora" name={DEMO_PLACE.name} phone="" />
        <ContactRow label="Cliente" name="Cliente demonstrativo" phone="" />
        <div className="driver-place-sheet__actions">
          <button type="button" className="driver-place-sheet__accept"><DriverIcon name="check" size={21}/>Aceitar</button>
          <button type="button" className="driver-place-sheet__reject"><DriverIcon name="close" size={21}/>Recusar</button>
        </div>
      </section>
    </div>, document.body)}
    {!validMapPoint(location) && <div className="driver-map__waiting" role="status"><span>{LOCATION_MESSAGES[locationStatus]}</span><button type="button" onClick={onRequestLocation}>Tentar novamente</button></div>}
    {routeError && <div className="driver-map__route-error" role="status">Não foi possível calcular a rota. Verifique a conexão.</div>}
    {tileError && <div className="driver-map__error" role="status">Não foi possível carregar o mapa. Verifique a conexão. <button type="button" onClick={() => { setTileError(false); setRetry(value => value + 1); }}>Tentar novamente</button></div>}
    <a className="driver-map__credit" href="https://www.openstreetmap.org/copyright" rel="noreferrer">© colaboradores do OpenStreetMap</a>
  </div>;
}
