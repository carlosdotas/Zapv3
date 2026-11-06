import type React from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { Place, LocationCoordinates, MapLayerType, MapColorTheme, UserProfile, SearchHistoryItem, RouteInfo, Driver, VehicleFilterType, OperationFilterType, OperationsFilterState, OperationType, UserRequiredFieldsConfig, CompletedWaypointMark, DefaultNavigationApp, DateRangeFilter } from '../types/map';
import type { Customer } from '../types/customer';
import type { AuthAccount, UserRole } from '../types/auth';
import type { BaixaProximity } from '../services/apiTypes';
import type { BackgroundTrackingStatus } from '../services/backgroundGeolocationService';

export interface CustomerLocationModalData {
  placeId?: string;
  place?: Place;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  autoFocusSearch?: boolean;
  onLocationSelected?: (address: string, coordinates: LocationCoordinates, city?: string) => void;
}

export interface MapContextType {
  mapInstance: LeafletMap | null;
  setMapInstance: (map: LeafletMap | null) => void;
  currentCoords: LocationCoordinates;
  selectedPlace: Place | null;
  setSelectedPlace: React.Dispatch<React.SetStateAction<Place | null>>;
  mapLayer: MapLayerType;
  setMapLayer: (layer: MapLayerType) => void;
  mapTheme: MapColorTheme;
  setMapTheme: (theme: MapColorTheme) => void;
  showTraffic: boolean;
  setShowTraffic: (show: boolean) => void;
  
  // UI states
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (open: boolean) => void;
  isAdminSettingsOpen: boolean;
  setIsAdminSettingsOpen: (open: boolean) => void;
  isAdminUsersOpen: boolean;
  setIsAdminUsersOpen: (open: boolean) => void;
  adminUsersRoleFilter: 'todos' | 'motorista' | 'atendente';
  setAdminUsersRoleFilter: (filter: 'todos' | 'motorista' | 'atendente') => void;
  isCustomerListOpen: boolean;
  setIsCustomerListOpen: (open: boolean) => void;
  openCustomerList: () => void;
  closeCustomerList: () => void;
  isOrdersModalOpen: boolean;
  routeSelectMode: boolean;
  routeSelectedIds: string[];
  startRouteSelection: () => void;
  cancelRouteSelection: () => void;
  toggleRouteSelection: (ids: string[]) => void;
  isRoutePickerOpen: boolean;
  setIsRoutePickerOpen: (open: boolean) => void;
  setIsOrdersModalOpen: (open: boolean) => void;
  openOrdersModal: () => void;
  closeOrdersModal: () => void;
  isFinancialModalOpen: boolean;
  setIsFinancialModalOpen: (open: boolean) => void;
  financialInitialTab: 'pagar' | 'receber';
  openFinancialModal: (tab?: 'pagar' | 'receber') => void;
  closeFinancialModal: () => void;
  dateRangeFilter: DateRangeFilter;
  setDateRangeFilter: (filter: DateRangeFilter) => void;
  clearDateRangeFilter: () => void;
  isCalendarModalOpen: boolean;
  setIsCalendarModalOpen: (open: boolean) => void;
  openCalendarModal: () => void;
  closeCalendarModal: () => void;
  isNewOrderModalOpen: boolean;
  setIsNewOrderModalOpen: (open: boolean) => void;
  newOrderInitialPlace: Partial<Place> | null;
  openNewOrderForm: (initialPlace?: Partial<Place>) => void;
  addOrderDraft: (newPlace: Place) => boolean;
  addNewOrder: (newPlace: Place) => Promise<boolean>;
  viewingPhotoUrl: string | null;
  setViewingPhotoUrl: (url: string | null) => void;
  viewingPhotoPlace: Place | null;
  setViewingPhotoPlace: (place: Place | null) => void;
  openPhotoViewer: (photoUrl: string, place?: Place | null) => void;
  closePhotoViewer: () => void;
  isDriverOnline: boolean;
  setIsDriverOnline: (online: boolean) => void;
  driverActiveSeconds: number;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  loginWithAccount: (account: AuthAccount) => void;
  logout: () => void;
  
  // Search & Navigation
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchHistory: SearchHistoryItem[];
  addToHistory: (item: { query: string; placeName?: string; coordinates?: LocationCoordinates }) => void;
  clearHistory: () => void;
  
  // Routes & Street Highlighting & GPS Navigation
  activeRoute: RouteInfo | null;
  setActiveRoute: (route: RouteInfo | null) => void;
  calculateRouteToPlace: (dest: Place) => Promise<void>;
  calculateOrderRoute: (place: Place, customerParam?: Customer | null) => Promise<RouteInfo | null>;
  clearActiveRoute: () => void;
  defaultNavApp: DefaultNavigationApp;
  setDefaultNavApp: (app: DefaultNavigationApp) => void;

  // User & Saved
  user: UserProfile;
  updateUser: (updated: Partial<UserProfile>) => void;
  userRequiredFields: UserRequiredFieldsConfig;
  updateUserRequiredFields: (config: Partial<UserRequiredFieldsConfig>) => void;
  savedPlaces: Place[];
  allPlaces: Place[];
  /** Pedidos já entregues/finalizados — usados na tela de pedidos (Central de Pedidos) */
  completedOrders: Place[];
  completedWaypointMarks: CompletedWaypointMark[];
  revertCompletedMark: (markId: string) => Promise<boolean>;
  completePlaceWaypoint: (placeId: string, receiverName?: string, notes?: string, proximity?: BaixaProximity, pickupPhotos?: string[]) => Promise<boolean>;
  resetWorkflowToColetas: () => void;
  updatePlaceDetails: (placeId: string, partial: Partial<Place>) => Promise<boolean>;
  assignPlaceToDriver: (placeId: string, driverId: string | null, driverPhone?: string, driverName?: string, acceptedByDriver?: boolean) => Promise<boolean>;
  claimPublicOrder: (placeId: string, operation?: OperationType) => Promise<boolean>;
  toggleSavePlace: (place: Place) => void;
  isPlaceSaved: (placeId: string) => boolean;
  deletePlace: (placeId: string) => Promise<boolean>;

  // Customers & Contact Book
  customers: Customer[];
  addCustomer: (customerData: Omit<Customer, 'id' | 'createdAt'>, options?: { persist?: boolean }) => Customer;
  persistCustomer: (customer: Customer) => Promise<Customer | null>;
  updateCustomer: (id: string, partial: Partial<Customer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;
  customerLocationModalData: CustomerLocationModalData | null;
  openCustomerLocationModal: (data: CustomerLocationModalData) => void;
  closeCustomerLocationModal: () => void;

  // Drivers & Delivery Fleet
  drivers: Driver[];
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
  vehicleFilter: VehicleFilterType;
  setVehicleFilter: (filter: VehicleFilterType) => void;

  // Filters
  operationsFilter: OperationsFilterState;
  toggleOperationFilter: (op: OperationType) => void;
  setAllOperationsFilter: (enabled: boolean) => void;
  operationFilter: OperationFilterType;
  setOperationFilter: (filter: OperationFilterType) => void;

  // Actions
  flyToLocation: (coords: LocationCoordinates, zoom?: number) => void;
  locateUser: () => void;
  focusDriverLocation: () => void;
  viewAllMarkers: () => void;
  isLocating: boolean;
  userLocation: LocationCoordinates | null;
  isTrackingUser: boolean;
  toggleUserTracking: () => void;
  stopUserTracking: () => void;
  dismissPlaceProximity: (placeId: string) => void;
  hasRealGpsFix: boolean;
  gpsAccuracy: number | null;
  gpsError: {
    type: 'permission_denied' | 'insecure_context' | 'iframe_blocked' | 'timeout' | 'unavailable';
    message: string;
    canOpenStandalone?: boolean;
  } | null;
  clearGpsError: () => void;
  retryGps: () => void;

  // Integração com Servidor Express
  serverStatus: 'connected' | 'offline' | 'checking';
  serverMessage: string;
  serverLatencyMs: number | null;
  apiBaseUrl: string;
  updateApiBaseUrl: (url: string) => void;
  refreshServerData: (opts?: { silent?: boolean }) => Promise<void>;
  isSyncingServer: boolean;

  // Monitoramento em Segundo Plano (PWA com tela desligada)
  backgroundTrackingStatus: BackgroundTrackingStatus;
  startBackgroundGps: () => void;
  stopBackgroundGps: () => void;
}

