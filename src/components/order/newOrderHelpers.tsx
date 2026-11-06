import { LocationCoordinates, OrderVisibilityType } from '../../types/map';
import { AgendaContact } from '../../types/customer';

export const AGENDA_CONTACTS: AgendaContact[] = [];

export const extractCityFromAddress = (address?: string): string => {
  if (!address) return 'Goiânia';
  const match = address.match(/(?:,\s*|;\s*)([A-Za-zÀ-ÿ\s]+)\s*-\s*[A-Z]{2}/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const parts = address.split('-');
  if (parts.length >= 2) {
    const citySegment = parts[parts.length - 2].split(',').pop();
    if (citySegment && citySegment.trim()) return citySegment.trim();
  }
  return 'Goiânia';
};

export const DEFAULT_PICKUP_COORDS: LocationCoordinates = { lat: -16.6780, lng: -49.2590 };

export const DEFAULT_DELIVERY_COORDS: LocationCoordinates = { lat: -16.7118, lng: -49.2346 };

export const DEFAULT_EXCHANGE_COORDS: LocationCoordinates = { lat: -16.6990, lng: -49.2650 };

export type RoutePointKey = 'pickup' | 'exchange' | 'delivery';

export type RoutePointConfig = {
  visibility: OrderVisibilityType;
  driverId: string;
  sellerName: string;
  sellerPhone: string;
};

export const EMPTY_ROUTE_POINT_CONFIG: RoutePointConfig = {
  visibility: 'publico',
  driverId: '',
  sellerName: '',
  sellerPhone: ''
};
