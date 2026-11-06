import { createContext, useContext } from 'react';
import type { MapContextType } from './mapStoreTypes';
import type { useMapUiState } from './hooks/useMapUiState';

export const MapContext = createContext<MapContextType | null>(null);
export const MapUiContext = createContext<ReturnType<typeof useMapUiState> | null>(null);

export const useMapStore = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapStore must be used within a MapProvider');
  return context;
};
export const useMapUiStore = () => { const value = useContext(MapUiContext); if (!value) throw new Error('Provedor de interface ausente.'); return value; };

export const MapSessionContext = createContext<Pick<MapContextType, 'user' | 'updateUser' | 'currentRole' | 'setCurrentRole' | 'isAuthenticated' | 'loginWithAccount' | 'logout' | 'isDriverOnline' | 'setIsDriverOnline' | 'driverActiveSeconds' | 'userRequiredFields' | 'updateUserRequiredFields'> | null>(null);
export const useMapSessionStore = () => { const value = useContext(MapSessionContext); if (!value) throw new Error('Provedor de sessão ausente.'); return value; };

export const MapDataContext = createContext<Pick<MapContextType, 'allPlaces' | 'savedPlaces' | 'completedOrders' | 'completedWaypointMarks' | 'customers' | 'drivers' | 'selectedPlace' | 'setSelectedPlace' | 'selectedDriver' | 'setSelectedDriver' | 'addCustomer' | 'persistCustomer' | 'updateCustomer' | 'deleteCustomer' | 'addNewOrder' | 'addOrderDraft' | 'updatePlaceDetails' | 'assignPlaceToDriver' | 'claimPublicOrder' | 'deletePlace' | 'toggleSavePlace' | 'isPlaceSaved' | 'completePlaceWaypoint' | 'revertCompletedMark'> | null>(null);
export const useMapDataStore = () => { const value = useContext(MapDataContext); if (!value) throw new Error('Provedor de dados ausente.'); return value; };

export const MapNavigationContext = createContext<Pick<MapContextType, 'mapInstance' | 'setMapInstance' | 'currentCoords' | 'mapLayer' | 'setMapLayer' | 'mapTheme' | 'setMapTheme' | 'activeRoute' | 'setActiveRoute' | 'calculateRouteToPlace' | 'calculateOrderRoute' | 'clearActiveRoute' | 'userLocation' | 'isTrackingUser' | 'hasRealGpsFix' | 'gpsAccuracy' | 'gpsError' | 'clearGpsError' | 'retryGps' | 'flyToLocation' | 'locateUser' | 'focusDriverLocation' | 'viewAllMarkers' | 'isLocating' | 'toggleUserTracking' | 'stopUserTracking' | 'dismissPlaceProximity' | 'defaultNavApp' | 'setDefaultNavApp'> | null>(null);
export const useMapNavigationStore = () => { const value = useContext(MapNavigationContext); if (!value) throw new Error('Provedor de navegação ausente.'); return value; };
