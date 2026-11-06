import type { LocationCoordinates } from '../../types/map';

export function extractCoordsFromString(str?: string | null): LocationCoordinates | null {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
  }
  return null;
}

// Geocodificação inteligente de endereços conhecidos nos pedidos de Goiás
export function resolveKnownAddressCoordinates(addr?: string | null): LocationCoordinates | null {
  if (!addr || typeof addr !== 'string') return null;
  const lower = addr.toLowerCase();
  
  if (lower.includes('virgílio xavier') || lower.includes('virgilio xavier') || lower.includes('crimeia leste')) {
    return { lat: -16.642796, lng: -49.261818 };
  }
  if (lower.includes('martins borges') || lower.includes('kiras')) {
    return { lat: -16.644320, lng: -49.262011 };
  }
  if (lower.includes('joão luiz de almeida') || lower.includes('joao luiz de almeida') || lower.includes('guimarães natal') || lower.includes('guimaraes natal')) {
    return { lat: -16.648841, lng: -49.262825 };
  }
  if (lower.includes('goiás norte, 4066') || lower.includes('goias norte, 4066') || lower.includes('crimeia oeste')) {
    return { lat: -16.623669, lng: -49.279572 };
  }
  if (lower.includes('goiás norte') || lower.includes('goias norte') || lower.includes('urias magalhães') || lower.includes('urias magalhaes') || lower.includes('urias')) {
    return { lat: -16.649073, lng: -49.264584 };
  }
  if (lower.includes('anhanguera') || lower.includes('aeroviario')) {
    return { lat: -16.665380, lng: -49.305693 };
  }
  if (lower.includes('santo antônio') || lower.includes('santo antonio') || lower.includes('sao jose') || lower.includes('são josé')) {
    return { lat: -16.665205, lng: -49.308033 };
  }
  if (lower.includes('rua do comércio') || lower.includes('rua do comercio') || lower.includes('centro oeste')) {
    return { lat: -16.667362, lng: -49.286129 };
  }
  if (lower.includes('vila santa helena') || lower.includes('rua g') || lower.includes('pontojo')) {
    return { lat: -16.656294, lng: -49.284550 };
  }
  if (lower.includes('rio branco') || lower.includes('panorama')) {
    return { lat: -16.653226, lng: -49.282353 };
  }
  if (lower.includes('leopoldo de bulhões') || lower.includes('leopoldo de bulhoes') || lower.includes('75190-000')) {
    return { lat: -16.631970, lng: -48.735088 };
  }
  if (lower.includes('flamboyant') || lower.includes('jamel cecílio') || lower.includes('jamel cecilio')) {
    return { lat: -16.7118, lng: -49.2346 };
  }
  if (lower.includes('parque amazonia') || lower.includes('parque amazônia') || lower.includes('leandro da cruz')) {
    return { lat: -16.7258, lng: -49.2842 };
  }
  if (lower.includes('capital encomendas')) {
    return { lat: -16.673504, lng: -49.291186 };
  }
  if (lower.includes('lacerda')) {
    return { lat: -16.626585, lng: -48.740288 };
  }
  return null;
}
