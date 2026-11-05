import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { DriverIcon } from './driver-icons';
import { openStreetMapProvider, panMapPoint, projectMapPoint, validMapPoint, visibleMapTiles, type MapPoint } from './maps-provider';

const INITIAL_CENTER: MapPoint = { latitude: -15.78, longitude: -47.93 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;

export function DriverMap({ location }: { location: MapPoint | null }) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; center: MapPoint } | null>(null);
  const followLocation = useRef(true);
  const [center, setCenter] = useState<MapPoint>(validMapPoint(location) ? location : INITIAL_CENTER);
  const [zoom, setZoom] = useState(validMapPoint(location) ? 15 : 5);
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
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, center };
    followLocation.current = false;
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    setCenter(panMapPoint(active.center, zoom, event.clientX - active.x, event.clientY - active.y));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
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

  const marker = validMapPoint(location) ? projectMapPoint(location, zoom) : null;
  const projectedCenter = projectMapPoint(center, zoom);
  const worldSize = 256 * 2 ** zoom;
  const markerX = marker ? ((marker.x - projectedCenter.x + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2 : 0;
  const markerY = marker ? marker.y - projectedCenter.y : 0;

  return <div ref={container} className="driver-map" role="region" aria-label="Mapa da região">
    <div className="driver-map__tiles" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {visibleMapTiles(center, zoom, size.width, size.height).map(tile => <img
        key={`${zoom}/${tile.x}/${tile.y}/${retry}`}
        className="driver-map__tile"
        src={openStreetMapProvider.tileUrl(zoom, tile.x, tile.y)}
        alt=""
        draggable={false}
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ left: tile.left, top: tile.top }}
        onError={() => setTileError(true)}
      />)}
      {marker && <span className="driver-map__marker" aria-label="Sua localização no mapa" style={{ left: size.width / 2 + markerX, top: size.height / 2 + markerY }} />}
    </div>
    <div className="driver-map__controls" aria-label="Controles do mapa">
      <button type="button" onClick={() => changeZoom(1)} aria-label="Aumentar zoom">+</button>
      <button type="button" onClick={() => changeZoom(-1)} aria-label="Diminuir zoom">−</button>
      <button type="button" onClick={recenter} disabled={!validMapPoint(location)} aria-label="Centralizar na minha localização" title="Centralizar na minha localização"><DriverIcon name="pin" size={19}/></button>
    </div>
    {!validMapPoint(location) && <div className="driver-map__waiting" role="status">Aguardando localização do aparelho</div>}
    {tileError && <div className="driver-map__error" role="status">Não foi possível carregar o mapa. Verifique a conexão. <button type="button" onClick={() => { setTileError(false); setRetry(value => value + 1); }}>Tentar novamente</button></div>}
    <a className="driver-map__credit" href="https://www.openstreetmap.org/copyright" rel="noreferrer">© colaboradores do OpenStreetMap</a>
  </div>;
}
