import { useState, useCallback, useRef } from 'react';
import { Place, LocationCoordinates, RouteInfo } from '../../types/map';
import { Customer } from '../../types/customer';
import { fetchRoute, fetchMultiStopRoute } from '../../services/routingService';
import { getOrderLocationsForOperation } from '../../utils/customerLocationUtils';
import type { MapContextType } from '../mapStoreTypes';

export function useMapNavigation({ currentCoords, customers, mapInstance }: Pick<MapContextType, 'currentCoords' | 'customers' | 'mapInstance'>) {
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [hasRealGpsFix, setHasRealGpsFix] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [isTrackingUser, setIsTrackingUser] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredInitialRef = useRef<boolean>(false);

  const calculateRouteToPlace = useCallback(async (dest: Place) => {
    const origin = userLocation || currentCoords;
    const result = await fetchRoute(origin, dest.coordinates);
    if (result) {
      setActiveRoute(result);
      if (mapInstance && result.coordinates.length > 0) {
        const bounds = [
          [Math.min(...result.coordinates.map(c => c.lat)), Math.min(...result.coordinates.map(c => c.lng))],
          [Math.max(...result.coordinates.map(c => c.lat)), Math.max(...result.coordinates.map(c => c.lng))]
        ] as [[number, number], [number, number]];
        mapInstance.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
      }
    }
  }, [userLocation, currentCoords, mapInstance]);

  /**
   * Traça a rota da encomenda conforme a regra:
   * - Coleta: Local do mapa -> Cliente
   * - Entrega: Cliente -> Local do mapa
   * - Troca: Cliente -> Local do mapa -> Cliente
   * Se o cliente não tiver local, NÃO traça rota e limpa rota ativa.
   */
  const calculateOrderRoute = useCallback(async (place: Place, customerParam?: Customer | null): Promise<RouteInfo | null> => {
    const op = place.operationType || 'coleta';
    const currentCustomers = customerParam ? [customerParam, ...customers] : customers;
    const resolved = getOrderLocationsForOperation(place, op, currentCustomers);

    if (!resolved.canTraceRoute || resolved.waypoints.length < 2) {
      console.log('[Order Routing] Cliente sem localização cadastrada - rota não traçada.');
      setActiveRoute(null);
      return null;
    }

    try {
      const result = await fetchMultiStopRoute(resolved.waypoints);
      if (result) {
        setActiveRoute(result);
        return result;
      }
    } catch (err) {
      console.warn('[Order Routing] Erro ao traçar rota do pedido:', err);
    }
    return null;
  }, [customers]);

  const clearActiveRoute = useCallback(() => {
    setActiveRoute(null);
  }, []);


  return { activeRoute, setActiveRoute, hasRealGpsFix, setHasRealGpsFix, gpsAccuracy, setGpsAccuracy, userLocation, setUserLocation, isTrackingUser, setIsTrackingUser, watchIdRef, hasCenteredInitialRef, calculateRouteToPlace, calculateOrderRoute, clearActiveRoute };
}
