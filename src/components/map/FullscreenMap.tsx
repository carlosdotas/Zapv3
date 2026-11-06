import { isCollectionCenterPlace, formatClaimDistance, getDriverStatusInfo, createUserLocationIcon, getVehicleInfo } from './mapMarkers';
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { X, MapPin, User, Phone, ChevronRight, ChevronDown, Building2, AlertTriangle, Zap, Check, Package, Navigation, RefreshCw, Loader2 } from 'lucide-react';
import { GoogleMapsIcon, WazeIcon, openExternalNavigation } from './NavAppIcons';
import { useMapStore } from '../../context/MapContext';
import { reverseGeocode } from '../../services/geocodingService';
import { MapLayerType, Place, OperationType } from '../../types/map';

import { isCustomerMissingLocation } from '../../utils/customerLocationUtils';
import { getMarkerNote } from '../../utils/markerNotes';
import { isStreetOrAddress, calculateDistanceMeters, resolveCommercialClosingTime } from '../../utils/placeUtils';
import { placeService } from '../../services/placeService';
import { ClaimRouteMap } from './ClaimRouteMap';
import { getSavedLocation, saveLocationToStorage } from '../../utils/storage';


import { isDriverStale } from '../../services/driverTrackingClient';
import { formatPhotoUrl } from '../../services/apiAdapters';

import { filterPlacesBySequence } from '../../utils/orderSequence';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { canClaimOrders } from '../../utils/canClaimOrders';
import { fetchMultiStopRoute } from '../../services/routingService';
import { getPlaceCalendarDate, isDateInInterval } from '../../utils/dateFilterUtils';
import { companyService } from '../../services/companyService';
import { getDriverPermanentColor } from '../../utils/driverColorUtils';
import { settingsService } from '../../services/settingsService';

import { CachedTileLayer } from '../../services/tileCache';

// Camadas de Mapa baseadas no Google Maps Oficial (Roadmap, Terreno e Satélite)
const GOOGLE_MAPS_ROADMAP_URL = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_MAPS_TERRAIN_URL = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
const GOOGLE_MAPS_SATELLITE_URL = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_ATTRIBUTION = '&copy; Google Maps';

const TILE_LAYERS: Record<MapLayerType, { url: string; attribution: string; maxZoom: number; subdomains?: string[] }> = {
  default: {
    url: GOOGLE_MAPS_ROADMAP_URL,
    attribution: GOOGLE_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3']
  },
  osm: {
    url: GOOGLE_MAPS_ROADMAP_URL,
    attribution: GOOGLE_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3']
  },
  terrain: {
    url: GOOGLE_MAPS_TERRAIN_URL,
    attribution: GOOGLE_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3']
  },
  dark: {
    url: GOOGLE_MAPS_ROADMAP_URL,
    attribution: GOOGLE_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3']
  },
  satellite: {
    url: GOOGLE_MAPS_SATELLITE_URL,
    attribution: GOOGLE_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3']
  }
};


import { getPlaceDateBadgeInfo, getPlacePhoto, createPlaceMarkerIcon, createDriverMarkerIcon, computeBearing } from './mapMarkers';
import { hexToRgba, getUserVehicleType, get3DVehicleSvg, get3DGmapsArrowSvg } from './vehicleIcons';
export { getPlaceDateBadgeInfo, getPlacePhoto, createPlaceMarkerIcon } from './mapMarkers';
export { hexToRgba, getUserVehicleType, get3DVehicleSvg, get3DGmapsArrowSvg } from './vehicleIcons';

export const FullscreenMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const placeMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const completedMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<{ outer: L.Polyline; inner: L.Polyline; flow?: L.Polyline } | null>(null);
  const [urgentRadiusKm, setUrgentRadiusKm] = useState(
    settingsService.getSettings().operation.urgentNotificationRadiusKm
  );

  // Janelinha / Modal de Seleção de Encomendas no Local (onmaker)
  const [markerSelectionModal, setMarkerSelectionModal] = useState<{
    placeName: string;
    places: Place[];
    driverClaimMode?: boolean;
  } | null>(null);
  const [showDriverFocusHint, setShowDriverFocusHint] = useState(false);

  // Smooth GPS continuous walking references
  const markerCurrentPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const lastFixTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number>(0);
  const animationStartPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const animationTargetPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const {
    currentCoords,
    mapInstance,
    setMapInstance,
    selectedPlace,
    setSelectedPlace,
    mapLayer,
    mapTheme,
    userLocation,
    isTrackingUser,
    stopUserTracking,
    locateUser,
    activeRoute,
    savedPlaces,
    allPlaces,
    flyToLocation,
    drivers,
    selectedDriver,
    setSelectedDriver,
    vehicleFilter,
    operationFilter,
    operationsFilter,
    user,
    currentRole,
    isDriverOnline,
    openPhotoViewer,
    completedWaypointMarks,
    revertCompletedMark,
    customers,
    openCustomerLocationModal,
    dateRangeFilter,
    claimPublicOrder,
    defaultNavApp,
    setDefaultNavApp,
    routeSelectMode,
    routeSelectedIds,
    toggleRouteSelection
  } = useMapStore();

  // O terminal usa o modo monitor: marcadores próprios, sem labels (MonitorMapLayer)
  const isMonitorMode = currentRole === 'terminal';

  useEffect(() => settingsService.subscribe(settings =>
    setUrgentRadiusKm(settings.operation.urgentNotificationRadiusKm)
  ), []);

  useEffect(() => {
    if (
      !mapInstance ||
      currentRole === 'terminal' ||
      !Number.isFinite(urgentRadiusKm)
    ) return;

    const radiusLayer = L.layerGroup().addTo(mapInstance);
    const openPickupMarkers = allPlaces.filter(place =>
      !isCollectionCenterPlace(place) &&
      place.operationType === 'coleta' &&
      realtimeAssignmentService.isPublicOrder(place) &&
      Number.isFinite(place.coordinates?.lat) &&
      Number.isFinite(place.coordinates?.lng)
    );
    const drawnLocations = new Set<string>();
    for (const place of openPickupMarkers) {
      const locationKey = `${place.coordinates.lat},${place.coordinates.lng}`;
      if (drawnLocations.has(locationKey)) continue;
      drawnLocations.add(locationKey);
      L.circle([place.coordinates.lat, place.coordinates.lng], {
        radius: urgentRadiusKm * 1000,
        color: '#FF5E00',
        weight: 2,
        opacity: 0.8,
        fillColor: '#FF5E00',
        fillOpacity: 0.08,
        dashArray: '6 6',
        interactive: false
      }).addTo(radiusLayer);
    }

    return () => {
      radiusLayer.remove();
    };
  }, [mapInstance, allPlaces, currentRole, urgentRadiusKm]);

  const routeSelectModeRef = useRef(routeSelectMode);
  routeSelectModeRef.current = routeSelectMode;
  const toggleRouteSelectionRef = useRef(toggleRouteSelection);
  toggleRouteSelectionRef.current = toggleRouteSelection;
  const routeRingLayerRef = useRef<L.LayerGroup | null>(null);

  // Diálogo de navegação ao tocar em uma Central de Coletas
  const driversRef = useRef(drivers);
  driversRef.current = drivers;
  const [hubToNavigate, setHubToNavigate] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null);
  const [showHubNavChooser, setShowHubNavChooser] = useState(false);

  // Estados para confirmação do motorista ao assumir pedido público
  const [publicOrderToClaim, setPublicOrderToClaim] = useState<Place | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimToast, setClaimToast] = useState<string | null>(null);

  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const currentRoleRef = useRef(currentRole);
  currentRoleRef.current = currentRole;
  const isDriverOnlineRef = useRef(isDriverOnline);
  isDriverOnlineRef.current = isDriverOnline;
  const isUserManuallyPanningRef = useRef<boolean>(false);
  const driverFocusHintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const setSelectedPlaceRef = useRef(setSelectedPlace);
  setSelectedPlaceRef.current = setSelectedPlace;
  const operationsFilterRef = useRef(operationsFilter);
  operationsFilterRef.current = operationsFilter;
  const customersRef = useRef(customers);
  customersRef.current = customers;
  const handleAddPlaceAtCoordsRef = useRef<((coords: { lat: number; lng: number }, snapRadiusMeters?: number) => Promise<void>) | null>(null);

  // Expõe helper global para abrir foto de coleta concluída no FullScreenPhotoViewer
  useEffect(() => {
    (window as any).openCompletedMarkPhoto = (photoUrl: string, title?: string) => {
      openPhotoViewer(photoUrl, {
        id: 'completed-coleta-photo',
        name: title ? decodeURIComponent(title) : 'Foto da Coleta Concluída',
        address: '',
        coordinates: { lat: 0, lng: 0 },
        imageUrl: photoUrl
      } as any);
    };
    return () => {
      delete (window as any).openCompletedMarkPhoto;
    };
  }, [openPhotoViewer]);

  // Botão "Voltar" da marca finalizada (admin/atendente): desfaz a baixa
  useEffect(() => {
    (window as any).revertCompletedMark = async (markId: string, btn?: HTMLButtonElement) => {
      if (!window.confirm('Voltar esta baixa? O pedido volta ao estado anterior e sai do histórico do motorista.')) return;
      if (btn) { btn.disabled = true; btn.textContent = 'Voltando...'; }
      const ok = await revertCompletedMark(markId);
      if (!ok) {
        if (btn) { btn.disabled = false; btn.textContent = '↩ Voltar baixa'; }
        window.alert('Não foi possível voltar esta baixa. A etapa do pedido pode já ter avançado.');
      }
    };
    return () => {
      delete (window as any).revertCompletedMark;
    };
  }, [revertCompletedMark]);

  // Ação de confirmar e assumir pedido público pelo motorista
  const handleConfirmClaimPublicOrder = async () => {
    if (!publicOrderToClaim) return;
    setIsClaiming(true);
    try {
      const won = await claimPublicOrder(publicOrderToClaim.id, publicOrderToClaim.operationType);
      if (!won) {
        setClaimToast('Este pedido já foi aceito por outro motorista.');
        setTimeout(() => setClaimToast(null), 3500);
        setPublicOrderToClaim(null);
        return;
      }
      setClaimToast(`Pedido aceito! Você é o responsável.`);
      setTimeout(() => setClaimToast(null), 3500);

      // Ao aceitar, apenas fecha o diálogo: não abre os detalhes do pedido
      setPublicOrderToClaim(null);

      if (typeof window !== 'undefined' && (window as any).AndroidApp) {
        (window as any).AndroidApp.showNotification?.("EncomendasZap", "Pedido público assumido com sucesso!");
        (window as any).AndroidApp.vibrate?.(250);
      }
    } catch (err) {
      console.warn('Erro ao assumir pedido público:', err);
      setClaimToast(err instanceof Error ? err.message : 'Erro ao assumir pedido público.');
      setTimeout(() => setClaimToast(null), 3000);
    } finally {
      setIsClaiming(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Load last saved position and zoom from localStorage
    const saved = getSavedLocation();

    const map = L.map(mapContainerRef.current, {
      center: [saved.coords.lat, saved.coords.lng],
      zoom: saved.zoom,
      zoomControl: false, // Clean UI without intrusive default zoom buttons
      attributionControl: false, // Custom clean attribution
      doubleClickZoom: false // Desabilita o zoom de duplo clique para permitir adicionar no local
    });

    const tileConfig = TILE_LAYERS[mapLayer];
    const tileLayer = new CachedTileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || ['a', 'b', 'c']
    }).addTo(map);

    activeTileLayerRef.current = tileLayer;
    setMapInstance(map);

    // O motorista mantém o enquadramento manual até solicitar foco novamente.
    map.on('dragstart', () => {
      if (currentRoleRef.current !== 'motorista' || !isDriverOnlineRef.current) return;

      isUserManuallyPanningRef.current = true;
      setShowDriverFocusHint(false);
      if (driverFocusHintTimerRef.current) {
        clearTimeout(driverFocusHintTimerRef.current);
        driverFocusHintTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zap:manual-pan'));
      }
    });

    // Indica que o motorista pode voltar ao próprio local após 10 segundos sem arrastar.
    map.on('dragend', () => {
      if (currentRoleRef.current !== 'motorista' || !isDriverOnlineRef.current || !isUserManuallyPanningRef.current) return;

      if (driverFocusHintTimerRef.current) clearTimeout(driverFocusHintTimerRef.current);
      driverFocusHintTimerRef.current = setTimeout(() => {
        setShowDriverFocusHint(true);
        driverFocusHintTimerRef.current = null;
      }, 10000);
    });

    // Automatically save last location and zoom when user moves/zooms the map
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      saveLocationToStorage({ lat: center.lat, lng: center.lng }, zoom);
    });

    // Regra EncomendasZap: "se clicao duas vezes num local no mapa deve para add no local"
    // Referências para detecção confiável de duplo clique/duplo toque em desktop e mobile
    let lastClickTime = 0;
    let lastClickPos: L.LatLng | null = null;
    let lastHandledDblClick = 0;

    const handleAddPlaceAtCoords = async (coords: { lat: number; lng: number }, snapRadiusMeters: number = 45) => {
      // Motorista NÃO PODE adicionar pedidos
      if (currentRole === 'motorista') {
        return;
      }

      const now = Date.now();
      if (now - lastHandledDblClick < 600) return;
      lastHandledDblClick = now;

      if (typeof window !== 'undefined' && window.AndroidApp?.vibrate) {
        window.AndroidApp.vibrate(60);
      }

      const tempId = `pedido-${Date.now()}`;
      const orderCode = `EZ-${Math.floor(1000 + Math.random() * 9000)}-GO`;
      const coordStr = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;

      // Define a operação inicial com base nos filtros ativos da barra superior
      const curOps = operationsFilterRef.current;
      const initialOp: OperationType = curOps.coleta ? 'coleta' : curOps.entrega ? 'entrega' : curOps.troca ? 'troca' : 'coleta';

      // 1. SNAPPING INTELIGENTE EM LOCAL CADASTRADO (<= 45 metros)
      try {
        let nearbyFb = placeService.getClosestLocalSync(coords.lat, coords.lng, snapRadiusMeters);
        if (!nearbyFb) {
          const nearRes = await placeService.getLocaisNearby(coords.lat, coords.lng, snapRadiusMeters / 1000);
          const near = nearRes.success ? nearRes.data : null;
          if (near) {
            const full = await placeService.getLocalById(near.id);
            if (full.success && full.data) {
              nearbyFb = { local: full.data, distMeters: near.dist_m ?? calculateDistanceMeters(coords, { lat: Number(near.lat), lng: Number(near.lng) }) };
            }
          }
        }
        if (nearbyFb && nearbyFb.local) {
          const l = nearbyFb.local;
          const fullAddr = l.endereco || [l.rua, l.numero, l.setor, l.cidade].filter(Boolean).join(', ') || l.name;
          const isStreet = isStreetOrAddress({ name: l.name, category: l.setor, address: fullAddr });
          const closing = isStreet ? undefined : resolveCommercialClosingTime({
            name: l.name,
            category: l.setor,
            address: fullAddr,
            horario: l.horario
          });

          const snappedPlace: Place = {
            id: tempId,
            orderCode,
            name: l.name,
            address: fullAddr,
            coordinates: { lat: Number(l.lat), lng: Number(l.lng) },
            operationType: initialOp,
            vehicleType: 'moto',
            packageType: 'caixa',
            orderDateBadge: 'hoje',
            customerName: '',
            customerPhone: l.telefone || '',
            sellerName: '',
            sellerPhone: '',
            managerName: '',
            managerPhone: '',
            responsibleName: '',
            responsiblePhone: '',
            observations: '',
            driverNotes: `Ponto cadastrado na rede EncomendasZap (${Math.round(nearbyFb.distMeters)}m do toque).`,
            category: isStreet ? 'Via pública / Endereço' : (l.central_coletas ? 'Central de Coletas' : (l.setor ? `${l.setor}` : 'Ponto Comercial')),
            openNow: isStreet ? undefined : true,
            closingTime: isStreet ? undefined : closing,
            imageUrl: (l.icon && typeof l.icon === 'string' && l.icon.startsWith('http')) ? l.icon : undefined,
            photos: (l.icon && typeof l.icon === 'string' && l.icon.startsWith('http')) ? [l.icon] : [],
            pickupAddress: initialOp === 'coleta' ? fullAddr : undefined,
            pickupCoordinates: initialOp === 'coleta' ? { lat: Number(l.lat), lng: Number(l.lng) } : undefined,
            deliveryAddress: initialOp === 'entrega' ? fullAddr : undefined,
            deliveryCoordinates: initialOp === 'entrega' ? { lat: Number(l.lat), lng: Number(l.lng) } : undefined,
            exchangeAddress: initialOp === 'troca' ? fullAddr : undefined,
            exchangeCoordinates: initialOp === 'troca' ? { lat: Number(l.lat), lng: Number(l.lng) } : undefined
          };

          setSelectedPlaceRef.current(snappedPlace);
          map.flyTo([Number(l.lat), Number(l.lng)], Math.max(map.getZoom(), 16), { duration: 0.5 });
          return;
        }
      } catch (err) {
        console.warn('Erro ao verificar local próximo:', err);
      }

      // 3. Fallback: cria o rascunho e busca geocodificação reversa
      const newDraftPlace: Place = {
        id: tempId,
        orderCode,
        name: '',
        isResolvingAddress: true,
        address: coordStr,
        coordinates: coords,
        operationType: initialOp,
        vehicleType: 'moto',
        packageType: 'caixa',
        orderDateBadge: 'hoje',
        customerName: '',
        customerPhone: '',
        sellerName: '',
        sellerPhone: '',
        managerName: '',
        managerPhone: '',
        responsibleName: '',
        responsiblePhone: '',
        observations: '',
        driverNotes: '',
        openNow: undefined,
        closingTime: undefined,
        pickupAddress: initialOp === 'coleta' ? coordStr : undefined,
        pickupCoordinates: initialOp === 'coleta' ? coords : undefined,
        deliveryAddress: initialOp === 'entrega' ? coordStr : undefined,
        deliveryCoordinates: initialOp === 'entrega' ? coords : undefined,
        exchangeAddress: initialOp === 'troca' ? coordStr : undefined,
        exchangeCoordinates: initialOp === 'troca' ? coords : undefined
      };

      setSelectedPlaceRef.current(newDraftPlace);
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });

      // Busca o endereço real via geocodificação reversa
      try {
        const geoPlace = await reverseGeocode(coords, snapRadiusMeters);
        if (geoPlace) {
          const finalName = geoPlace.name || (initialOp === 'coleta' ? 'Ponto de Coleta' : initialOp === 'troca' ? 'Ponto de Troca' : 'Ponto de Entrega');
          const finalAddr = geoPlace.address || coordStr;
          const isStreet = isStreetOrAddress({
            name: finalName,
            category: geoPlace.category,
            address: finalAddr
          });
          const closing = isStreet ? undefined : (geoPlace.closingTime || resolveCommercialClosingTime({
            ...geoPlace,
            name: finalName,
            address: finalAddr
          }));

          setSelectedPlaceRef.current(current => {
            if (!current || current.id !== tempId) return current;
            const updatedPlace: Place = {
            ...current,
            name: finalName,
            isResolvingAddress: false,
            address: finalAddr,
            coordinates: geoPlace.coordinates || coords,
            originCity: geoPlace.originCity || 'Goiânia - GO',
            destinationCity: geoPlace.destinationCity || 'Goiânia - GO',
            category: isStreet ? 'Via pública / Endereço' : (geoPlace.category || newDraftPlace.category),
            rating: geoPlace.rating ?? newDraftPlace.rating,
            reviewsCount: geoPlace.reviewsCount ?? newDraftPlace.reviewsCount,
            openNow: isStreet ? undefined : true,
            closingTime: isStreet ? undefined : closing,
            imageUrl: geoPlace.imageUrl,
            photos: geoPlace.photos || (geoPlace.imageUrl ? [geoPlace.imageUrl] : []),
            pickupAddress: current.pickupAddress === coordStr ? finalAddr : current.pickupAddress,
            deliveryAddress: current.deliveryAddress === coordStr ? finalAddr : current.deliveryAddress,
            exchangeAddress: current.exchangeAddress === coordStr ? finalAddr : current.exchangeAddress
          };
            return updatedPlace;
          });
        }
      } catch (err) {
        console.error('Erro na geocodificação reversa ao adicionar no local:', err);
        setSelectedPlaceRef.current(current =>
          current && current.id === tempId ? { ...current, isResolvingAddress: false } : current
        );
      }
    };

    handleAddPlaceAtCoordsRef.current = handleAddPlaceAtCoords;

    // 1. Clique com o botão direito no mapa (contextmenu) para adicionar encomenda / local no ponto:
    // Funciona no Desktop (clique botão direito) e em telas Touch/Mobile (long press / toque e segura)
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
      }
      handleAddPlaceAtCoords({ lat: e.latlng.lat, lng: e.latlng.lng }, 10);
    });

    // 2. Duplo clique como atalho adicional para adicionar no ponto
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
      }
      handleAddPlaceAtCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // 3. Clique normal com o botão esquerdo no mapa:
    // - Se clicar em um marcador ou perto de um marcador existente, seleciona o marcador.
    // - Se clicar no espaço vazio do mapa, apenas fecha/desmarca o card ativo (NÃO abre novo pedido!).
    map.on('click', (e: L.LeafletMouseEvent) => {
      // Ignora se o clique foi em um marcador ou botão existente do mapa
      const targetElem = e.originalEvent?.target as HTMLElement | null;
      if (targetElem && (
        targetElem.closest('.leaflet-marker-icon') ||
        targetElem.closest('.custom-place-marker-icon') ||
        targetElem.closest('.completed-waypoint-x-marker') ||
        targetElem.closest('[data-action]')
      )) {
        return;
      }

      // SNAPPING DE MARCADOR EXISTENTE POR PROXIMIDADE DE TOQUE (Tolerância confortável para toques próximos)
      const clickPt = map.latLngToContainerPoint(e.latlng);
      let nearestMarkerPlace: Place | null = null;
      let nearestPlacesGroup: Place[] = [];
      let minDistancePx = Infinity;
      const CLICK_TOLERANCE_PX = 28;

      placeMarkersRef.current.forEach((marker) => {
        try {
          const markerPos = marker.getLatLng();
          const markerPt = map.latLngToContainerPoint(markerPos);
          const distPx = Math.hypot(clickPt.x - markerPt.x, clickPt.y - markerPt.y);

          if (distPx <= CLICK_TOLERANCE_PX && distPx < minDistancePx) {
            minDistancePx = distPx;
            nearestMarkerPlace = (marker as any)._customPlaceData || null;
            nearestPlacesGroup = (marker as any)._customPlacesAtLocation || (nearestMarkerPlace ? [nearestMarkerPlace] : []);
          }
        } catch {}
      });

      if (nearestMarkerPlace) {
        const availablePublicPlaces = nearestPlacesGroup.filter(
          place => !isCollectionCenterPlace(place) && realtimeAssignmentService.isPublicOrder(place)
        );
        if (canClaimOrders(currentRoleRef.current) && availablePublicPlaces.length > 0) {
          if (availablePublicPlaces.length > 1) {
            setMarkerSelectionModal({
              placeName: (nearestMarkerPlace as Place).name || 'Local',
              places: availablePublicPlaces,
              driverClaimMode: true
            });
          } else {
            setPublicOrderToClaim(availablePublicPlaces[0]);
          }
        } else if (nearestPlacesGroup.length > 1) {
          setMarkerSelectionModal({
            placeName: (nearestMarkerPlace as Place).name || 'Local',
            places: nearestPlacesGroup
          });
        } else {
          setSelectedPlaceRef.current(nearestMarkerPlace);
        }
        return;
      }

      // Clique normal no mapa em espaço vazio: apenas fecha a encomenda/local atualmente selecionado
      setSelectedPlaceRef.current(null);
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      if (driverFocusHintTimerRef.current) {
        clearTimeout(driverFocusHintTimerRef.current);
        driverFocusHintTimerRef.current = null;
      }
      resizeObserver.disconnect();
      map.remove();
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (currentRole === 'motorista' && isDriverOnline) return;

    isUserManuallyPanningRef.current = false;
    setShowDriverFocusHint(false);
    if (driverFocusHintTimerRef.current) {
      clearTimeout(driverFocusHintTimerRef.current);
      driverFocusHintTimerRef.current = null;
    }
  }, [currentRole, isDriverOnline]);

  // Listener para eventos de foco do motorista e trava manual de arrasto
  useEffect(() => {
    const handleFocusDriver = (e: Event) => {
      isUserManuallyPanningRef.current = false;
      setShowDriverFocusHint(false);
      if (driverFocusHintTimerRef.current) {
        clearTimeout(driverFocusHintTimerRef.current);
        driverFocusHintTimerRef.current = null;
      }
      const customEv = e as CustomEvent<{ coords?: { lat: number; lng: number }; zoom?: number }>;
      const targetCoords = customEv.detail?.coords || markerCurrentPosRef.current || userLocationRef.current || currentCoords;
      const zoom = customEv.detail?.zoom || 17;
      if (mapInstance && targetCoords && typeof targetCoords.lat === 'number' && !isNaN(targetCoords.lat)) {
        mapInstance.flyTo([targetCoords.lat, targetCoords.lng], zoom, {
          duration: 1.0,
          easeLinearity: 0.25
        });
      }
    };

    const handleManualPan = () => {
      isUserManuallyPanningRef.current = true;
    };

    window.addEventListener('zap:focus-driver', handleFocusDriver);
    window.addEventListener('zap:manual-pan', handleManualPan);
    return () => {
      window.removeEventListener('zap:focus-driver', handleFocusDriver);
      window.removeEventListener('zap:manual-pan', handleManualPan);
    };
  }, [mapInstance, currentCoords]);

  // Sync active layer
  useEffect(() => {
    if (!mapInstance) return;

    if (activeTileLayerRef.current) {
      mapInstance.removeLayer(activeTileLayerRef.current);
    }

    const tileConfig = TILE_LAYERS[mapLayer];
    const newLayer = new CachedTileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || ['a', 'b', 'c']
    }).addTo(mapInstance);

    activeTileLayerRef.current = newLayer;
  }, [mapLayer, mapInstance]);

  // Sync visible places on map (Popular & Saved places highlighted in blue)
  useEffect(() => {
    if (!mapInstance) return;

    if (isMonitorMode) {
      placeMarkersRef.current.forEach(marker => mapInstance.removeLayer(marker));
      placeMarkersRef.current.clear();
      return;
    }

    // Regra para motorista: Ele NÃO pode ver markers que não foram destinados a ele!
    // Apenas vê pontos atribuídos especificamente a ele (assignedDriverId ou assignedDriverPhone)
    const isDriverRole = currentRole === 'motorista';

    // Helper em tempo real para checar se a encomenda foi direcionada a este motorista
    const isPlaceAssignedToDriver = (p: Place): boolean => {
      return realtimeAssignmentService.isPlaceAssignedToUser(p, user);
    };

    // Combine unique places (somente as encomendas reais buscadas do servidor)
    const rawPlacesMap = new Map<string, Place>();
    const sourcePlaces = allPlaces || [];
    savedPlaces.filter(p => !p.id.startsWith('pedido-')).forEach(p => rawPlacesMap.set(p.id, p));
    sourcePlaces.forEach(p => rawPlacesMap.set(p.id, p));

    // Regra Multi-Empresa e Transportadoras:
    // - Locais físicos de mapa (POIs) estão disponíveis para todos.
    // - Pedidos e encomendas são filtrados por empresa (Master Admin 62996157340 vê tudo).
    // - Motoboys vêem apenas os pedidos das empresas que os autorizarem.
    const companyFilteredPlaces = Array.from(rawPlacesMap.values()).filter(p => 
      companyService.canUserAccessPlace(p, user?.phone, currentRole)
    );

    // Regra Estrita de Sequência EncomendasZap:
    // 1. Para a entrega depois que fizer a coleta.
    // 2. E a troca também. Só pode mostrar a troca depois que fizer a coleta.
    // 3. Aí nesse caso, só pode mostrar a entrega depois que fizer a troca. Tem uma sequência.
    // Também respeita filtros explícitos de operações para visualização e marcas concluídas
    const sequencedPlacesList = filterPlacesBySequence(
      companyFilteredPlaces,
      completedWaypointMarks,
      isDriverRole ? undefined : operationsFilter
    );
    const allPlacesMap = new Map<string, Place>();
    sequencedPlacesList.forEach(p => allPlacesMap.set(p.id, p));

    // Clear removed markers (incluindo etapas futuras que ainda não devem aparecer)
    placeMarkersRef.current.forEach((marker, id) => {
      if (!allPlacesMap.has(id)) {
        mapInstance.removeLayer(marker);
        placeMarkersRef.current.delete(id);
      }
    });

    // Agrupa pedidos no mesmo ponto mesmo quando o nome do local varia entre registros.
    const getGroupKey = (p: Place): string => {
      const latRounded = Math.round(p.coordinates.lat * 10000) / 10000;
      const lngRounded = Math.round(p.coordinates.lng * 10000) / 10000;
      return `${latRounded}_${lngRounded}`;
    };

    const locationGroupsMap = new Map<string, Place[]>();
    allPlacesMap.forEach(p => {
      // 1. Finalizada: quando entrega já foi finalizada (concluída), NÃO PODE APARECER no mapa
      if (p.orderStage === 'concluido' || (p.operationType as any) === 'concluido') return;

      // 2. Filtro de Calendário / Período
      if (dateRangeFilter.startDate || dateRangeFilter.endDate) {
        const placeDate = getPlaceCalendarDate(p);
        if (!isDateInInterval(placeDate, dateRangeFilter.startDate, dateRangeFilter.endDate)) {
          return;
        }
      }

      // Se for motorista, verifica atribuição
      if (isDriverRole) {
        if (!isPlaceAssignedToDriver(p)) return;
      }
      const op = p.operationType || 'entrega';
      if (!operationsFilter[op]) return;

      const key = getGroupKey(p);
      const existing = locationGroupsMap.get(key) || [];
      existing.push(p);
      locationGroupsMap.set(key, existing);
    });

    // Add or update markers with vivid blue pins and labels
    allPlacesMap.forEach((place) => {
      // 1. Se a encomenda estiver concluída/entregue, remove do mapa se existir e pula
      if (place.orderStage === 'concluido' || (place.operationType as any) === 'concluido') {
        if (placeMarkersRef.current.has(place.id)) {
          mapInstance.removeLayer(placeMarkersRef.current.get(place.id)!);
          placeMarkersRef.current.delete(place.id);
        }
        return;
      }

      // 2. Filtro de Calendário / Período
      if (dateRangeFilter.startDate || dateRangeFilter.endDate) {
        const placeDate = getPlaceCalendarDate(place);
        if (!isDateInInterval(placeDate, dateRangeFilter.startDate, dateRangeFilter.endDate)) {
          if (placeMarkersRef.current.has(place.id)) {
            mapInstance.removeLayer(placeMarkersRef.current.get(place.id)!);
            placeMarkersRef.current.delete(place.id);
          }
          return;
        }
      }

      // Se for motorista, só vê se for destinado a ele
      if (isDriverRole) {
        if (!isPlaceAssignedToDriver(place)) {
          if (placeMarkersRef.current.has(place.id)) {
            mapInstance.removeLayer(placeMarkersRef.current.get(place.id)!);
            placeMarkersRef.current.delete(place.id);
          }
          return;
        }
      }

      // Filtra por operações marcadas no topo (Coleta, Entrega, Troca - persistido na memória)
      const op = place.operationType || 'entrega';
      if (!operationsFilter[op]) {
        if (placeMarkersRef.current.has(place.id)) {
          mapInstance.removeLayer(placeMarkersRef.current.get(place.id)!);
          placeMarkersRef.current.delete(place.id);
        }
        return;
      }

      const key = getGroupKey(place);
      const placesAtLocation = locationGroupsMap.get(key) || [place];

      // Se há mais de uma encomenda neste local, apenas a primeira cria/mantém o marcador mestre
      if (placesAtLocation.length > 1 && placesAtLocation[0].id !== place.id) {
        if (placeMarkersRef.current.has(place.id)) {
          mapInstance.removeLayer(placeMarkersRef.current.get(place.id)!);
          placeMarkersRef.current.delete(place.id);
        }
        return;
      }

      const isSelected = placesAtLocation.some(p => p.id === selectedPlace?.id);
          const isPublicForDriver = canClaimOrders(currentRole) && placesAtLocation.some(p => !isCollectionCenterPlace(p) && realtimeAssignmentService.isPublicOrder(p));
      const distanceLabel = isPublicForDriver ? formatClaimDistance(userLocationRef.current, place.coordinates) : '';
      const driverStatus = isDriverRole ? null : getDriverStatusInfo(placesAtLocation, driversRef.current);
      const iconSignature = JSON.stringify([place.id, place.orderStage, place.name, place.imageUrl, place.photos, place.pickupPhotos, isSelected, isPublicForDriver, distanceLabel, driverStatus?.text, placesAtLocation.map(p => [p.id, getMarkerNote(p)])]);

      if (placeMarkersRef.current.has(place.id)) {
        const marker = placeMarkersRef.current.get(place.id)!;
        if ((marker as any)._iconSignature !== iconSignature) {
          (marker as any)._iconSignature = iconSignature;
          const icon = createPlaceMarkerIcon(place, isSelected, placesAtLocation, isPublicForDriver, distanceLabel, driverStatus);
          marker.setIcon(icon);
        }
        (marker as any)._driverStatusText = driverStatus?.text || '';
        (marker as any)._distanceLabel = distanceLabel;
        marker.setLatLng([place.coordinates.lat, place.coordinates.lng]);
        marker.setZIndexOffset(isPublicForDriver ? 600 : isSelected ? 500 : 100);
        (marker as any)._customPlaceData = place;
        (marker as any)._customPlacesAtLocation = placesAtLocation;
        (marker as any)._isPublicForDriver = isPublicForDriver;
      } else {
        const icon = createPlaceMarkerIcon(place, isSelected, placesAtLocation, isPublicForDriver, distanceLabel, driverStatus);
        const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
          icon,
          zIndexOffset: isPublicForDriver ? 600 : isSelected ? 500 : 100
        }).addTo(mapInstance);
        (marker as any)._iconSignature = iconSignature;

        (marker as any)._customPlaceData = place;
        (marker as any)._customPlacesAtLocation = placesAtLocation;
        (marker as any)._isPublicForDriver = isPublicForDriver;
        (marker as any)._distanceLabel = distanceLabel;
        (marker as any)._driverStatusText = driverStatus?.text || '';

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }

          const currentPlace = (marker as any)._customPlaceData || place;
          const currentGroup: Place[] = (marker as any)._customPlacesAtLocation || [currentPlace];

          if (currentGroup.length === 1 && (e.originalEvent?.target as HTMLElement)?.closest('.place-marker-photo-trigger')) {
            const photo = getPlacePhoto(currentPlace);
            if (photo) openPhotoViewer(formatPhotoUrl(photo, 'lg') || photo, currentPlace);
            return;
          }

          // Modo "Passar rota": o clique apenas marca/desmarca os locais deste marcador
          if (routeSelectModeRef.current) {
            const ids = currentGroup.filter(p => !isCollectionCenterPlace(p)).map(p => p.id);
            if (ids.length > 0) toggleRouteSelectionRef.current(ids);
            return;
          }

          // Em locais compartilhados, o motorista escolhe qual pedido público deseja aceitar.
          if (canClaimOrders(currentRole)) {
            const availablePublicPlaces = currentGroup.filter(p => !isCollectionCenterPlace(p) && realtimeAssignmentService.isPublicOrder(p));
            if (availablePublicPlaces.length > 0) {
              if (availablePublicPlaces.length > 1) {
                setMarkerSelectionModal({
                  placeName: currentPlace.name || 'Local',
                  places: availablePublicPlaces,
                  driverClaimMode: true
                });
              } else {
                setPublicOrderToClaim(availablePublicPlaces[0]);
              }
              return;
            }
          }

          // Quando tiver mais de uma encomenda no mesmo local (onmaker):
          // "Coloca um onmaker. Quando clicar nela, deve abrir uma janelinha perguntando qual que a pessoa quer acessar."
          if (currentGroup.length > 1) {
            setMarkerSelectionModal({
              placeName: currentPlace.name || 'Local',
              places: currentGroup
            });
            return;
          }

          // Abre sempre os detalhes da encomenda ao clicar (nunca abre a foto diretamente)
          // A foto só abre automaticamente quando o motorista chega fisicamente ao local (raio de 75m)
          setSelectedPlace(currentPlace);
        });

        marker.on('dblclick', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
        });

        marker.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          if (currentRole === 'motorista') return;
          // Clique com botão direito no marcador abre criação de novo pedido neste local
          handleAddPlaceAtCoordsRef.current?.({ lat: place.coordinates.lat, lng: place.coordinates.lng });
        });

        placeMarkersRef.current.set(place.id, marker);
      }
    });
  }, [mapInstance, savedPlaces, allPlaces, selectedPlace, operationsFilter, flyToLocation, setSelectedPlace, openPhotoViewer, currentRole, completedWaypointMarks, openCustomerLocationModal, dateRangeFilter, isMonitorMode]);

  // Atualiza o status do motorista (aceito/indo + distância) dentro da label quando ele se move
  useEffect(() => {
    if (currentRole === 'motorista') return;
    placeMarkersRef.current.forEach((marker) => {
      const m = marker as any;
      if (!m._customPlaceData || m._isPublicForDriver) return;
      const status = getDriverStatusInfo(m._customPlacesAtLocation || [m._customPlaceData], drivers);
      const text = status?.text || '';
      if (text === (m._driverStatusText || '')) return;
      m._driverStatusText = text;
      marker.setIcon(createPlaceMarkerIcon(
        m._customPlaceData,
        selectedPlace?.id === m._customPlaceData.id,
        m._customPlacesAtLocation || [m._customPlaceData],
        false,
        '',
        status
      ));
    });
  }, [drivers, currentRole, selectedPlace?.id]);

  // Atualiza a distância mostrada no botão "Aceitar" quando o GPS do motoboy muda
  useEffect(() => {
    placeMarkersRef.current.forEach((marker) => {
      const m = marker as any;
      if (!m._isPublicForDriver || !m._customPlaceData) return;
      const label = formatClaimDistance(userLocation, m._customPlaceData.coordinates);
      if (label === m._distanceLabel) return;
      m._distanceLabel = label;
      marker.setIcon(createPlaceMarkerIcon(
        m._customPlaceData,
        false,
        m._customPlacesAtLocation || [m._customPlaceData],
        true,
        label
      ));
    });
  }, [userLocation]);

  // Sincroniza Marcadores de Baixa no Solo (Apenas um 'X' - e ao clicar abre label com detalhes, fotos, motorista e horário)
  useEffect(() => {
    if (!mapInstance) return;

    if (isMonitorMode) {
      completedMarkersRef.current.forEach(marker => mapInstance.removeLayer(marker));
      completedMarkersRef.current.clear();
      return;
    }

    // Só mostra as baixas feitas pelo próprio usuário logado (nunca as de outros usuários)
    const myId = user?.id ? String(user.id).replace(/\D/g, '') : '';
    const myName = (user?.name || '').trim().toLowerCase();
    const isStaffViewer = currentRole === 'admin_geral' || currentRole === 'atendente' || (currentRole as string) === 'admin';
    const ownMarks = isStaffViewer ? completedWaypointMarks : completedWaypointMarks.filter(m => {
      if (m.driverId) return Boolean(myId) && String(m.driverId).replace(/\D/g, '') === myId;
      return Boolean(myName) && (m.driverName || '').trim().toLowerCase() === myName;
    });

    const currentMarkIds = new Set(ownMarks.map(m => m.id));

    // Remove marcadores antigos excluídos
    completedMarkersRef.current.forEach((marker, id) => {
      if (!currentMarkIds.has(id)) {
        mapInstance.removeLayer(marker);
        completedMarkersRef.current.delete(id);
      }
    });

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const hasDateFilter = Boolean(dateRangeFilter.startDate || dateRangeFilter.endDate);

    // Renderiza cada marcação com APENAS UM 'X' no chão
    ownMarks.forEach((mark) => {
      const markDate = (mark.completedDate || '').slice(0, 10);

      // Regra EncomendasZap estrita:
      // "makers finalizadas so pode mostrar as do dia atual ou se filtrar"
      if (hasDateFilter) {
        if (markDate && !isDateInInterval(markDate, dateRangeFilter.startDate, dateRangeFilter.endDate)) {
          if (completedMarkersRef.current.has(mark.id)) {
            mapInstance.removeLayer(completedMarkersRef.current.get(mark.id)!);
            completedMarkersRef.current.delete(mark.id);
          }
          return;
        }
      } else {
        // Sem filtro: SÓ PODE MOSTRAR AS DO DIA ATUAL!
        if (markDate && markDate !== todayStr) {
          if (completedMarkersRef.current.has(mark.id)) {
            mapInstance.removeLayer(completedMarkersRef.current.get(mark.id)!);
            completedMarkersRef.current.delete(mark.id);
          }
          return;
        }
      }
      if (!completedMarkersRef.current.has(mark.id)) {
        const isFailed = mark.status === 'failed' || Boolean(mark.receiverName?.toLowerCase().includes('insucesso'));
        const opColor = isFailed ? '#E11D48' : mark.operationType === 'coleta' ? '#0B5187' : mark.operationType === 'troca' ? '#7C3AED' : '#FF5E00';
        const opLabel = isFailed 
          ? (mark.receiverName || 'Tentativa sem sucesso')
          : mark.operationType === 'coleta' ? 'Coleta concluída' : mark.operationType === 'troca' ? 'Troca realizada' : 'Entrega concluída';

        // 1. MARCADOR NO MAPA: APENAS UM 'X' COMPACTO (Discreto, nítido e elegante no solo)
        const completedIcon = L.divIcon({
          className: 'completed-waypoint-x-marker',
          html: `
            <div class="completed-x-marker-wrap" style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; cursor: pointer; transition: transform 0.15s ease;" title="${opLabel} às ${mark.timeStr || ''} • Clique para ver detalhes e fotos">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45));">
                <ellipse cx="17" cy="30" rx="9" ry="2.6" fill="rgba(0, 0, 0, 0.25)" />
                <path d="M17 4 L28 9.5 V21.5 L17 27 L6 21.5 V9.5 Z" fill="${opColor}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round" />
                <path d="M6 9.5 L17 15 L28 9.5 M17 15 V27" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="1.4" stroke-linejoin="round" />
                <path d="M11.5 7 L22.5 12.5" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="1.4" />
                <circle cx="26" cy="9" r="6" fill="#FFFFFF" stroke="${opColor}" stroke-width="1.6" />
                ${isFailed
                  ? `<path d="M23.4 6.4 L28.6 11.6 M23.4 11.6 L28.6 6.4" stroke="${opColor}" stroke-width="2" stroke-linecap="round" />`
                  : `<path d="M23.2 9.2 L25.3 11.2 L28.9 6.9" stroke="${opColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`}
              </svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 24]
        });

        // 2. FOTOS DA COLETA / BAIXA
        const photosList = Array.isArray(mark.photos) && mark.photos.length > 0 
          ? mark.photos 
          : (mark.imageUrl ? [mark.imageUrl] : []);

        const photosHtml = photosList.length > 0
          ? `
            <div style="margin-top: 8px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                <span>📸 Fotos da Coleta (${photosList.length})</span>
                <span style="font-size: 9.5px; color: #0B5187; font-weight: bold;">Toque para ampliar</span>
              </div>
              <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin;">
                ${photosList.map((url) => `
                  <div onclick="window.openCompletedMarkPhoto('${url.replace(/'/g, "\\'")}', '${encodeURIComponent(mark.placeName)}')" style="cursor: pointer; position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 1.5px solid #CBD5E1; flex-shrink: 0; background: #0F172A; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <img src="${url}" alt="Foto da Coleta" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'" />
                  </div>
                `).join('')}
              </div>
            </div>
          `
          : `
            <div style="margin-top: 8px; padding: 6px 8px; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; font-size: 10px; color: #94A3B8; text-align: center;">
              Sem fotos anexadas no registro
            </div>
          `;

        // 3. POPUP LABEL COMPLETA (DETALHES, FOTOS, MOTORISTA E HORÁRIO)
        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px; max-width: 295px; color: #1E293B;">
            <!-- Cabeçalho -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;">
              <span style="background: ${opColor}; color: #FFFFFF; font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 3px;">
                <span>✔</span>
                <span>${mark.operationType === 'coleta' ? 'Coleta Concluída' : opLabel}</span>
              </span>
              <span style="font-size: 11px; font-weight: 800; color: #0B5187; background: #E8F2FA; padding: 2px 6px; border-radius: 6px;">
                🕒 ${mark.timeStr || '--:--'}
              </span>
            </div>

            <!-- Local e Cliente -->
            <div style="margin-bottom: 6px;">
              <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 900; color: #0F172A; line-height: 1.2;">
                ${mark.placeName}
              </h4>
              ${mark.customerName && mark.customerName !== mark.placeName ? `
                <p style="margin: 0 0 2px 0; font-size: 11px; font-weight: 700; color: #475569;">
                  👤 Cliente: ${mark.customerName}
                </p>
              ` : ''}
              <p style="margin: 0; font-size: 10.5px; color: #64748B; line-height: 1.3;">
                📍 ${mark.address || 'Endereço registrado'}
              </p>
              ${mark.orderCode ? `
                <p style="margin: 3px 0 0 0; font-size: 10px; font-family: monospace; font-weight: 800; color: #0B5187;">
                  📦 ${mark.orderCode}
                </p>
              ` : ''}
            </div>

            <!-- Motorista que Coletou e Hora Exata -->
            <div style="background: #F1F5F9; border-radius: 8px; padding: 6px 8px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; border: 1px solid #E2E8F0;">
              <div style="font-size: 11px; font-weight: 800; color: #1E293B; display: flex; align-items: center; gap: 4px;">
                <span>🏍️</span>
                <span>Motorista que coletou: <strong style="color: #0B5187;">${mark.driverName || 'Motorista'}</strong></span>
              </div>
              <div style="font-size: 10.5px; font-weight: 600; color: #64748B; display: flex; align-items: center; gap: 4px;">
                <span>⏰</span>
                <span>Hora da coleta: <strong style="color: #0F172A;">${mark.timeStr}</strong></span>
              </div>
            </div>

            <!-- Fotos -->
            ${photosHtml}
            ${isStaffViewer ? `
              <button type="button" onclick="window.revertCompletedMark('${mark.id}', this)" style="margin-top: 10px; width: 100%; padding: 8px 10px; border-radius: 10px; border: 1.5px solid #FDBA74; background: #FFF7ED; color: #C2410C; font-size: 12px; font-weight: 900; cursor: pointer;">↩ Voltar baixa</button>
            ` : ''}
          </div>
        `;

        const marker = L.marker([mark.coordinates.lat, mark.coordinates.lng], {
          icon: completedIcon,
          zIndexOffset: 60,
          opacity: 0.55
        }).addTo(mapInstance);

        marker.on('mouseover', () => marker.setOpacity(1));
        marker.on('mouseout', () => marker.setOpacity(0.55));
        marker.on('popupopen', () => marker.setOpacity(1));
        marker.on('popupclose', () => marker.setOpacity(0.55));

        marker.bindPopup(popupContent, {
          className: 'completed-coleta-popup',
          maxWidth: 310,
          minWidth: 260,
          autoPan: true,
          closeButton: true
        });

        marker.on('click', () => {
          marker.openPopup();
        });

        completedMarkersRef.current.set(mark.id, marker);
      }
    });
  }, [mapInstance, completedWaypointMarks, dateRangeFilter, user?.id, user?.name, currentRole, isMonitorMode]);

  // Marcadores fixos de galpão para todas as Centrais de Coletas (uma só por local, mesmo se várias cidades usarem a mesma)
  useEffect(() => {
    if (!mapInstance || isMonitorMode) return;
    const layer = L.layerGroup().addTo(mapInstance);
    let cancelled = false;

    const loadCentrals = async () => {
      try {
        const res = await placeService.getLocaisCentrais();
        if (cancelled || !res.success || !Array.isArray(res.data)) return;
        layer.clearLayers();
        const seen = new Set<string>();
        res.data.forEach((local: any) => {
          const lat = Number(local.lat);
          const lng = Number(local.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
          const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
          if (seen.has(key)) return;
          seen.add(key);
          const name = String(local.name || 'Central de Coletas').replace(/[<>&"]/g, '');
          // Mesmo formato dos demais pins: a pontinha (X) fica exatamente na coordenada (âncora 19,43)
          const icon = L.divIcon({
            className: 'collection-hub-marker',
            iconSize: [160, 80],
            iconAnchor: [80, 75],
            html: `
              <div style="position:relative;width:160px;height:80px;cursor:pointer;pointer-events:auto;">
                <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);max-width:156px;background:#0F766E;color:#FFFFFF;padding:2px 7px;border-radius:6px;border:1px solid #99F6E4;box-shadow:0 1px 3px rgba(0,0,0,0.3);line-height:1.15;text-align:center;">
                  <div style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.03em;white-space:nowrap;opacity:0.9;">Central de Coletas</div>
                  <div style="font-size:10px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                </div>
                <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:61px;top:32px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
                  <ellipse cx="19" cy="43" rx="7.5" ry="2.2" fill="rgba(0,0,0,0.28)" />
                  <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="#FFFFFF" stroke-width="3.8" stroke-linecap="round" />
                  <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="#0F766E" stroke-width="2.2" stroke-linecap="round" />
                  <line x1="19" y1="26" x2="19" y2="43" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" />
                  <line x1="19" y1="26" x2="19" y2="43" stroke="#0F766E" stroke-width="1.8" stroke-linecap="round" />
                  <circle cx="19" cy="43" r="1.4" fill="#FFFFFF" />
                  <rect x="5" y="3" width="28" height="23" rx="6" fill="#0F766E" stroke="#FFFFFF" stroke-width="2.4" />
                  <g transform="translate(9 5.5) scale(0.83)" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8"/><path d="M7 16h10"/></g>
                </svg>
              </div>
            `
          });
          L.marker([lat, lng], { icon, zIndexOffset: 40 })
            .on('click', () => {
              setShowHubNavChooser(false);
              setHubToNavigate({ name, address: String(local.endereco || ''), lat, lng });
            })
            .addTo(layer);
        });
      } catch (err) {
        console.warn('Erro ao carregar centrais de coleta:', err);
      }
    };

    loadCentrals();
    const interval = window.setInterval(loadCentrals, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      mapInstance.removeLayer(layer);
    };
  }, [mapInstance, isMonitorMode]);

  // Sincroniza Marcadores dos Motoristas (com mascotes em moto e carro, cores exclusivas e tag com nome)
  useEffect(() => {
    if (!mapInstance) return;

    // Regra para motorista: Ele NÃO PODE ver os outros motoristas no mapa!
    // Ele só vê a si próprio através do beacon/localização GPS dele.
    if (currentRole === 'motorista' || isMonitorMode) {
      driverMarkersRef.current.forEach((marker) => {
        mapInstance.removeLayer(marker);
      });
      driverMarkersRef.current.clear();
      return;
    }

    const currentDriverIds = new Set(drivers.map(d => d.id));

    // Remove marcadores de motoristas excluídos
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentDriverIds.has(id)) {
        mapInstance.removeLayer(marker);
        driverMarkersRef.current.delete(id);
      }
    });

    // Se o filtro for 'nenhum', remove todos os motoristas para manter o mapa focado apenas em coletas e entregas
    if (vehicleFilter === 'nenhum') {
      driverMarkersRef.current.forEach((marker) => {
        mapInstance.removeLayer(marker);
      });
      driverMarkersRef.current.clear();
      return;
    }

    // Cria ou atualiza marcador para cada motorista
    drivers.forEach((driver) => {
      // Regra estrita: motoristas inativos/offline há mais de 30 minutos somem do mapa
      if (isDriverStale(driver)) {
        if (driverMarkersRef.current.has(driver.id)) {
          mapInstance.removeLayer(driverMarkersRef.current.get(driver.id)!);
          driverMarkersRef.current.delete(driver.id);
        }
        return;
      }

      // Filtra por tipo de veículo (Todos os veículos, Moto, Carro, Utilitário)
      if (vehicleFilter !== 'todos' && driver.vehicleType !== vehicleFilter) {
        if (driverMarkersRef.current.has(driver.id)) {
          mapInstance.removeLayer(driverMarkersRef.current.get(driver.id)!);
          driverMarkersRef.current.delete(driver.id);
        }
        return;
      }

      const isSelected = selectedDriver?.id === driver.id;
      const icon = createDriverMarkerIcon(driver, isSelected);

      if (driverMarkersRef.current.has(driver.id)) {
        const marker = driverMarkersRef.current.get(driver.id)!;
        marker.setIcon(icon);
        marker.setLatLng([driver.coordinates.lat, driver.coordinates.lng]);
        marker.setZIndexOffset(isSelected ? 900 : 350);
      } else {
        const marker = L.marker([driver.coordinates.lat, driver.coordinates.lng], {
          icon,
          zIndexOffset: isSelected ? 900 : 350
        }).addTo(mapInstance);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          setSelectedDriver(driver);
          flyToLocation(driver.coordinates, 16);
        });

        marker.on('dblclick', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
        });

        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [mapInstance, drivers, selectedDriver, vehicleFilter, flyToLocation, setSelectedDriver, currentRole, isMonitorMode]);

  // Selo "Aceito por" nas makers para admin/atendente/terminal; com "Indo" + distância quando o motorista clicou no GPS
  const claimBadgeLayerRef = useRef<L.LayerGroup | null>(null);
  const enRouteLinesRef = useRef<Map<string, { line: L.Polyline; lat: number; lng: number; at: number }>>(new Map());

  useEffect(() => {
    if (!mapInstance) return;
    const layer = L.layerGroup().addTo(mapInstance);
    claimBadgeLayerRef.current = layer;
    const lines = enRouteLinesRef.current;
    return () => {
      mapInstance.removeLayer(layer);
      lines.forEach(entry => mapInstance.removeLayer(entry.line));
      lines.clear();
      claimBadgeLayerRef.current = null;
    };
  }, [mapInstance]);

  // Anéis laranjas nos marcadores selecionados no modo "Passar rota"
  useEffect(() => {
    if (!mapInstance) return;
    if (!routeRingLayerRef.current) routeRingLayerRef.current = L.layerGroup().addTo(mapInstance);
    const layer = routeRingLayerRef.current;
    layer.clearLayers();
    if (!routeSelectMode) return;
    const byId = new Map<string, Place>();
    (savedPlaces || []).filter(p => !p.id.startsWith('pedido-')).forEach(p => byId.set(p.id, p));
    (allPlaces || []).forEach(p => byId.set(p.id, p));
    const seen = new Set<string>();
    routeSelectedIds.forEach(id => {
      const p = byId.get(id);
      if (!p?.coordinates) return;
      const key = `${p.coordinates.lat.toFixed(5)},${p.coordinates.lng.toFixed(5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      L.circleMarker([p.coordinates.lat, p.coordinates.lng], {
        radius: 30,
        color: '#FF5E00',
        weight: 4,
        fillColor: '#FF5E00',
        fillOpacity: 0.18,
        interactive: false
      }).addTo(layer);
    });
  }, [mapInstance, routeSelectMode, routeSelectedIds, allPlaces, savedPlaces]);

  useEffect(() => {
    const layer = claimBadgeLayerRef.current;
    if (!mapInstance || !layer) return;
    layer.clearLayers();

    const lines = enRouteLinesRef.current;
    if (currentRole === 'motorista' || isMonitorMode) {
      lines.forEach(entry => mapInstance.removeLayer(entry.line));
      lines.clear();
      return;
    }

    const digits = (v?: string) => String(v || '').replace(/\D/g, '');
    const activeLineIds = new Set<string>();

    allPlaces.forEach((place) => {
      if (!place.assignedDriverId && !place.assignedDriverName) return;
      if (place.orderStage === 'concluido' || isCollectionCenterPlace(place)) return;

      const live = drivers.find(d => {
        const a = digits(place.assignedDriverId);
        return (a && digits(d.id) === a) || (place.assignedDriverName && d.name === place.assignedDriverName);
      });
      const enRoute = Boolean(place.driverEnRoute);

      // Rota do motorista até o local: só depois que ele clicou no GPS
      if (enRoute && live) {
        activeLineIds.add(place.id);
        const cached = lines.get(place.id);
        const moved = cached ? calculateDistanceMeters({ lat: cached.lat, lng: cached.lng }, live.coordinates) : Infinity;
        if (!cached || (moved > 120 && Date.now() - cached.at > 15000)) {
          const from = { lat: live.coordinates.lat, lng: live.coordinates.lng };
          const apply = (coords: Array<{ lat: number; lng: number }>) => {
            const latlngs = coords.map(c => [c.lat, c.lng] as [number, number]);
            const existing = enRouteLinesRef.current.get(place.id);
            if (existing) existing.line.setLatLngs(latlngs);
            else {
              const line = L.polyline(latlngs, { color: '#2563EB', weight: 5, opacity: 0.85, dashArray: '1 9', lineCap: 'round' }).addTo(mapInstance);
              enRouteLinesRef.current.set(place.id, { line, lat: from.lat, lng: from.lng, at: Date.now() });
            }
            const entry = enRouteLinesRef.current.get(place.id);
            if (entry) { entry.lat = from.lat; entry.lng = from.lng; entry.at = Date.now(); }
          };
          apply([from, place.coordinates]);
          fetchMultiStopRoute([from, place.coordinates]).then(res => {
            if (res && res.coordinates.length > 1 && enRouteLinesRef.current.has(place.id)) apply(res.coordinates);
          }).catch(() => {});
        }
      }
    });

    lines.forEach((entry, id) => {
      if (!activeLineIds.has(id)) {
        mapInstance.removeLayer(entry.line);
        lines.delete(id);
      }
    });
  }, [mapInstance, allPlaces, drivers, currentRole, isMonitorMode]);

  // Sync selectedPlace marker position (for arbitrary clicks on map)
  useEffect(() => {
    if (!mapInstance) return;

    if (!selectedPlace) {
      if (markerRef.current) {
        mapInstance.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    // If it's already represented in placeMarkersRef, avoid duplicating
    if (placeMarkersRef.current.has(selectedPlace.id)) {
      if (markerRef.current) {
        mapInstance.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const { lat, lng } = selectedPlace.coordinates;
    const markerIcon = createPlaceMarkerIcon(selectedPlace, true, [selectedPlace], false, '', null);

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(markerIcon);
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: markerIcon,
        zIndexOffset: 600
      }).addTo(mapInstance);

      markerRef.current.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }

        const currentPlace: Place = (markerRef.current as L.Marker & { _customPlaceData: Place })._customPlaceData;
        if ((e.originalEvent?.target as HTMLElement)?.closest('.place-marker-photo-trigger')) {
          const photo = getPlacePhoto(currentPlace);
          if (photo) openPhotoViewer(formatPhotoUrl(photo, 'lg') || photo, currentPlace);
          return;
        }

        setSelectedPlace(currentPlace);
      });

      markerRef.current.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
      });
    }
    (markerRef.current as L.Marker & { _customPlaceData: Place })._customPlaceData = selectedPlace;
  }, [selectedPlace, mapInstance, openPhotoViewer, currentRole]);

  // Sync Street Route Highlighting (Vivid Royal & Navy Blue Street Polyline with Uber-style Animated Flow)
  useEffect(() => {
    if (!mapInstance) return;

    // Clean existing route layers
    if (routeLayersRef.current) {
      mapInstance.removeLayer(routeLayersRef.current.outer);
      mapInstance.removeLayer(routeLayersRef.current.inner);
      if (routeLayersRef.current.flow) {
        mapInstance.removeLayer(routeLayersRef.current.flow);
      }
      routeLayersRef.current = null;
    }

    if (!activeRoute || activeRoute.coordinates.length < 2) return;

    const latLngs: [number, number][] = activeRoute.coordinates.map(c => [c.lat, c.lng]);

    // 1. Contorno escuro para alto contraste na rua
    const outer = L.polyline(latLngs, {
      color: '#002B49',
      weight: 9,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(mapInstance);

    // 2. Linha base azul viva e brilhante
    const inner = L.polyline(latLngs, {
      color: '#0066FF',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(mapInstance);

    // 3. Linha animada estilo Uber com traços em movimento contínuo mostrando a direção
    const flow = L.polyline(latLngs, {
      color: '#FFFFFF',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '10, 16',
      className: 'uber-route-flow-line',
      interactive: false
    }).addTo(mapInstance);

    routeLayersRef.current = { outer, inner, flow };
  }, [activeRoute, mapInstance]);

  // Sync live user location marker with ultra-smooth 60fps linear walking motion and camera tracking
  useEffect(() => {
    if (!mapInstance || !userLocation) return;

    const isMotoristaOnline = currentRole === 'motorista' && isDriverOnline;
    const userVehicleType = getUserVehicleType(user);
    const isTracking = isTrackingUser || isMotoristaOnline;
    const driverColor = getDriverPermanentColor(user.id || user.phone || user.name);
    const driverName = user.name || 'Você';
    const targetLat = userLocation.lat;
    const targetLng = userLocation.lng;
    const now = performance.now();

    // Initial marker creation on map
    if (!userMarkerRef.current || !markerCurrentPosRef.current) {
      markerCurrentPosRef.current = { lat: targetLat, lng: targetLng };
      lastFixTimeRef.current = now;
      if (userLocation.heading != null && !isNaN(userLocation.heading)) {
        lastHeadingRef.current = userLocation.heading;
      }
      const initialIcon = createUserLocationIcon(currentRole, userVehicleType, lastHeadingRef.current, isTracking, driverColor, driverName);

      userMarkerRef.current = L.marker([targetLat, targetLng], {
        icon: initialIcon,
        zIndexOffset: 1000
      }).addTo(mapInstance);

      // Ao receber a localização do GPS do navegador pela primeira vez, centraliza o mapa no usuário
      mapInstance.setView([targetLat, targetLng], 16, { animate: true });
      return;
    }

    // Distance calculation in meters
    const currentLat = markerCurrentPosRef.current.lat;
    const currentLng = markerCurrentPosRef.current.lng;
    const dLat = (targetLat - currentLat) * 111320;
    const dLng = (targetLng - currentLng) * 111320 * Math.cos((targetLat * Math.PI) / 180);
    const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);

    // Filtro anti-ruído de GPS estacionário:
    // Se o motorista estiver parado ou com oscilação natural de satélite (< 1.5m),
    // ele fica 100% parado e firme no lugar ("quietinho"), sem girar a seta que nem doido
    if (distMeters < 1.5) {
      // Se tiver heading nativo do sensor do celular com velocidade mínima real, atualiza direção suavemente
      if (userLocation.speed && userLocation.speed > 0.8 && userLocation.heading != null && !isNaN(userLocation.heading)) {
        lastHeadingRef.current = userLocation.heading;
      }
      const updatedIcon = createUserLocationIcon(currentRole, userVehicleType, lastHeadingRef.current, isTracking, driverColor, driverName);
      userMarkerRef.current.setIcon(updatedIcon);
      return;
    }

    // Se houver deslocamento real (>= 1.5m), calcula o rumo em direção ao deslocamento
    const calculatedHeading = computeBearing(currentLat, currentLng, targetLat, targetLng);
    lastHeadingRef.current = calculatedHeading;

    const updatedIcon = createUserLocationIcon(currentRole, userVehicleType, lastHeadingRef.current, isTracking, driverColor, driverName);
    userMarkerRef.current.setIcon(updatedIcon);

    // If teleport/large jump (> 3km), snap immediately without playing long animation
    if (distMeters > 3000) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      markerCurrentPosRef.current = { lat: targetLat, lng: targetLng };
      userMarkerRef.current.setLatLng([targetLat, targetLng]);
      if (isTrackingUser) {
        mapInstance.flyTo([targetLat, targetLng], 18, { duration: 1.0 });
      }
      lastFixTimeRef.current = now;
      return;
    }

    // Calculate dynamic time delta to adapt animation duration to incoming GPS frequency
    const timeDelta = lastFixTimeRef.current > 0 ? (now - lastFixTimeRef.current) : 1200;
    lastFixTimeRef.current = now;

    // Smooth walking duration: matches update frequency with a tiny 10% buffer so it glides continuously
    const animDuration = Math.max(1000, Math.min(3000, timeDelta * 1.08));

    // Cancel running animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startLat = currentLat;
    const startLng = currentLng;
    animationStartPosRef.current = { lat: startLat, lng: startLng };
    animationTargetPosRef.current = { lat: targetLat, lng: targetLng };
    animationStartTimeRef.current = performance.now();

    // Constant-velocity linear interpolation ("andando de verdade, estilo Google Maps")
    const step = (currentTime: number) => {
      const elapsed = currentTime - animationStartTimeRef.current;
      const progress = Math.min(1.0, elapsed / animDuration);

      // Linear progression creates continuous, constant-speed walking without abrupt stop/starts
      const interpLat = startLat + (targetLat - startLat) * progress;
      const interpLng = startLng + (targetLng - startLng) * progress;

      markerCurrentPosRef.current = { lat: interpLat, lng: interpLng };

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([interpLat, interpLng]);
      }

      // Mantém a câmera acompanhando o GPS apenas até o motorista mover o mapa manualmente.
      const isDriverTracking = isTrackingUser || isMotoristaOnline;
      if (isDriverTracking && mapInstance && !isUserManuallyPanningRef.current) {
        mapInstance.panTo([interpLat, interpLng], { animate: false });
      }

      if (progress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [userLocation, isTrackingUser, isDriverOnline, currentRole, user, mapInstance]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    if (!marker || currentRole !== 'motorista') return;
    const openOwnDriver = (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event);
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      const position = marker.getLatLng();
      setSelectedDriver({
        id: String(user.id || ''),
        name: user.name || 'Motorista',
        phone: user.phone || '',
        vehicleType: getUserVehicleType(user),
        vehicleModel: user.vehicle || '',
        vehiclePlate: '',
        color: getDriverPermanentColor(user.id || user.phone || user.name),
        coordinates: { lat: position.lat, lng: position.lng },
        status: isDriverOnline ? 'em_rota' : 'offline',
        avatarUrl: user.avatarUrl,
        lastSeenTimestamp: userLocation?.timestamp
      });
    };
    marker.on('click', openOwnDriver);
    return () => { marker.off('click', openOwnDriver); };
  }, [mapInstance, userLocation, currentRole, user, isDriverOnline, setSelectedDriver]);

  // Atualização reativa imediata do marcador quando o usuário altera de papel (Admin/Motorista) ou tipo de veículo
  useEffect(() => {
    if (!userMarkerRef.current) return;
    const isMotoristaOnline = currentRole === 'motorista' && isDriverOnline;
    const userVehicleType = getUserVehicleType(user);
    const isTracking = isTrackingUser || isMotoristaOnline;
    const driverColor = getDriverPermanentColor(user.id || user.phone || user.name);
    const driverName = user.name || 'Você';
    const updatedIcon = createUserLocationIcon(currentRole, userVehicleType, lastHeadingRef.current, isTracking, driverColor, driverName);
    userMarkerRef.current.setIcon(updatedIcon);
  }, [currentRole, user, isDriverOnline, isTrackingUser]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 bg-[#EBF2F7]"
        style={{ cursor: 'grab' }}
      />

      {/* JANELINHA / DIÁLOGO DE SELEÇÃO DE ENCOMENDA NO LOCAL (ONMAKER) */}
      {markerSelectionModal && (
        <div 
          onClick={() => setMarkerSelectionModal(null)}
          className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Cabeçalho da Janelinha */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-[#0B5187] text-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1 text-sky-300 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{markerSelectionModal.placeName}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                    {markerSelectionModal.driverClaimMode ? 'Escolha o pedido para aceitar' : 'Qual encomenda você deseja acessar?'}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    {markerSelectionModal.driverClaimMode
                      ? 'Há mais de um pedido neste ponto. Confira o cliente e a operação antes de aceitar.'
                      : 'Encomendas registradas neste mesmo local. Toque para abrir:'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMarkerSelectionModal(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Fechar janelinha"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Lista das Encomendas no Local */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50">
              {markerSelectionModal.places.map((p, idx) => {
                const pVeh = getVehicleInfo(p.vehicleType);
                const op = p.operationType || 'entrega';
                const isCollectionCenter = isCollectionCenterPlace(p);
                const isPublicForDriver = Boolean(markerSelectionModal.driverClaimMode && !isCollectionCenter && realtimeAssignmentService.isPublicOrder(p));
                const isColeta = op === 'coleta';
                const isTroca = op === 'troca';
                const isRetorno = p.orderStage === 'retorno';

                const opConfig = isColeta
                  ? { label: 'Coleta', badgeBg: 'bg-blue-100 text-[#0B5187] border-blue-300' }
                  : isTroca
                  ? { label: 'Troca', badgeBg: 'bg-purple-100 text-[#7C3AED] border-purple-300' }
                  : isRetorno
                  ? { label: 'Retorno', badgeBg: 'bg-amber-100 text-amber-900 border-amber-300' }
                  : { label: 'Entrega', badgeBg: 'bg-orange-100 text-[#FF5E00] border-orange-300' };

                const photo = getPlacePhoto(p);

                return (
                  <div
                    key={p.id || idx}
                    onClick={() => {
                      setMarkerSelectionModal(null);
                      if (isPublicForDriver) {
                        setPublicOrderToClaim(p);
                        return;
                      }
                      setSelectedPlace(p);
                    }}
                    className="p-3 sm:p-3.5 bg-white hover:bg-sky-50/50 rounded-2xl border-2 border-slate-200 hover:border-[#0B5187] shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] flex flex-col gap-2"
                  >
                    {/* Linha superior: Veículo, Operação e Código */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {/* Veículo na frente com fundo colorido para diferenciar */}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black inline-flex items-center gap-1 shadow-2xs border ${pVeh.badgeClass}`}>
                          <span>{pVeh.emoji}</span>
                          <span>{pVeh.label}</span>
                        </span>

                        {/* Operação */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border uppercase tracking-wide ${opConfig.badgeBg}`}>
                          {opConfig.label}
                        </span>
                      </div>

                      {p.orderCode && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.orderCode}
                        </span>
                      )}
                      {isPublicForDriver && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 ring-1 ring-amber-200">
                          <Zap className="h-3 w-3 fill-current" />
                          Público
                        </span>
                      )}
                    </div>

                    {/* Dados do Cliente e Foto */}
                    <div className="flex items-start gap-2.5">
                      {photo ? (
                        <img 
                          src={photo} 
                          alt="Foto" 
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100" 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 font-black text-sm">
                          #{idx + 1}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-[#0B5187] transition-colors">
                            {p.customerName || 'Cliente não informado'}
                          </h4>
                        </div>

                        {p.customerPhone && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{p.customerPhone}</span>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5" title={p.address}>
                          {p.address}
                        </p>
                      </div>
                    </div>

                    {/* Alerta: Cliente sem localização cadastrada */}
                    {!isPublicForDriver && isCustomerMissingLocation(p, customers) && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setMarkerSelectionModal(null);
                          openCustomerLocationModal({
                            place: p,
                            placeId: p.id,
                            customerName: p.customerName || 'Cliente',
                            customerPhone: p.customerPhone,
                            customerId: p.customerId
                          });
                        }}
                        className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100/90 border border-amber-300 text-amber-900 text-[10px] font-black flex items-center justify-between gap-1 shadow-2xs transition-all cursor-pointer"
                        title="Cliente sem localização cadastrada! Toque para definir local."
                      >
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Cliente Sem Localização</span>
                        </span>
                        <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wide">
                          Cadastrar
                        </span>
                      </div>
                    )}

                    {/* Barra de ação dentro do card */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isPublicForDriver ? 'Disponível para você' : isCollectionCenter ? 'Ponto de operação' : 'Toque para abrir detalhes'}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-black transition-transform group-hover:translate-x-0.5 ${isPublicForDriver ? 'text-emerald-700' : 'text-[#0B5187]'}`}>
                        <span>{isPublicForDriver ? 'Aceitar pedido' : 'Acessar'}</span>
                        {isPublicForDriver ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé da Janelinha */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMarkerSelectionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE NAVEGAÇÃO ATÉ A CENTRAL DE COLETAS */}
      {hubToNavigate && (
        <div
          className="fixed inset-0 z-[140] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200"
          onClick={() => { setHubToNavigate(null); setShowHubNavChooser(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-visible rounded-t-[28px] sm:rounded-[28px] bg-white shadow-2xl text-slate-900 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wide text-teal-700">Central de Coletas</p>
                <h3 className="text-base font-black leading-tight truncate">{hubToNavigate.name}</h3>
                {hubToNavigate.address && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{hubToNavigate.address}</p>}
              </div>
              <button
                type="button"
                onClick={() => { setHubToNavigate(null); setShowHubNavChooser(false); }}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mt-4">
              {showHubNavChooser && (
                <div className="absolute bottom-14 right-0 z-10 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 space-y-2 animate-in zoom-in-95 fade-in duration-150">
                  {(['google_maps', 'waze'] as const).map((app) => (
                    <button
                      key={app}
                      type="button"
                      onClick={() => {
                        setDefaultNavApp(app);
                        setShowHubNavChooser(false);
                        openExternalNavigation(app, hubToNavigate.lat, hubToNavigate.lng);
                        setHubToNavigate(null);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        defaultNavApp === app ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {app === 'google_maps' ? <GoogleMapsIcon className="w-7 h-7 shrink-0" /> : <WazeIcon className="w-7 h-7 shrink-0" />}
                      <span className="text-xs font-black flex-1">{app === 'google_maps' ? 'Google Maps' : 'Waze'}</span>
                      {defaultNavApp === app && (
                        <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md">Padrão</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center h-12 rounded-2xl bg-[#1A73E8] text-white shadow-md border border-blue-400/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    openExternalNavigation(defaultNavApp || 'google_maps', hubToNavigate.lat, hubToNavigate.lng);
                    setHubToNavigate(null);
                    setShowHubNavChooser(false);
                  }}
                  className="flex-1 h-full px-4 hover:bg-[#1557b0] font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {defaultNavApp === 'waze' ? <WazeIcon className="w-5 h-5" /> : <GoogleMapsIcon className="w-5 h-5" />}
                  <span>Navegar</span>
                </button>
                <div className="w-[1px] h-6 bg-white/30" />
                <button
                  type="button"
                  onClick={() => setShowHubNavChooser(prev => !prev)}
                  className="h-full px-3 hover:bg-[#1557b0] flex items-center justify-center cursor-pointer"
                  title="Mudar aplicativo de navegação GPS (Google Maps / Waze)"
                  aria-label="Escolher aplicativo de GPS"
                >
                  <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE SUCESSO AO ASSUMIR PEDIDO PÚBLICO */}
      {claimToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 bg-slate-900/95 text-white text-xs font-black rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-500/50 backdrop-blur-md animate-in slide-in-from-top-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span>{claimToast}</span>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA MOTORISTA ASSUMIR PEDIDO PÚBLICO */}
      {publicOrderToClaim && (
        <div 
          className="fixed inset-0 z-[140] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-200"
          onClick={() => !isClaiming && setPublicOrderToClaim(null)}
        >
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-order-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 text-slate-900"
          >
            <div className="h-1.5 bg-gradient-to-r from-[#FFB01F] via-[#FF7A1A] to-[#FF5E00]" />

            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                    {publicOrderToClaim.operationType === 'coleta' ? (
                      <Package className="h-7 w-7 stroke-[2.2]" />
                    ) : publicOrderToClaim.operationType === 'troca' ? (
                      <RefreshCw className="h-7 w-7 stroke-[2.2]" />
                    ) : (
                      <Navigation className="h-7 w-7 stroke-[2.2]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                      <Zap className="h-3 w-3 fill-current" />
                      Disponível para aceitar
                    </span>
                    <h2 id="public-order-title" className="mt-1.5 text-lg font-black leading-tight text-slate-950 sm:text-xl">
                      Novo pedido
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={() => setPublicOrderToClaim(null)}
                  aria-label="Fechar pedido"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 border-y border-slate-200 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                    publicOrderToClaim.operationType === 'coleta'
                      ? 'bg-blue-100 text-blue-800'
                      : publicOrderToClaim.operationType === 'troca'
                      ? 'bg-violet-100 text-violet-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {publicOrderToClaim.operationType === 'coleta'
                      ? 'Coleta'
                      : publicOrderToClaim.operationType === 'troca'
                      ? 'Troca'
                      : 'Entrega'}
                  </span>
                  {publicOrderToClaim.orderCode && (
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {publicOrderToClaim.orderCode}
                    </span>
                  )}
                  {formatClaimDistance(userLocation, publicOrderToClaim.coordinates) && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">
                      <MapPin className="h-3 w-3" />
                      {formatClaimDistance(userLocation, publicOrderToClaim.coordinates)} de você
                    </span>
                  )}
                </div>

                <h3 className="mt-3 break-words text-xl font-black leading-snug text-slate-950 sm:text-2xl">
                  {publicOrderToClaim.name || 'Local do pedido'}
                </h3>
                {publicOrderToClaim.address && (
                  <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-600">
                    {publicOrderToClaim.address}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
                  <User className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cliente</p>
                    <p className="break-words text-sm font-bold text-slate-900">
                      {publicOrderToClaim.customerName || 'Não informado'}
                    </p>
                  </div>
                  {publicOrderToClaim.customerPhone && (
                    <a
                      href={`tel:${publicOrderToClaim.customerPhone.replace(/[^\d+]/g, '')}`}
                      onClick={(event) => event.stopPropagation()}
                      className="ml-auto flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-[#0B5187] ring-1 ring-slate-200 hover:bg-blue-50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Ligar
                    </a>
                  )}
                </div>

                {(() => {
                  const o = publicOrderToClaim;
                  const details = [
                    o.scheduledTime ? { k: 'Horário', v: `${o.scheduledTimeMode === 'partir' ? 'a partir das' : 'até'} ${o.scheduledTime}` } : null,
                    o.packageSize ? { k: 'Tamanho', v: o.packageSize } : null,
                    o.volumesCount ? { k: 'Volumes', v: String(o.volumesCount) } : null,
                    o.weightKg ? { k: 'Peso', v: `${o.weightKg} kg` } : null,
                    o.vehicleType ? { k: 'Veículo', v: String(o.vehicleType) } : null,
                    o.originCity || o.destinationCity ? { k: 'Cidades', v: [o.originCity, o.destinationCity].filter(Boolean).join(' → ') } : null
                  ].filter(Boolean) as Array<{ k: string; v: string }>;
                  const notes = o.observations || o.driverNotes || o.pickupNotes || o.deliveryNotes;
                  return (
                    <>
                      <ClaimRouteMap order={o} driverLocation={userLocation} />

                      {details.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {details.map(d => (
                            <div key={d.k} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{d.k}</p>
                              <p className="break-words text-sm font-bold text-slate-900">{d.v}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {o.isFragile && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Frágil: manuseie com cuidado
                        </div>
                      )}

                      {notes && (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Observações</p>
                          <p className="mt-0.5 break-words text-sm text-amber-900">{notes}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Ao aceitar, o pedido ficará vinculado a você e deixará de aparecer para os outros motoristas.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-[0.8fr_1.2fr]">
                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={() => setPublicOrderToClaim(null)}
                  className="order-2 min-h-12 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 sm:order-1"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={handleConfirmClaimPublicOrder}
                  className="order-1 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#0B7A58] px-4 text-base font-black text-white shadow-lg shadow-emerald-900/15 transition-colors hover:bg-[#096548] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:order-2"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Reservando pedido...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5 stroke-[3]" />
                      Aceitar pedido
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
