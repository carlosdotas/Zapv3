import L from 'leaflet';
import { X, Zap, Package } from 'lucide-react';
import { Place, OperationType, Driver, CompletedWaypointMark } from '../../types/map';
import { renderMarkerNote } from '../../utils/markerNotes';
import { calculateDistanceMeters } from '../../utils/placeUtils';
import { formatPhotoUrl } from '../../services/apiAdapters';
import { UserRole } from '../../types/auth';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { getDriverPermanentColor } from '../../utils/driverColorUtils';
import { hexToRgba, get3DVehicleSvg, get3DGmapsArrowSvg } from './vehicleIcons';

// Brand Package Box Pin Marker (Caixinha de entrega amarelo-alaranjada com haste e xizinho na ponta)
export const createBrandPinIcon = (isSelected: boolean = false) => {
  const pinColor = isSelected ? '#007AFF' : '#0B5187';
  const mainColor = isSelected ? '#FFB834' : '#FFA826'; // Amarelo alaranjado padrão
  const topLightColor = isSelected ? '#FFE8A0' : '#FFDB78'; // Tampa superior mais clarinha
  const darkColor = isSelected ? '#F58216' : '#E67E22'; // Face lateral sombreada

  const pinSvg = `
    <div style="width: 38px; height: 48px; position: relative; pointer-events: none;">
      <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; overflow: visible; filter: drop-shadow(0 3px 8px rgba(245, 158, 11, 0.45));">
        <!-- Sombra no solo -->
        <ellipse cx="19" cy="43" rx="7.5" ry="2.2" fill="rgba(0, 0, 0, 0.28)" />

        <!-- Xzinho na ponta do alfinete marcando o ponto exato no mapa -->
        <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="#FFFFFF" stroke-width="3.8" stroke-linecap="round" />
        <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="${pinColor}" stroke-width="2.2" stroke-linecap="round" />

        <!-- Risquinho fininho do alfinete -->
        <line x1="19" y1="26" x2="19" y2="43" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" />
        <line x1="19" y1="26" x2="19" y2="43" stroke="${pinColor}" stroke-width="1.8" stroke-linecap="round" />

        <!-- Ponto central no cruzamento do X -->
        <circle cx="19" cy="43" r="1.4" fill="#FFFFFF" />

        <!-- Caixinha de entrega ou encomenda 3D Amarelo-Alaranjada -->
        <!-- Contorno externo da caixa -->
        <path d="M 19 2 L 32 8.5 L 32 20.5 L 19 27 L 6 20.5 L 6 8.5 Z" fill="${darkColor}" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round" />

        <!-- Face Superior da Caixa (tampa - mais clarinha) -->
        <path d="M 19 2.5 L 31.5 8.5 L 19 14.5 L 6.5 8.5 Z" fill="${topLightColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

        <!-- Face Esquerda da Caixa (amarelo alaranjado padrão) -->
        <path d="M 6.5 8.5 L 19 14.5 L 19 26.5 L 6.5 20.5 Z" fill="${mainColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

        <!-- Face Direita da Caixa (tom alaranjado de sombra) -->
        <path d="M 19 14.5 L 31.5 8.5 L 31.5 20.5 L 19 26.5 Z" fill="${darkColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

        <!-- Fitas de encomenda brancas na caixa -->
        <path d="M 12.8 5.5 L 25.2 11.5" stroke="rgba(255, 255, 255, 0.92)" stroke-width="2" stroke-linecap="round" />
        <path d="M 19 14.5 L 19 26.5" stroke="rgba(255, 255, 255, 0.92)" stroke-width="2" stroke-linecap="round" />

        <!-- Mini etiqueta de remessa -->
        <polygon points="8,12 13.5,14.5 13.5,18.5 8,16" fill="#FFFFFF" opacity="0.95" />
        <line x1="9.5" y1="14.2" x2="12" y2="15.4" stroke="#D97706" stroke-width="1" stroke-linecap="round" />
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'custom-brand-pin',
    html: pinSvg,
    iconSize: [38, 48],
    iconAnchor: [19, 43],
    popupAnchor: [0, -43]
  });
};

// Helper para gerar o badge da data da encomenda (Hoje, Ontem, 2 dias atrás, 3 dias atrás ou data agendada)
export const getPlaceDateBadgeInfo = (place: Place): { label: string; type: 'hoje' | 'amanha' | 'ontem' | '2_dias_atras' | '3_dias_atras' | 'custom' | string; iconSvg: string } => {
  let badgeType = place.orderDateBadge;

  // Resolve a data da encomenda (scheduledDate ou data ou orderDate) no fuso de SP
  const targetDateStr = place.scheduledDate || (place as any).data || (place as any).orderDate;
  if (targetDateStr) {
    const cleanDate = targetDateStr.slice(0, 10);
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const twoDaysAgoStr = twoDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      const threeDaysAgoStr = threeDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

      if (cleanDate === todayStr) {
        return {
          label: 'Hoje',
          type: 'hoje',
          iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
        };
      }
      if (cleanDate === yesterdayStr) {
        return {
          label: 'Ontem',
          type: 'ontem',
          iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
        };
      }
      if (cleanDate === twoDaysAgoStr) {
        return {
          label: '2 dias atrás',
          type: '2_dias_atras',
          iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
        };
      }
      if (cleanDate === threeDaysAgoStr) {
        return {
          label: '3 dias atrás',
          type: '3_dias_atras',
          iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
        };
      }
      if (cleanDate === tomorrowStr) {
        return {
          label: 'Amanhã',
          type: 'amanha',
          iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
        };
      }
      return {
        label: `${day}/${month}`,
        type: 'custom',
        iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
      };
    }
  }

  // Se não estiver especificado, encomendas ativas padrão são de 'hoje'
  if (!badgeType) {
    if (place.id.startsWith('pedido-') || place.orderCode) {
      badgeType = 'hoje';
    } else {
      const idSum = place.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      badgeType = (idSum % 2 === 0) ? 'hoje' : 'ontem';
    }
  }

  let label = 'Hoje';
  if (badgeType === 'hoje') label = 'Hoje';
  else if (badgeType === 'amanha') label = 'Amanhã';
  else if (badgeType === 'ontem') label = 'Ontem';
  else if (badgeType === '2_dias_atras') label = '2 dias atrás';
  else if (badgeType === '3_dias_atras') label = '3 dias atrás';
  else label = badgeType;

  return {
    label,
    type: badgeType,
    iconSvg: `<span style="display:inline-block; width:5.5px; height:5.5px; border-radius:50%; background:#ffffff; opacity:0.95; flex-shrink:0;"></span>`
  };
};

export const getPlacePhoto = (place: Place): string | null => {
  if (!place) return null;
  let raw: string | null = place.photos?.[0] || place.imageUrl || place.pickupPhotos?.[0] || null;
  try {
    const saved = !raw && localStorage.getItem(`encomendaszap_photos_${place.id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
        if (!String(parsed[0]).includes('images.unsplash.com')) {
          raw = parsed[0];
        }
      }
    }
  } catch (err) {
    console.warn('[Fotos] Não foi possível ler fotos locais:', err);
  }
  return raw ? (formatPhotoUrl(raw, 'thumb') || raw) : null;
};

// Helper para identificação clara de veículo (moto, carro, utilitário) com cores diferenciadas no fundo
export const getVehicleInfo = (vehicleType?: string) => {
  const v = (vehicleType || 'moto').toLowerCase().trim();
  if (v === 'carro' || v === 'automovel' || v === 'automóvel') {
    return { 
      emoji: '🚗', 
      label: 'Carro', 
      type: 'carro',
      bg: '#0284C7', // Azul Celeste vibrante
      border: '#7DD3FC',
      color: '#FFFFFF',
      badgeClass: 'bg-sky-600 text-white border-sky-400'
    };
  }
  if (v === 'utilitario' || v === 'utilitário' || v === 'caminhao' || v === 'caminhão' || v === 'van' || v === 'furgao' || v === 'furgão') {
    return { 
      emoji: '🚚', 
      label: 'Utilitário', 
      type: 'utilitario',
      bg: '#D97706', // Âmbar / Dourado intenso
      border: '#FDE68A',
      color: '#FFFFFF',
      badgeClass: 'bg-amber-600 text-white border-amber-300'
    };
  }
  return { 
    emoji: '🏍️', 
    label: 'Moto', 
    type: 'moto',
    bg: '#059669', // Verde Esmeralda intenso
    border: '#6EE7B7',
    color: '#FFFFFF',
    badgeClass: 'bg-emerald-600 text-white border-emerald-300'
  };
};

export const isCollectionCenterPlace = (place: Place): boolean =>
  /central\s+de\s+coletas?/i.test(place.category || '') || Boolean((place as any).central_coletas);

// Distância do motoboy até o local, em texto curto ("850 m" / "1,2 km")
export const formatClaimDistance = (
  from: { lat: number; lng: number } | null | undefined,
  to: { lat: number; lng: number } | null | undefined
): string => {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(to.lat)) return '';
  const meters = calculateDistanceMeters(from, to);
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

// Status do motorista no marcador: aceite, deslocamento ou direcionamento administrativo.
type DriverStatusInfo = { text: string; enRoute: boolean };
export const getDriverStatusInfo = (places: Place[], liveDrivers: Array<{ id: string; name?: string; coordinates: { lat: number; lng: number } }>): DriverStatusInfo | null => {
  const assigned = places.filter(p => (p.assignedDriverId || p.assignedDriverName) && p.orderStage !== 'concluido' && !isCollectionCenterPlace(p));
  if (assigned.length === 0) return null;
  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  if (assigned.length > 1) {
    const going = assigned.filter(p => p.driverEnRoute).length;
    const accepted = assigned.filter(p => p.acceptedByDriver).length;
    const directed = assigned.length - accepted;
    const states = [
      accepted ? `${accepted} aceitos` : '',
      directed ? `${directed} direcionados` : '',
      going ? `${going} indo` : ''
    ].filter(Boolean);
    return { text: states.join(' • '), enRoute: going > 0 };
  }
  const p = assigned[0];
  const digits = (v?: string) => String(v || '').replace(/\D/g, '');
  const live = liveDrivers.find(d => {
    const a = digits(p.assignedDriverId);
    return (a && digits(d.id) === a) || (p.assignedDriverName && d.name === p.assignedDriverName);
  });
  const name = escapeHtml(p.assignedDriverName || live?.name || 'Motorista');
  if (p.driverEnRoute) {
    const distance = live ? formatClaimDistance(live.coordinates, p.coordinates) : '';
    return { text: `${name} indo${distance ? ` • ${distance}` : ''}`, enRoute: true };
  }
  return {
    text: p.acceptedByDriver ? `Aceito por ${name}` : `Direcionado para ${name}`,
    enRoute: false
  };
};

// Place Marker com caixinha 3D ou Foto da Encomenda, risquinho fininho, xizinho na ponta e legenda translúcida
export const createPlaceMarkerIcon = (
  place: Place, 
  isSelected: boolean = false, 
  placesAtLocation: Place[] = [place],
  isPublicForDriver: boolean = false,
  distanceLabel: string = '',
  driverStatus: DriverStatusInfo | null = null
) => {
  const isMultiple = placesAtLocation.length > 1;
  const isCollectionCenter = placesAtLocation.some(isCollectionCenterPlace);
  const opType: OperationType = place.operationType || 'entrega';
  
  let pinColor = '#FF5E00';
  let mainColor = '#FF5E00';
  let topLightColor = '#FFDB78';
  let darkColor = '#EA580C';
  let symbolSvg = `
    <!-- Mini etiqueta de remessa de entrega -->
    <polygon points="8,12 13.5,14.5 13.5,18.5 8,16" fill="#FFFFFF" opacity="0.95" />
    <line x1="9.5" y1="14.2" x2="12" y2="15.4" stroke="#FF5E00" stroke-width="1" stroke-linecap="round" />
  `;
  let opEmoji = '📦';

  if (isPublicForDriver && !isCollectionCenter) {
    const label = isMultiple ? `${placesAtLocation.length} pedidos` : 'Aceitar';
    const publicPhoto = !isMultiple && realtimeAssignmentService.isPublicOrder(place) ? getPlacePhoto(place) : null;
    return L.divIcon({
      className: 'public-claim-marker',
      html: `
        <style>
          @keyframes claimArrowBounce { 0%,100% { transform: translateY(-4px); } 50% { transform: translateY(3px); } }
          @keyframes claimPulse { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.4); opacity: 0; } }
          @keyframes claimWiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
          @keyframes claimShadow { 0%,100% { transform: translateX(-50%) scale(0.7); opacity: .3; } 50% { transform: translateX(-50%) scale(1); opacity: .55; } }
        </style>
        <div style="position:relative;width:84px;height:92px;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="position:absolute;left:50%;bottom:-4px;width:28px;height:9px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,0.65) 0%,rgba(0,0,0,0.3) 55%,rgba(0,0,0,0) 100%);animation:claimShadow 0.9s ease-in-out infinite;pointer-events:none;"></div>
          <div style="min-width:64px;max-width:84px;padding:3px 8px 4px;border-radius:9px;background:#FFFFFF;border:2px solid #DC2626;box-shadow:0 2px 6px rgba(0,0,0,0.35);text-align:center;line-height:1;">
            <div style="font-size:9px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;color:#DC2626;white-space:nowrap;">${label}</div>
            <div style="margin-top:2px;font-size:12px;font-weight:900;color:#0F172A;white-space:nowrap;">${distanceLabel || '🛵'}</div>
          </div>
          ${publicPhoto ? `<div class="place-marker-photo-trigger" style="position:absolute;right:100%;top:0;width:38px;height:38px;border:2px solid white;border-radius:8px;overflow:hidden;"><img src="${publicPhoto}" alt="Foto da encomenda" style="width:100%;height:100%;object-fit:cover;" /></div>` : ''}
          <div style="position:absolute;left:100%;top:0;width:180px;text-align:left;">${placesAtLocation.filter(p => !isCollectionCenterPlace(p) && realtimeAssignmentService.isPublicOrder(p)).slice(0, 4).map(renderMarkerNote).join('')}</div>
          <div style="position:relative;width:46px;height:44px;margin-top:2px;animation:claimWiggle 2.4s ease-in-out infinite;">
            <div style="position:absolute;inset:3px;border-radius:10px;background:#EF4444;animation:claimPulse 1.8s ease-out infinite;"></div>
            <svg width="46" height="44" viewBox="0 0 64 62" style="position:absolute;inset:0;filter:drop-shadow(0 3px 4px rgba(127,29,29,0.55))${isSelected ? ' drop-shadow(0 0 4px rgba(254,202,202,0.95))' : ''};">
              <path d="M32 3 L59 16 V44 L32 58 L5 44 V16 Z" fill="#DC2626" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round" />
              <path d="M5 16 L32 29 L59 16" fill="#EF4444" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round" />
              <path d="M32 29 V58" stroke="#FFFFFF" stroke-width="2" />
              <path d="M18.5 9.5 L45.5 22.5" stroke="#FECACA" stroke-width="3.5" stroke-linecap="round" />
            </svg>
          </div>
          <svg width="20" height="15" viewBox="0 0 34 26" style="margin-top:1px;animation:claimArrowBounce 0.9s ease-in-out infinite;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.35));">
            <path d="M4 3 L17 22 L30 3" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4 3 L17 22 L30 3" fill="none" stroke="#DC2626" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      `,
      iconSize: [84, 92],
      iconAnchor: [42, 92],
      popupAnchor: [0, -92]
    });
  }
  if (isPublicForDriver) {
    // Pedido Público Aberto visto por Motorista: Cor Dourada/Âmbar Chamativa com Raio ⚡
    pinColor = isSelected ? '#F59E0B' : '#D97706';
    mainColor = isSelected ? '#FBBF24' : '#F59E0B';
    topLightColor = isSelected ? '#FEF3C7' : '#FDE68A';
    darkColor = isSelected ? '#D97706' : '#B45309';
    opEmoji = '⚡';
    symbolSvg = `
      <!-- Símbolo de Raio Dourado para Pedido Público Disponível -->
      <circle cx="25" cy="18" r="5" fill="#FFFFFF" stroke="#B45309" stroke-width="0.9" />
      <path d="M 25.5 14.5 L 23.2 18 L 25.5 18 L 24.5 21.5 L 27.2 17.5 L 25 17.5 Z" fill="#D97706" stroke="#92400E" stroke-width="0.6" stroke-linejoin="round" />
    `;
  } else if (isCollectionCenter) {
    pinColor = isSelected ? '#0F766E' : '#0D9488';
    mainColor = isSelected ? '#2DD4BF' : '#14B8A6';
    topLightColor = isSelected ? '#CCFBF1' : '#99F6E4';
    darkColor = isSelected ? '#0F766E' : '#115E59';
    opEmoji = '🏬';
    symbolSvg = `
      <circle cx="25" cy="18" r="5" fill="#FFFFFF" stroke="#115E59" stroke-width="0.9" />
      <path d="M21.5 18 L25 15.5 L28.5 18 V21 H21.5 Z" fill="#0F766E" stroke="#115E59" stroke-width="0.7" stroke-linejoin="round" />
      <path d="M23 19 H24.2 V21 H23 Z M25.8 19 H27 V20.2 H25.8 Z" fill="#FFFFFF" />
    `;
  } else if (isMultiple) {
    // Quando tiver mais de uma no lugar só: cor cinza, uma cor mais clara, cinza
    pinColor = isSelected ? '#64748B' : '#94A3B8';
    mainColor = isSelected ? '#94A3B8' : '#CBD5E1';
    topLightColor = isSelected ? '#E2E8F0' : '#F1F5F9';
    darkColor = isSelected ? '#475569' : '#64748B';
    opEmoji = '📦';
    symbolSvg = `
      <!-- Símbolo de Múltiplas Encomendas (Camadas em cinza claro) -->
      <circle cx="25" cy="18" r="4.5" fill="#FFFFFF" stroke="#64748B" stroke-width="0.8" />
      <path d="M 22.5 16.5 L 25 15.2 L 27.5 16.5 L 25 17.8 Z" fill="#94A3B8" />
      <path d="M 22.5 18 L 25 19.3 L 27.5 18" stroke="#64748B" stroke-width="0.8" stroke-linecap="round" />
      <path d="M 22.5 19.5 L 25 20.8 L 27.5 19.5" stroke="#64748B" stroke-width="0.8" stroke-linecap="round" />
    `;
  } else if (opType === 'coleta') {
    // 1. Coleta: Azul Marinho Oficial da Logo (#0B5187)
    pinColor = isSelected ? '#106CB2' : '#0B5187';
    mainColor = isSelected ? '#106CB2' : '#0B5187';
    topLightColor = isSelected ? '#60A5FA' : '#4F92C7';
    darkColor = isSelected ? '#0B5187' : '#002B49';
    opEmoji = '📥';
    symbolSvg = `
      <!-- Símbolo de Coleta (Seta para baixo dentro do badge circular) -->
      <circle cx="25" cy="18" r="4.5" fill="#FFFFFF" stroke="#002B49" stroke-width="0.8" />
      <path d="M 23.4 16.6 L 25 19.4 L 26.6 16.6 M 25 15.2 L 25 19.4" stroke="#0B5187" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    `;
  } else if (opType === 'troca') {
    // 3. Troca: Roxo / Violeta (#7C3AED)
    pinColor = isSelected ? '#8B5CF6' : '#7C3AED';
    mainColor = isSelected ? '#A78BFA' : '#8B5CF6';
    topLightColor = isSelected ? '#DDD6FE' : '#C4B5FD';
    darkColor = isSelected ? '#7C3AED' : '#6D28D9';
    opEmoji = '🔄';
    symbolSvg = `
      <!-- Símbolo de Troca (Duas setas de troca ⇄ dentro do badge circular) -->
      <circle cx="25" cy="18" r="4.5" fill="#FFFFFF" stroke="#6D28D9" stroke-width="0.8" />
      <path d="M 23 16.8 L 27 16.8 M 25.6 15.6 L 27 16.8 L 25.6 18 M 27 19.2 L 23 19.2 M 24.4 18 L 23 19.2 L 24.4 20.4" stroke="#7C3AED" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
    `;
  } else if (place.orderStage === 'retorno') {
    // 4. Retorno da Troca (2ª Entrega de volta ao ponto de coleta)
    pinColor = isSelected ? '#F59E0B' : '#D97706';
    mainColor = isSelected ? '#FBBF24' : '#F59E0B';
    topLightColor = isSelected ? '#FDE68A' : '#FEF3C7';
    darkColor = isSelected ? '#D97706' : '#B45309';
    opEmoji = '↩️';
    symbolSvg = `
      <circle cx="25" cy="18" r="4.5" fill="#FFFFFF" stroke="#B45309" stroke-width="0.8" />
      <path d="M 27 18 L 23 18 M 24.5 16.5 L 23 18 L 24.5 19.5" stroke="#D97706" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    `;
  } else {
    // 2. Entrega: Laranja Oficial da Logo Zap (#FF5E00 / #EA580C)
    pinColor = isSelected ? '#FF7A29' : '#FF5E00';
    mainColor = isSelected ? '#FFA826' : '#FF5E00';
    topLightColor = isSelected ? '#FFE8A0' : '#FFDB78';
    darkColor = isSelected ? '#EA580C' : '#C2410C';
    opEmoji = '📦';
  }

  // Nome do Local SEMPRE em cima (em todas as makers)
  const rawPlaceName = place.name || 'Local';
  const cleanPlaceName = rawPlaceName.length > 24 ? rawPlaceName.slice(0, 22) + '...' : rawPlaceName;

  const placePhoto = getPlacePhoto(place);

  // Veículo da encomenda individual
  const singleVehicle = getVehicleInfo(place.vehicleType);
  const singlePrice = Number(place.price) || Number((place as any).total) || Number((place as any).valor_total) || 0;
  const singleClientName = place.customerName 
    ? (place.customerName.length > 26 ? place.customerName.slice(0, 24) + '...' : place.customerName) 
    : 'Cliente';

  // Soma dos valores de todas as encomendas no mesmo local
  const sumTotalValues = isMultiple
    ? placesAtLocation.reduce((acc, p) => acc + (Number(p.price) || Number((p as any).total) || Number((p as any).valor_total) || 0), 0)
    : singlePrice;

  // Montagem do conteúdo dos clientes:
  // Se houver mais de uma encomenda no mesmo lugar:
  // "embaixo tem o nome dos clientes. Lá vai ter as cores, nas cores de coleta e entrega, ou troca. Aí ele vem com a cor de fundo, com a borda e a cor de fundo."
  // "e quando tiver mais de uma, tem que estar na frente se é carro ou moto, lá na maker mesmo."
  const customerContentHtml = isMultiple ? `
    <div class="place-marker-customers-list">
      ${placesAtLocation.slice(0, 4).map((p, idx) => {
        const cName = p.customerName ? (p.customerName.length > 20 ? p.customerName.slice(0, 18) + '..' : p.customerName) : `Cliente ${idx + 1}`;
        const pVeh = getVehicleInfo(p.vehicleType);
        const pPrice = Number(p.price) || Number((p as any).total) || Number((p as any).valor_total) || 0;

        let opLabel = 'Entrega';
        let opBg = 'rgba(234, 88, 12, 0.90)';
        let opBorder = '#FDBA74';

        if (p.operationType === 'coleta') {
          opLabel = 'Coleta';
          opBg = 'rgba(11, 81, 135, 0.90)';
          opBorder = '#93C5FD';
        } else if (p.operationType === 'troca') {
          opLabel = 'Troca';
          opBg = 'rgba(124, 58, 237, 0.90)';
          opBorder = '#C4B5FD';
        } else if (p.orderStage === 'retorno') {
          opLabel = 'Retorno';
          opBg = 'rgba(217, 119, 6, 0.90)';
          opBorder = '#FDE68A';
        }

        return `
          <div>
          <div 
            class="place-marker-customer-line" 
            data-customer-idx="${idx}"
            style="background: ${opBg}; border: 1.2px solid ${opBorder}; border-radius: 6px; padding: 2px 5px; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.12s ease;"
            title="${opLabel}: ${cName} (${pVeh.label}) - R$ ${pPrice.toFixed(2)}"
          >
            <!-- Na frente: se é carro ou moto com cor de fundo para diferenciar -->
            <span 
              class="place-marker-vehicle-tag" 
              style="background: ${pVeh.bg}; color: ${pVeh.color}; border: 1.2px solid ${pVeh.border}; font-size: 9px; font-weight: 900; padding: 0.5px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2.5px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.3); text-shadow: 0 0.5px 1px rgba(0,0,0,0.3);"
            >
              <span>${pVeh.emoji}</span>
              <span>${pVeh.label}</span>
            </span>

            <!-- Nome do cliente -->
            <span class="place-marker-customer-name" style="color: #ffffff; font-size: 10.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 105px;">
              ${cName}
            </span>

            <!-- Valor do pedido individual -->
            ${pPrice > 0 ? `
              <span style="font-size: 9px; font-weight: 900; color: #FEF08A; text-shadow: 0 1px 2px rgba(0,0,0,0.5); white-space: nowrap; margin-left: auto;">
                R$ ${pPrice.toFixed(2)}
              </span>
            ` : ''}

            <!-- Nome da operação (Coleta, Entrega, Troca) -->
            <span style="${pPrice > 0 ? 'margin-left: 2px;' : 'margin-left: auto;'} font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #ffffff; opacity: 0.95; letter-spacing: 0.02em; padding-left: 2px;">
              ${opLabel}
            </span>
          </div>
          ${renderMarkerNote(p)}
          </div>
        `;
      }).join('')}
      ${placesAtLocation.length > 4 ? `<span class="place-marker-customer-more" style="color: #cbd5e1; font-weight: 800; font-size: 9.5px; padding-left: 2px;">+${placesAtLocation.length - 4} outros</span>` : ''}
    </div>
  ` : `
    <!-- Maker Individual: especifica o veículo na frente e mostra o cliente com fundo/borda suave -->
    <div 
      class="place-marker-single-customer"
      style="background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 6px; padding: 1.5px 5px; display: flex; align-items: center; gap: 4px; margin-top: 2px;"
    >
      <span 
        class="place-marker-vehicle-tag" 
        style="background: ${singleVehicle.bg}; color: ${singleVehicle.color}; border: 1.2px solid ${singleVehicle.border}; font-size: 9px; font-weight: 900; padding: 0.5px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2.5px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.3); text-shadow: 0 0.5px 1px rgba(0,0,0,0.3);"
      >
        <span>${singleVehicle.emoji}</span>
        <span>${singleVehicle.label}</span>
      </span>
      <span class="place-marker-customer" style="color: #ffffff; font-size: 11px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">
        ${singleClientName}
      </span>
      ${singlePrice > 0 ? `
        <span style="margin-left: auto; font-size: 9.5px; font-weight: 900; color: #FEF08A; text-shadow: 0 1px 2px rgba(0,0,0,0.5); white-space: nowrap; background: rgba(0,0,0,0.25); padding: 0.5px 4px; border-radius: 4px;">
          R$ ${singlePrice.toFixed(2)}
        </span>
      ` : ''}
    </div>

    ${isCollectionCenter ? '' : renderMarkerNote(place)}
  `;

  const dateBadge = getPlaceDateBadgeInfo(place);

  return L.divIcon({
    className: 'custom-place-marker',
    html: `
      <div class="place-marker-bubble ${isSelected ? 'selected' : ''}">
        <!-- Alfinete com Caixinha 3D Oficial da Operação (cores originais ou cinza claro quando múltiplo) -->
        <div class="place-marker-pin ${isMultiple ? 'type-multiple' : `type-${opType}`}">
          <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Sombra no solo -->
            <ellipse cx="19" cy="43" rx="7.5" ry="2.2" fill="rgba(0, 0, 0, 0.28)" />

            <!-- Xzinho na ponta do alfinete marcando o ponto exato no solo -->
            <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="#FFFFFF" stroke-width="3.8" stroke-linecap="round" />
            <path d="M 14 38 L 24 48 M 14 48 L 24 38" stroke="${pinColor}" stroke-width="2.2" stroke-linecap="round" />

            <!-- Risquinho fininho do alfinete -->
            <line x1="19" y1="26" x2="19" y2="43" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" />
            <line x1="19" y1="26" x2="19" y2="43" stroke="${pinColor}" stroke-width="1.8" stroke-linecap="round" />

            <!-- Ponto central no cruzamento do X -->
            <circle cx="19" cy="43" r="1.4" fill="#FFFFFF" />

            <!-- Caixinha de entrega ou encomenda 3D nas cores oficiais (ou cinza claro) -->
            <path d="M 19 2 L 32 8.5 L 32 20.5 L 19 27 L 6 20.5 L 6 8.5 Z" fill="${darkColor}" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round" />

            <!-- Face Superior da Caixa (tampa - mais clarinha) -->
            <path d="M 19 2.5 L 31.5 8.5 L 19 14.5 L 6.5 8.5 Z" fill="${topLightColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

            <!-- Face Esquerda da Caixa -->
            <path d="M 6.5 8.5 L 19 14.5 L 19 26.5 L 6.5 20.5 Z" fill="${mainColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

            <!-- Face Direita da Caixa -->
            <path d="M 19 14.5 L 31.5 8.5 L 31.5 20.5 L 19 26.5 Z" fill="${darkColor}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />

            <!-- Fitas de encomenda brancas na caixa -->
            <path d="M 12.8 5.5 L 25.2 11.5" stroke="rgba(255, 255, 255, 0.92)" stroke-width="2" stroke-linecap="round" />
            <path d="M 19 14.5 L 19 26.5" stroke="rgba(255, 255, 255, 0.92)" stroke-width="2" stroke-linecap="round" />

            ${symbolSvg}
          </svg>
        </div>

        <!-- Etiqueta com Fundo Translúcido: NOME DO LOCAL EM CIMA, NOME DO CLIENTE EMBAIXO -->
        <div class="place-marker-label ${isMultiple ? 'type-multiple is-multiple' : `type-${opType}`} ${placePhoto ? 'has-photo' : 'no-photo'}">
          <!-- BADGE FLUTUANTE NO CANTO SUPERIOR DIREITO -->
          <span class="place-marker-date-badge badge-${dateBadge.type}">
            ${dateBadge.iconSvg}
            <span>${dateBadge.label}</span>
          </span>

          ${placePhoto ? `
            <!-- FOTO NO LUGAR DO ÍCONE DA LABEL: TOQUE PARA ABRIR CHEIA NA TELA -->
            <div class="place-marker-label-photo-thumb place-marker-photo-trigger" data-photo-url="${placePhoto}" title="Clique para abrir foto cheia na tela">
              <img src="${placePhoto}" alt="Foto indisponível" class="place-marker-thumb-img" />
              <div class="place-marker-thumb-hover">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </div>
            </div>
          ` : `
            <span style="font-size: 16px; align-self: center; flex-shrink: 0;">${opEmoji}</span>
          `}

          <div class="place-marker-text-group">
            <!-- 1. NOME DO LOCAL EM CIMA (EM DESTAQUE) -->
            <div class="place-marker-header-row">
              <span class="place-marker-place">${cleanPlaceName}</span>
              ${isCollectionCenter
                ? `<span class="place-marker-op-badge" style="background: linear-gradient(135deg, #0F766E, #115E59); border: 1.2px solid #99F6E4; color: #FFFFFF; font-size: 9px; font-weight: 900; padding: 1.5px 5px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.02em;">CENTRAL DE COLETA</span>`
                : isPublicForDriver
                ? `<span class="place-marker-op-badge" style="background: linear-gradient(135deg, #F59E0B, #D97706); border: 1.2px solid #FDE68A; color: #FFFFFF; font-size: 9px; font-weight: 900; padding: 1.5px 5px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.02em;">⚡ ${isMultiple ? `${placesAtLocation.length} PEDIDOS` : 'DISPONÍVEL'}</span>`
                : isMultiple 
                ? `<span class="place-marker-count-pill" style="background: #475569; border: 1px solid #CBD5E1; color: #ffffff; font-size: 9px; font-weight: 900; padding: 1px 6px; border-radius: 9999px;">${placesAtLocation.length} no local</span>${sumTotalValues > 0 ? `<span class="place-marker-sum-pill" style="background: #059669; border: 1px solid #6EE7B7; color: #ffffff; font-size: 9px; font-weight: 900; padding: 1px 6px; border-radius: 9999px; margin-left: 2px;">Total: R$ ${sumTotalValues.toFixed(2)}</span>` : ''}` 
                : `<span class="place-marker-op-badge" style="background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.45); border-radius: 4px; padding: 1px 4px; font-size: 9px; font-weight: 900; text-transform: uppercase;">${opType === 'coleta' ? 'Coleta' : opType === 'troca' ? 'Troca' : place.orderStage === 'retorno' ? 'Retorno' : 'Entrega'}</span>`
              }
            </div>
            <!-- 2. NOME DO CLIENTE EMBAIXO COM VEÍCULO NA FRENTE OU LISTAGEM COM FUNDO E BORDA -->
            ${customerContentHtml}
            ${driverStatus ? `
              <!-- Status do motorista somado às demais informações -->
              <div
                class="place-marker-driver-status"
                style="background: ${driverStatus.enRoute ? 'linear-gradient(135deg, #2563EB, #1D4ED8)' : 'linear-gradient(135deg, #10B981, #059669)'}; color: #FFFFFF; font-size: 11px; font-weight: 900; padding: 4px 9px; border-radius: 6px; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); border: 1.2px solid ${driverStatus.enRoute ? '#93C5FD' : '#6EE7B7'}; letter-spacing: 0.02em; white-space: nowrap; width: fit-content; max-width: 230px; overflow: hidden; text-overflow: ellipsis;"
              >
                <span>${driverStatus.enRoute ? '🛵' : '✔'} ${driverStatus.text}</span>
              </div>
            ` : ''}
            ${isPublicForDriver ? `
              <!-- AVISO DE CONFIRMAÇÃO DO MOTORISTA -->
              <div 
                class="place-marker-claim-prompt" 
                style="background: linear-gradient(135deg, #10B981, #059669); color: #FFFFFF; font-size: 9.5px; font-weight: 900; padding: 2.5px 7px; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 3.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); border: 1.2px solid #6EE7B7; text-transform: uppercase; letter-spacing: 0.02em;"
              >
                <span>⚡ ${isMultiple ? 'TOQUE PARA ESCOLHER O PEDIDO' : 'TOQUE PARA ACEITAR O PEDIDO'}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `,
    iconSize: [360, (isMultiple ? (placesAtLocation.length > 2 ? 120 : 96) : (isPublicForDriver ? 104 : 74)) + (driverStatus ? 28 : 0)],
    iconAnchor: [19, 43],
    popupAnchor: [0, -43]
  });
};

// Mascote / Bichinho em Moto de Entrega Estilizada
export const createDriverMarkerIcon = (driver: Driver, isSelected: boolean) => {
  const driverColor = getDriverPermanentColor(driver.id || driver.phone || driver.name);
  const vehicleEmoji = driver.vehicleType === 'moto' ? '🏍️' : driver.vehicleType === 'utilitario' ? '🚚' : '🚗';
  const headingAngle = typeof driver.heading === 'number' && !isNaN(driver.heading) ? Math.round(driver.heading) : 0;
  const parts = (driver.name || 'Motorista').trim().split(/\s+/);
  const cleanDriverName = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
  const driverLabelBg = hexToRgba(driverColor, 0.95);

  // A última hora que foi visto (formato HH:mm)
  let lastSeenHour = '';
  if (driver.lastSeenTimestamp && !isNaN(driver.lastSeenTimestamp)) {
    lastSeenHour = new Date(driver.lastSeenTimestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (driver.lastUpdatedStr) {
    const match = driver.lastUpdatedStr.match(/(\d{2}:\d{2})/);
    lastSeenHour = match ? match[1] : driver.lastUpdatedStr;
  } else {
    lastSeenHour = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const vType = (driver.vehicleType || 'moto') as 'moto' | 'carro' | 'utilitario';
  const vehicleSvg = get3DVehicleSvg(vType, headingAngle, driverColor, `drv-${driver.id}`);
  const isOnlineOrMoving = driver.status === 'em_rota' || driver.status === 'disponivel';

  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div class="driver-3d-card ${isSelected ? 'selected' : ''}">
        <div class="driver-3d-tag" style="background: ${driverLabelBg}; border: 1.5px solid ${driverColor}; box-shadow: 0 3px 8px ${hexToRgba(driverColor, 0.4)};">
          <span style="display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.22);border-radius:6px;padding:1px 3px;">${vehicleEmoji}</span>
          <span style="font-weight:900;">${cleanDriverName}</span>
          <span class="driver-3d-time">${lastSeenHour}</span>
        </div>
        <div class="driver-vehicle-relative-wrap">
          ${isOnlineOrMoving ? `<div class="vehicle-pulse-radar" style="border-color: ${driverColor}; background: ${hexToRgba(driverColor, 0.22)}; box-shadow: 0 0 16px ${hexToRgba(driverColor, 0.45)};"></div>` : ''}
          <div class="vehicle-pulse-halo" style="background: ${hexToRgba(driverColor, 0.24)}; border-color: ${hexToRgba(driverColor, 0.6)};"></div>
          <div class="vehicle-pulse-ball" style="background: ${driverColor}; box-shadow: 0 2px 10px ${hexToRgba(driverColor, 0.75)};"></div>
          ${vehicleSvg}
        </div>
      </div>
    `,
    iconSize: [80, 92],
    iconAnchor: [40, 58],
    popupAnchor: [0, -58]
  });
};

// Marcador do Usuário / GPS Ao Vivo:
// - Para Admin, Atendente ou Terminal: Seta de Navegação 3D no centro da bola que pulsa
// - Para Motorista: Veículo 3D com a tag e cor exclusiva do motorista no centro da bola que pulsa
export const createUserLocationIcon = (
  role: UserRole = 'motorista',
  vehicleType: 'moto' | 'carro' | 'utilitario' = 'moto',
  heading: number | null = null,
  isTracking: boolean = false,
  driverColor: string = '#0B5187',
  driverName?: string
) => {
  const currentAngle = heading !== null && !isNaN(heading) ? Math.round(heading) : 0;

  // Se for admin_geral, atendente ou terminal -> Seta de Navegação 3D no centro da bola que pulsa
  if (role === 'admin_geral' || role === 'atendente' || role === 'terminal') {
    const arrowSvg = get3DGmapsArrowSvg(currentAngle, isTracking, 'user-nav-arrow');
    return L.divIcon({
      className: 'user-location-wrapper',
      html: `
        <div class="google-maps-3d-arrow-wrap">
          <div class="vehicle-pulse-radar"></div>
          <div class="vehicle-pulse-halo"></div>
          <div class="vehicle-pulse-ball"></div>
          ${arrowSvg}
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [32, 32]
    });
  }

  // Se for motorista -> Veículo 3D com a tag do motorista no centro da bola que pulsa
  const vehicleEmoji = vehicleType === 'moto' ? '🏍️' : vehicleType === 'utilitario' ? '🚚' : '🚗';
  const vehicleSvg = get3DVehicleSvg(vehicleType, currentAngle, driverColor, 'user-vehicle');
  const driverLabelBg = hexToRgba(driverColor, 0.95);
  const parts = (driverName || 'Você').trim().split(/\s+/);
  const cleanDriverName = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];

  return L.divIcon({
    className: 'custom-driver-marker user-driver-marker',
    html: `
      <div class="driver-3d-card user-driver-card">
        <div class="driver-3d-tag" style="background: ${driverLabelBg}; border: 1.5px solid ${driverColor}; box-shadow: 0 3px 8px ${hexToRgba(driverColor, 0.4)};">
          <span style="display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.22);border-radius:6px;padding:1px 3px;">${vehicleEmoji}</span>
          <span style="font-weight:900;">${cleanDriverName}</span>
          <span class="driver-3d-time" style="background:rgba(0,0,0,0.25);font-size:9px;">Você</span>
        </div>
        <div class="driver-vehicle-relative-wrap">
          <div class="vehicle-pulse-radar" style="border-color: ${driverColor}; background: ${hexToRgba(driverColor, 0.22)}; box-shadow: 0 0 16px ${hexToRgba(driverColor, 0.45)};"></div>
          <div class="vehicle-pulse-halo" style="background: ${hexToRgba(driverColor, 0.24)}; border-color: ${hexToRgba(driverColor, 0.6)};"></div>
          <div class="vehicle-pulse-ball" style="background: ${driverColor}; box-shadow: 0 2px 10px ${hexToRgba(driverColor, 0.75)};"></div>
          ${vehicleSvg}
        </div>
      </div>
    `,
    iconSize: [80, 92],
    iconAnchor: [40, 58],
    popupAnchor: [0, -58]
  });
};

// Helper to compute bearing in degrees between two coordinates (0 = North, 90 = East, etc.)
export const computeBearing = (startLat: number, startLng: number, endLat: number, endLng: number): number => {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const endLatRad = (endLat * Math.PI) / 180;
  const endLngRad = (endLng * Math.PI) / 180;

  const y = Math.sin(endLngRad - startLngRad) * Math.cos(endLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(endLatRad) -
    Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(endLngRad - startLngRad);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

// Marcador do Xzinho no Solo (Ponto Concluído: Coleta, Troca ou Entrega realizada do dia atual)
export const createCompletedXIcon = (mark: CompletedWaypointMark) => {
  const color = mark.operationType === 'coleta' 
    ? '#0B5187' 
    : mark.operationType === 'troca' 
    ? '#7C3AED' 
    : '#FF5E00';

  const opLabel = mark.operationType === 'coleta' 
    ? 'Coletado' 
    : mark.operationType === 'troca' 
    ? 'Trocado' 
    : 'Entregue';

  return L.divIcon({
    className: 'completed-waypoint-x-marker',
    html: `
      <div class="completed-x-marker-wrap" title="✓ ${opLabel} às ${mark.timeStr} • ${mark.placeName}">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Sombra circular/oval de contato no asfalto -->
          <ellipse cx="14" cy="16" rx="9" ry="3.8" fill="rgba(0, 0, 0, 0.38)" />

          <!-- Xzinho branco (borda de alto contraste para destacar no asfalto) -->
          <path d="M 7 7 L 21 21 M 7 21 L 21 7" stroke="#FFFFFF" stroke-width="4.8" stroke-linecap="round" />

          <!-- Xzinho na cor exata oficial da operação (Azul para Coleta, Laranja para Entrega, Roxo para Troca) -->
          <path d="M 7 7 L 21 21 M 7 21 L 21 7" stroke="${color}" stroke-width="2.6" stroke-linecap="round" />

          <!-- Ponto central branco de precisão -->
          <circle cx="14" cy="14" r="1.5" fill="#FFFFFF" />
        </svg>

        <!-- Tooltip flutuante que surge ao passar o mouse ou tocar -->
        <div class="completed-x-tooltip">
          <span class="completed-x-tag" style="background: ${color};">✓ ${opLabel} ${mark.timeStr}</span>
          <span class="completed-x-title">${mark.placeName}</span>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

