import { useMemo } from 'react';
import { useServerDataSync } from './hooks/useServerDataSync';
import { useCustomerActions } from './hooks/useCustomerActions';
import { useOrderEditing } from './hooks/useOrderEditing';
import { useAssignPlaceToDriver } from './hooks/useAssignPlaceToDriver';
import { useClaimPublicOrder } from './hooks/useClaimPublicOrder';
import { useOrderCreation } from './hooks/useOrderCreation';
import { useOrderCompletion } from './hooks/useOrderCompletion';
import { useAcquirePosition } from './hooks/useAcquirePosition';
import { useMapUiState } from './hooks/useMapUiState';
import { useDriverOnlineClock } from './hooks/useDriverOnlineClock';
import { useMapNavigation } from './hooks/useMapNavigation';
import { useOperationalServices } from '../hooks/useOperationalServices';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { Place, LocationCoordinates, MapLayerType, MapColorTheme, UserProfile, SearchHistoryItem, Driver, VehicleFilterType, OperationFilterType, OperationsFilterState, OperationType, UserRequiredFieldsConfig, DEFAULT_USER_REQUIRED_FIELDS, CompletedWaypointMark, DefaultNavigationApp } from '../types/map';
import { driverTrackingClient, isDriverStale } from '../services/driverTrackingClient';
import { Customer } from '../types/customer';

import { getSavedLocation, saveLocationToStorage, saveOperationsFilterToStorage, saveVehicleFilterToStorage } from '../utils/storage';


import { getDistanceMeters } from '../utils/geoUtils';
import { recordPlaceUsage } from '../utils/mostUsedPlaces';



import { AuthAccount, UserRole } from '../types/auth';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { formatPhotoUrl, extractPhotoUrls } from '../services/apiAdapters';
import { isTemporaryOrderId, getOrderKey, cleanOrderId, getBaseOrderId } from '../utils/orderIds';
import { runOncePerKey } from '../utils/orderSync';
import { mergeCompletedWaypointMarks } from '../utils/completedWaypointMarks';
import { filterPlacesBySequence } from '../utils/orderSequence';

import { BaixaProximity } from '../services/apiTypes';

import { settingsService } from '../services/settingsService';
import { realtimeAssignmentService } from '../services/realtimeAssignmentService';
import { backgroundGeolocationService, BackgroundTrackingStatus } from '../services/backgroundGeolocationService';
import { scheduleStorageSave, scheduleIdleTask } from '../utils/backgroundScheduler';
import { getDriverPermanentColor } from '../utils/driverColorUtils';
import { getDriverCurrentCity, isPlaceInCity, KNOWN_CITIES } from '../utils/driverCityUtils';

import type { CustomerLocationModalData } from './mapStoreTypes';
import { DEFAULT_COORDS, DEFAULT_USER } from './mapDefaults';
import { resolvePlaceId } from './mapWorkflow';
import { MapContext, MapUiContext, MapSessionContext, MapDataContext, MapNavigationContext } from './mapStoreContext';
export type { CustomerLocationModalData } from './mapStoreTypes';
export { useMapStore } from './mapStoreContext';

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [currentCoords, setCurrentCoords] = useState<LocationCoordinates>(() => getSavedLocation().coords);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_saved_places');
      if (saved) {
        const parsed: Place[] = JSON.parse(saved);
        return parsed.filter(p => !p.id.startsWith('plc-') && p.orderStage !== 'concluido');
      }
    } catch {}
    return [];
  });
  useEffect(() => settingsService.subscribe(() => {}), []);
  const [mapLayer, setMapLayerState] = useState<MapLayerType>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_map_layer');
      if (saved && ['default', 'osm', 'terrain', 'dark', 'satellite'].includes(saved)) {
        return saved as MapLayerType;
      }
    } catch (e) {
      // Ignore
    }
    return 'default';
  });

  const setMapLayer = useCallback((layer: MapLayerType) => {
    setMapLayerState(layer);
    try {
      localStorage.setItem('encomendaszap_map_layer', layer);
    } catch (e) {
      // Ignore
    }
  }, []);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Filtros de mapa (todas as operações e veículos sempre ativos por padrão)
  const [operationsFilter, setOperationsFilterState] = useState<OperationsFilterState>({
    coleta: true,
    entrega: true,
    troca: true
  });
  const [vehicleFilter, setVehicleFilterState] = useState<VehicleFilterType>('todos');
  const [operationFilter, setOperationFilter] = useState<OperationFilterType>('todas');

  const toggleOperationFilter = useCallback((op: OperationType) => {
    setOperationsFilterState(prev => {
      const next = { ...prev, [op]: !prev[op] };
      saveOperationsFilterToStorage(next);
      return next;
    });
  }, []);

  const setAllOperationsFilter = useCallback((enabled: boolean) => {
    const next = { coleta: enabled, entrega: enabled, troca: enabled };
    setOperationsFilterState(next);
    saveOperationsFilterToStorage(next);
  }, []);

  const setVehicleFilter = useCallback((filter: VehicleFilterType) => {
    setVehicleFilterState(filter);
    saveVehicleFilterToStorage(filter);
  }, []);


  // Mantém o motorista selecionado sincronizado com a telemetria em tempo real
  useEffect(() => {
    if (selectedDriver) {
      const liveDriver = drivers.find(d => d.id === selectedDriver.id);
      if (liveDriver && (
        liveDriver.coordinates.lat !== selectedDriver.coordinates.lat ||
        liveDriver.speedKmH !== selectedDriver.speedKmH ||
        liveDriver.heading !== selectedDriver.heading ||
        liveDriver.lastSeenTimestamp !== selectedDriver.lastSeenTimestamp
      )) {
        setSelectedDriver(liveDriver);
      }
    }
  }, [drivers, selectedDriver]);
  const [mapTheme, setMapThemeState] = useState<MapColorTheme>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_map_theme');
      if (saved && ['blue-corporate', 'blue-vibrant', 'blue-dark', 'blue-clean', 'natural'].includes(saved)) {
        return saved as MapColorTheme;
      }
    } catch (e) {
      // Ignore
    }
    return 'natural';
  });

  const setMapTheme = useCallback((theme: MapColorTheme) => {
    setMapThemeState(theme);
    try {
      localStorage.setItem('encomendaszap_map_theme', theme);
    } catch (e) {
      // Ignore
    }
  }, []);

const uiState = useMapUiState();
  const { showTraffic, setShowTraffic, isSidebarOpen, setIsSidebarOpen, isProfileOpen, setIsProfileOpen, isLoginModalOpen, setIsLoginModalOpen, isRegisterModalOpen, setIsRegisterModalOpen, isAdminSettingsOpen, setIsAdminSettingsOpen, isAdminUsersOpen, setIsAdminUsersOpen, adminUsersRoleFilter, setAdminUsersRoleFilter, isCustomerListOpen, setIsCustomerListOpen, openCustomerList, closeCustomerList, isOrdersModalOpen, setIsOrdersModalOpen, routeSelectMode, setRouteSelectMode, routeSelectedIds, setRouteSelectedIds, isRoutePickerOpen, setIsRoutePickerOpen, startRouteSelection, cancelRouteSelection, toggleRouteSelection, openOrdersModal, closeOrdersModal, isFinancialModalOpen, setIsFinancialModalOpen, financialInitialTab, setFinancialInitialTab, openFinancialModal, closeFinancialModal, dateRangeFilter, setDateRangeFilterState, isCalendarModalOpen, setIsCalendarModalOpen, openCalendarModal, closeCalendarModal, setDateRangeFilter, clearDateRangeFilter, isNewOrderModalOpen, setIsNewOrderModalOpen, newOrderInitialPlace, setNewOrderInitialPlace, viewingPhotoUrl, setViewingPhotoUrl, viewingPhotoPlace, setViewingPhotoPlace, openPhotoViewer, closePhotoViewer } = uiState;

  const openNewOrderForm = useCallback((initialPlace?: Partial<Place>) => {
    const savedRole = localStorage.getItem('encomendaszap_user_role');
    if (savedRole === 'motorista' || user?.userRole === 'motorista') {
      console.warn('[openNewOrderForm] Motoristas não possuem permissão para adicionar pedidos.');
      return;
    }
    setNewOrderInitialPlace(initialPlace || null);
    if (initialPlace && initialPlace.id && initialPlace.name && initialPlace.coordinates) {
      setSelectedPlace(initialPlace as Place);
    } else {
      const draftPlace: Place = {
        id: initialPlace?.id || `pedido-${Date.now()}`,
        name: initialPlace?.name || 'Novo Local de Encomenda',
        address: initialPlace?.address || 'Endereço a definir',
        coordinates: initialPlace?.coordinates || currentCoords || { lat: -16.6869, lng: -49.2648 },
        operationType: initialPlace?.operationType || 'coleta',
        vehicleType: initialPlace?.vehicleType || 'moto',
        packageType: initialPlace?.packageType || 'caixa',
        orderDateBadge: initialPlace?.orderDateBadge || 'hoje',
        customerName: initialPlace?.customerName || '',
        customerPhone: initialPlace?.customerPhone || '',
        responsibleName: initialPlace?.responsibleName || '',
        responsiblePhone: initialPlace?.responsiblePhone || '',
        observations: initialPlace?.observations || '',
        ...initialPlace
      };
      setSelectedPlace(draftPlace);
    }
  }, [currentCoords]);

  // Status do Motorista (Chavinha estilo Uber: Online / Offline para rodar)
const { isDriverOnline, setIsDriverOnlineState, ONLINE_SINCE_KEY, readOnlineSince, driverActiveSeconds, setDriverActiveSeconds, setIsDriverOnline } = useDriverOnlineClock();

  // Perfil e tipo de usuário autenticado
  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_user_role') as UserRole;
      if (saved && ['admin_geral', 'atendente', 'terminal', 'motorista'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'atendente'; // Padrão com o mapa completo
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const [completedWaypointMarks, setCompletedWaypointMarks] = useState<CompletedWaypointMark[]>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_completed_marks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return mergeCompletedWaypointMarks([], parsed);
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [allPlaces, setAllPlaces] = useState<Place[]>(() => {
    try {
      localStorage.removeItem('encomendaszap_coletas_v2');
      const saved = localStorage.getItem('encomendaszap_all_places');
      if (saved) {
        const parsed: Place[] = JSON.parse(saved);
        // Remove quaisquer markers de teste ou mock legados (plc-*) e concluídos
        // e normaliza as fotos para as URLs com sufixo correto
        const onlyReal = parsed
          .filter(p => !p.id.startsWith('plc-') && p.orderStage !== 'concluido')
          .filter(p => {
            // Pedido criado localmente e nunca confirmado pelo servidor: descarta o resto de cache
            const stamp = Number(p.id.replace('pedido-', '').split('-')[0]);
            return !(p.id.startsWith('pedido-') && stamp > 1000000000 && Date.now() - stamp > 2 * 60 * 1000);
          })
          .map(p => {
            const formattedImg = p.imageUrl ? (formatPhotoUrl(p.imageUrl, 'md') || p.imageUrl) : undefined;
            const formattedPhotos = p.photos ? extractPhotoUrls(p.photos, 'md') : (formattedImg ? [formattedImg] : undefined);
            return {
              ...p,
              imageUrl: formattedImg,
              photos: formattedPhotos && formattedPhotos.length > 0 ? formattedPhotos : undefined
            };
          });
        if (onlyReal.length > 0) return onlyReal;
      }
    } catch (e) {
      // ignore
    }

    return [];
  });

  // Pedidos finalizados/entregues: não aparecem no mapa, mas exibidos na Central de Pedidos
  const [completedOrders, setCompletedOrders] = useState<Place[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const lastCustomersSyncAt = useRef(0);
  const customerMutationVersion = useRef(0);
  const orderSyncRequestVersion = useRef(0);
  const orderMutationVersion = useRef(0);
  const pendingOrderCreations = useRef(new Map<string, Promise<boolean>>());
  const pendingWaypointCompletions = useRef(new Map<string, Promise<boolean>>());

  useEffect(() => {
    try {
      localStorage.removeItem('encomendaszap_customers');
    } catch {}
  }, []);

  // Estados de Conexão com o Servidor Express
  const [serverStatus, setServerStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [serverMessage, setServerMessage] = useState<string>('Verificando conexão...');
  const [serverLatencyMs, setServerLatencyMs] = useState<number | null>(null);
  const [apiBaseUrlState, setApiBaseUrlState] = useState<string>(() => getApiBaseUrl());
  const [isSyncingServer, setIsSyncingServer] = useState<boolean>(false);

  // Atualiza a URL do servidor e reconecta
  const updateApiBaseUrl = useCallback((url: string) => {
    setApiBaseUrl(url);
    setApiBaseUrlState(url);
  }, []);

  // Busca todos os dados reais do servidor Express (locais, pedidos, clientes, motoristas)
  const { refreshServerData } = useServerDataSync({ orderSyncRequestVersion, orderMutationVersion, setIsSyncingServer, setServerStatus, setServerMessage, setServerLatencyMs, setCompletedWaypointMarks, setAllPlaces, setCompletedOrders, setSelectedPlace, lastCustomersSyncAt, customerMutationVersion, setCustomers, currentRole, setDrivers });

  // Atualização periódica dos pedidos (só com a aba visível) e imediata ao chegar uma notificação
  useEffect(() => {
    let running = false;
    let queued = false;
    const run = async (queueIfRunning = false) => {
      if (document.visibilityState !== 'visible') return;
      if (running) {
        if (queueIfRunning) queued = true;
        return;
      }
      running = true;
      try {
        if (queueIfRunning) await realtimeAssignmentService.fetchServerAssignments({ fresh: true });
        await refreshServerData({ silent: true });
      } finally {
        running = false;
        if (queued) { queued = false; void run(true); }
      }
    };
    const periodicRefresh = () => { scheduleIdleTask(() => { void run(); }); };
    const immediateRefresh = () => { scheduleIdleTask(() => { void run(true); }); };
    const timer = window.setInterval(periodicRefresh, 30000);
    window.addEventListener('zap:refresh-orders', immediateRefresh);
    document.addEventListener('visibilitychange', immediateRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('zap:refresh-orders', immediateRefresh);
      document.removeEventListener('visibilitychange', immediateRefresh);
    };
  }, [refreshServerData]);

  // Busca inicial única ao montar o app no servidor (SEM releitura ou polling periódico)
  useEffect(() => {
    refreshServerData();
  }, [refreshServerData]);

  // Sincronização em tempo real de atribuições (REST + polling)
  useEffect(() => {
    const unsubscribe = realtimeAssignmentService.subscribe((assignments) => {
      setAllPlaces(prev => {
        let hasChanges = false;
        const next = prev.map(p => {
          const numId = p.id.match(/\d+/)?.[0] || (p.orderCode ? p.orderCode.match(/\d+/)?.[0] : null);
          const assignment = assignments[p.id] || 
                             (p.operationType && numId ? assignments[`${numId}_${p.operationType}`] : null) ||
                             (p.operationType && numId ? assignments[`pedido-${numId}-${p.operationType}`] : null);
          if (p.collectionRestricted) return p;
          if (assignment && assignment.driverId) {
            if (p.assignedDriverId !== assignment.driverId || p.assignedDriverName !== assignment.driverName || Boolean(p.driverEnRoute) !== Boolean(assignment.enRoute) || Boolean(p.acceptedByDriver) !== Boolean(assignment.acceptedByDriver)) {
              hasChanges = true;
              return {
                ...p,
                assignedDriverId: assignment.driverId,
                assignedDriverName: assignment.driverName || p.assignedDriverName,
                assignedDriverPhone: assignment.driverPhone || p.assignedDriverPhone,
                driverEnRoute: Boolean(assignment.enRoute),
                acceptedByDriver: Boolean(assignment.acceptedByDriver)
              };
            }
          }
          return p;
        });

        if (hasChanges) {
          scheduleStorageSave('encomendaszap_all_places', next);
          return next;
        }
        return prev;
      });

      setSelectedPlace(prev => {
        if (!prev) return null;
        if (prev.collectionRestricted) return prev;
        const numId = prev.id.match(/\d+/)?.[0] || (prev.orderCode ? prev.orderCode.match(/\d+/)?.[0] : null);
        const assignment = assignments[prev.id] || 
                           (prev.operationType && numId ? assignments[`${numId}_${prev.operationType}`] : null) ||
                           (prev.operationType && numId ? assignments[`pedido-${numId}-${prev.operationType}`] : null);
        if (assignment && assignment.driverId && (prev.assignedDriverId !== assignment.driverId || prev.assignedDriverName !== assignment.driverName || Boolean(prev.driverEnRoute) !== Boolean(assignment.enRoute) || Boolean(prev.acceptedByDriver) !== Boolean(assignment.acceptedByDriver))) {
          return {
            ...prev,
            assignedDriverId: assignment.driverId,
            assignedDriverName: assignment.driverName || prev.assignedDriverName,
            assignedDriverPhone: assignment.driverPhone || prev.assignedDriverPhone,
            driverEnRoute: Boolean(assignment.enRoute),
            acceptedByDriver: Boolean(assignment.acceptedByDriver)
          };
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentRole]);

  const { persistCustomer, addCustomer, updateCustomer, deleteCustomer } = useCustomerActions({ customerMutationVersion, lastCustomersSyncAt, setCustomers, customers });

  const [customerLocationModalData, setCustomerLocationModalData] = useState<CustomerLocationModalData | null>(null);

  const openCustomerLocationModal = useCallback((data: CustomerLocationModalData) => {
    setCustomerLocationModalData(data);
  }, []);

  const closeCustomerLocationModal = useCallback(() => {
    setCustomerLocationModalData(null);
  }, []);

  const { updatePlaceDetails } = useOrderEditing({ allPlaces, selectedPlace, setAllPlaces, setSavedPlaces, setSelectedPlace, currentRole });



  const { assignPlaceToDriver } = useAssignPlaceToDriver({ allPlaces, selectedPlace, setAllPlaces, setSavedPlaces, setSelectedPlace });



  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([
    {
      id: 'h1',
      query: 'Flamboyant Shopping',
      placeName: 'Flamboyant Shopping, Jardim Goiás, Goiânia',
      coordinates: { lat: -16.7118, lng: -49.2346 },
      timestamp: Date.now() - 3600000
    },
    {
      id: 'h2',
      query: 'Buriti Shopping',
      placeName: 'Buriti Shopping, Aparecida de Goiânia',
      coordinates: { lat: -16.7328, lng: -49.2802 },
      timestamp: Date.now() - 86400000
    },
    {
      id: 'h3',
      query: 'Terminal Senador Canedo',
      placeName: 'Terminal Central, Senador Canedo',
      coordinates: { lat: -16.7065, lng: -49.0925 },
      timestamp: Date.now() - 172800000
    }
  ]);

  const [userRequiredFields, setUserRequiredFields] = useState<UserRequiredFieldsConfig>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_user_required_fields');
      if (saved) {
        return { ...DEFAULT_USER_REQUIRED_FIELDS, ...JSON.parse(saved) };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_USER_REQUIRED_FIELDS;
  });

  const updateUserRequiredFields = useCallback((config: Partial<UserRequiredFieldsConfig>) => {
    setUserRequiredFields(prev => {
      const next = { ...prev, ...config };
      try {
        localStorage.setItem('encomendaszap_user_required_fields', JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('encomendaszap_is_authenticated') === 'true'
        && !!localStorage.getItem('encomendaszap_logged_account');
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const isAuth = localStorage.getItem('encomendaszap_is_authenticated') === 'true';
      const customAvatar = localStorage.getItem('encomendaszap_user_avatar');
      if (isAuth) {
        const savedAccountStr = localStorage.getItem('encomendaszap_logged_account');
        if (savedAccountStr) {
          const acc = JSON.parse(savedAccountStr);
          return {
            ...DEFAULT_USER,
            id: acc.id || DEFAULT_USER.id,
            name: acc.name,
            phone: acc.phone,
            role: acc.roleLabel,
            userRole: acc.role,
            avatarUrl: customAvatar || acc.avatarUrl,
            vehicle: acc.vehicle,
            vehicleType: acc.vehicleType || (acc.role === 'motorista' ? 'moto' : undefined)
          };
        }
        return {
          ...DEFAULT_USER,
          name: 'Não Conectado',
          phone: '',
          role: 'Aguardando Login',
          userRole: 'atendente',
          avatarUrl: '/logo.svg'
        };
      }
    } catch (e) {
      // ignore
    }
    return {
      ...DEFAULT_USER,
      name: 'Não Conectado',
      phone: '',
      role: 'Aguardando Login',
      userRole: 'atendente',
      avatarUrl: '/logo.svg'
    };
  });

  const setCurrentRole = useCallback((newRole: UserRole) => {
    // Troca de perfil só é permitida a partir da conta real logada (admin geral)
    let loggedRole: UserRole | null = null;
    try {
      const loggedStr = localStorage.getItem('encomendaszap_logged_account');
      if (loggedStr) loggedRole = JSON.parse(loggedStr).role;
    } catch {}
    if (loggedRole !== 'admin_geral' && loggedRole !== newRole) return;
    setCurrentRoleState(newRole);
    try {
      localStorage.setItem('encomendaszap_user_role', newRole);
    } catch (e) {
      // ignore
    }
    setUser(prev => ({ ...prev, userRole: newRole }));
  }, []);

  const loginWithAccount = useCallback((account: AuthAccount) => {
    setIsAuthenticated(true);
    setCurrentRoleState(account.role);
    const finalAvatar = account.avatarUrl;
    setSelectedPlace(null);
    try {
      localStorage.removeItem('encomendaszap_user_avatar');
      localStorage.setItem('encomendaszap_user_role', account.role);
      localStorage.setItem('encomendaszap_is_authenticated', 'true');
      localStorage.setItem('encomendaszap_logged_account', JSON.stringify({ ...account, avatarUrl: finalAvatar }));
    } catch (e) {
      // ignore
    }
    setUser(prev => ({
      ...prev,
      id: account.id || '',
      name: account.name,
      phone: account.phone,
      role: account.roleLabel,
      userRole: account.role,
      avatarUrl: finalAvatar,
      vehicle: account.vehicle,
      vehicleType: account.vehicleType || (account.role === 'motorista' ? 'moto' : undefined)
    }));
    setIsLoginModalOpen(false);
    window.dispatchEvent(new Event('zap:refresh-orders'));
  }, []);

  const logout = useCallback(() => {
    // Logout é um comando explícito para encerrar a sessão persistida no serviço Java.
    backgroundGeolocationService.stopBackgroundTracking();
    setIsDriverOnline(false);
    setIsAuthenticated(false);
    setSelectedPlace(null);
    setAllPlaces([]);
    try {
      localStorage.removeItem('encomendaszap_all_places');
      localStorage.removeItem('encomendaszap_completed_marks');
      localStorage.removeItem('encomendaszap_is_authenticated');
      localStorage.removeItem('encomendaszap_logged_account');
      localStorage.removeItem('encomendaszap_user_avatar');
    } catch (e) {
      // ignore
    }
    setUser(prev => ({
      ...prev,
      id: '',
      vehicle: undefined,
      vehicleType: undefined,
      name: 'Não Conectado',
      phone: '',
      role: 'Aguardando Login',
      userRole: 'atendente',
      avatarUrl: '/logo.svg'
    }));
    setIsLoginModalOpen(true);
  }, [setIsDriverOnline]);

  /**
   * Permite que o motorista assuma/confirme um pedido público disponível.
   * Transforma o pedido em privado atribuído a este motorista.
   * A marker pública some imediatamente para todos os outros motoristas
   * e vira a marker normal da rota para este motorista que confirmou.
   */
  const { claimPublicOrder } = useClaimPublicOrder({ user, allPlaces, setAllPlaces, setSavedPlaces, setSelectedPlace });

  // Sincroniza sessão ativa e foto de perfil diretamente com o servidor central
  useEffect(() => {
    const isAuth = localStorage.getItem('encomendaszap_is_authenticated') === 'true';
    if (!isAuth) return;

    api.isLogged().then((res) => {
      if (res.success && res.logged && res.data) {
        const u = res.data;
        const mappedRole: UserRole = 
          u.access_level === 'admin' || u.access_level === 'admin_geral' ? 'admin_geral'
          : u.access_level === 'motorista' ? 'motorista'
          : u.access_level === 'terminal' ? 'terminal'
          : 'atendente';

        const rawPhoto = u.foto || u.avatarUrl || u.photo;
        const photoUrl = rawPhoto ? (formatPhotoUrl(rawPhoto) || rawPhoto) : null;
        setIsAuthenticated(true);
        setCurrentRoleState(mappedRole);
        setUser(prev => {
          const finalAvatar = photoUrl || prev.avatarUrl;
          if (photoUrl) {
            try {
              localStorage.setItem('encomendaszap_user_avatar', photoUrl);
            } catch {}
          }
          return {
            ...prev,
            name: u.name || prev.name,
            phone: u.phone || prev.phone,
            role: mappedRole === 'admin_geral' ? 'Administrador Geral' : mappedRole === 'motorista' ? 'Motorista Parceiro' : mappedRole === 'terminal' ? 'Operador de Terminal' : 'Atendente',
            userRole: mappedRole,
            avatarUrl: finalAvatar
          };
        });
        setIsLoginModalOpen(false);
      }
    }).catch(() => {});

    // Sincroniza foto e dados do usuário cadastrado no banco pelo telefone
    const cleanPhone = (user.phone || '').replace(/\D/g, '');
    if (cleanPhone) {
      api.listUsers({ search: cleanPhone, limit: 10 }).then(res => {
        if (res.success && res.data && res.data.length > 0) {
          const found = res.data.find(u => {
            const uPhone = (u.phone || '').replace(/\D/g, '');
            if (uPhone && cleanPhone) {
              return uPhone === cleanPhone || (cleanPhone.length >= 8 && uPhone.length >= 8 && (uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone)));
            }
            return false;
          });
          if (found && (found.foto || (found as any).avatarUrl)) {
            const rawPhoto = found.foto || (found as any).avatarUrl;
            const resolvedPhoto = formatPhotoUrl(rawPhoto) || rawPhoto;
            setUser(prev => ({
              ...prev,
              avatarUrl: resolvedPhoto
            }));
            try {
              localStorage.setItem('encomendaszap_user_avatar', resolvedPhoto);
              const loggedStr = localStorage.getItem('encomendaszap_logged_account');
              if (loggedStr) {
                const acc = JSON.parse(loggedStr);
                acc.avatarUrl = resolvedPhoto;
                localStorage.setItem('encomendaszap_logged_account', JSON.stringify(acc));
              }
            } catch {}
          }
        }
      }).catch(() => {});
    }
  }, [user.phone]);
const navigationState = useMapNavigation({ currentCoords, customers, mapInstance });
  const { activeRoute, setActiveRoute, hasRealGpsFix, setHasRealGpsFix, gpsAccuracy, setGpsAccuracy, userLocation, setUserLocation, isTrackingUser, setIsTrackingUser, watchIdRef, hasCenteredInitialRef, calculateRouteToPlace, calculateOrderRoute, clearActiveRoute } = navigationState;

  // Monitoramento contínuo em segundo plano (PWA com tela desligada)
  const [backgroundTrackingStatus, setBackgroundTrackingStatus] = useState<BackgroundTrackingStatus>(() => backgroundGeolocationService.getStatus());

  useEffect(() => {
    return backgroundGeolocationService.subscribe((status) => {
      setBackgroundTrackingStatus(status);
      if (status.lastPosition) {
        setUserLocation(status.lastPosition);
        setCurrentCoords(status.lastPosition);
        setHasRealGpsFix(true);
      }
    });
  }, []);

  const startBackgroundGps = useCallback(() => {
    if (currentRole === 'motorista') {
      const driverData: Driver = {
        id: String(user.id || 'driver-me'),
        name: user.name || 'Motorista Parceiro',
        nickname: user.name?.split(' ')[0] || 'Motorista',
        vehicleType: 'moto',
        vehicleModel: 'Moto / Veículo de Entrega',
        vehiclePlate: 'BRA-2025',
        color: getDriverPermanentColor(user.id || user.phone || user.name),
        coordinates: {
          lat: DEFAULT_COORDS.lat,
          lng: DEFAULT_COORDS.lng,
          timestamp: Date.now()
        },
        phone: user.phone || '',
        avatarUrl: user.avatarUrl,
        status: 'em_rota',
        isOnline: true
      };
      backgroundGeolocationService.startBackgroundTracking(driverData);
    }
  }, [currentRole, user]);

  const stopBackgroundGps = useCallback(() => {
    backgroundGeolocationService.stopBackgroundTracking();
  }, []);

  // 1. A WebView só ativa o serviço Java; GPS e POST não executam no navegador.
  useEffect(() => {
    if (currentRole !== 'motorista' || !isDriverOnline) {
      return;
    }

    const now = Date.now();
    const myDriverData: Driver = {
      id: String(user.id || 'driver-me'),
      name: user.name || 'Motorista Parceiro',
      nickname: user.name?.split(' ')[0] || 'Motorista',
      vehicleType: 'moto',
      vehicleModel: 'Moto / Veículo de Entrega',
      vehiclePlate: 'BRA-2025',
      color: getDriverPermanentColor(user.id || user.phone || user.name),
      coordinates: {
        lat: DEFAULT_COORDS.lat,
        lng: DEFAULT_COORDS.lng,
        timestamp: now
      },
      status: 'em_rota',
      phone: user.phone || '',
      avatarUrl: user.avatarUrl,
      isOnline: true
    };

    backgroundGeolocationService.startBackgroundTracking(myDriverData);
  }, [currentRole, isDriverOnline, user.id, user.name, user.phone, user.avatarUrl]);

  useOperationalServices(isAuthenticated);

  // 2. Recepção em Tempo Real para Administradores, Terminal e Atendentes
  useEffect(() => {
    if (currentRole === 'motorista') {
      setDrivers([]);
      return;
    }

    driverTrackingClient.connect();

    driverTrackingClient.fetchLiveDrivers().then((liveList) => {
      setDrivers(liveList.filter(d => !isDriverStale(d)).map(d => ({
        ...d,
        color: getDriverPermanentColor(d.id || d.phone || d.name)
      })));
    });

    const unsubInit = driverTrackingClient.onDriversInit((initList) => {
      setDrivers(initList.filter(d => !isDriverStale(d)).map(d => ({
        ...d,
        color: getDriverPermanentColor(d.id || d.phone || d.name)
      })));
    });

    const unsubUpdate = driverTrackingClient.onDriverUpdate((driver) => {
      if (isDriverStale(driver)) {
        setDrivers(prev => prev.filter(d => d.id !== driver.id));
        return;
      }
      const enrichedDriver: Driver = {
        ...driver,
        color: getDriverPermanentColor(driver.id || driver.phone || driver.name)
      };
      setDrivers(prev => {
        const index = prev.findIndex(d => d.id === enrichedDriver.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = enrichedDriver;
          return next;
        }
        return [...prev, enrichedDriver];
      });
    });

    const unsubRemove = driverTrackingClient.onDriverRemove((driverId) => {
      setDrivers(prev => prev.filter(d => d.id !== driverId));
    });

    // Regra: Motoristas sem atualização ou offline há > 30 minutos somem do mapa
    const purgeInterval = setInterval(() => {
      setDrivers(prev => {
        const filtered = prev.filter(d => !isDriverStale(d));
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 15000);

    return () => {
      unsubInit();
      unsubUpdate();
      unsubRemove();
      clearInterval(purgeInterval);
    };
  }, [currentRole]);

  const [defaultNavApp, setDefaultNavAppState] = useState<DefaultNavigationApp>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_default_navigation_app');
      if (saved === 'google_maps' || saved === 'waze') {
        return saved;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const setDefaultNavApp = useCallback((app: DefaultNavigationApp) => {
    setDefaultNavAppState(app);
    try {
      if (app) {
        localStorage.setItem('encomendaszap_default_navigation_app', app);
      } else {
        localStorage.removeItem('encomendaszap_default_navigation_app');
      }
    } catch {
      // ignore
    }
  }, []);

  const [gpsError, setGpsError] = useState<{
    type: 'permission_denied' | 'insecure_context' | 'iframe_blocked' | 'timeout' | 'unavailable';
    message: string;
    canOpenStandalone?: boolean;
  } | null>(null);

  const clearGpsError = useCallback(() => {
    setGpsError(null);
  }, []);

  // Helper resiliente para obter a melhor posição GPS sem travar em timeout no navegador normal ou publicado
  const { acquireBestPosition } = useAcquirePosition({ setGpsError, setHasRealGpsFix, setGpsAccuracy });

  // Rastreamento contínuo de GPS do dispositivo em tempo real
  useEffect(() => {
    if (!navigator.geolocation) return;

    let passiveWatchId: number | null = null;
    let highAccuracyMode = true;

    // Fix inicial resiliente diretamente do navegador nativo
    acquireBestPosition((coords) => {
      setHasRealGpsFix(true);
      setUserLocation(coords);
      setCurrentCoords(coords);
      saveLocationToStorage(coords, mapInstance ? mapInstance.getZoom() : 16);
      if (!hasCenteredInitialRef.current && mapInstance) {
        hasCenteredInitialRef.current = true;
        mapInstance.setView([coords.lat, coords.lng], 16, { animate: true });
      }
    });

    const startWatcher = (useHighAccuracy: boolean) => {
      try {
        if (passiveWatchId !== null) {
          navigator.geolocation.clearWatch(passiveWatchId);
        }
        passiveWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            setGpsError(null);
            setHasRealGpsFix(true);
            if (typeof pos.coords.accuracy === 'number') {
              setGpsAccuracy(Math.round(pos.coords.accuracy));
            }
            const liveCoords: LocationCoordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading ?? undefined,
              speed: pos.coords.speed ?? undefined,
              timestamp: pos.timestamp || Date.now()
            };
            setUserLocation(liveCoords);
            setCurrentCoords(liveCoords);
            if (!hasCenteredInitialRef.current && mapInstance) {
              hasCenteredInitialRef.current = true;
              mapInstance.setView([liveCoords.lat, liveCoords.lng], 16, { animate: true });
            }
          },
          (err) => {
            // Se falhar em alta precisão por timeout (3) ou indisponibilidade (2),
            // troca automaticamente para modo resiliente sem parar o rastreamento!
            if (highAccuracyMode && (err.code === 3 || err.code === 2)) {
              highAccuracyMode = false;
              startWatcher(false);
            } else if (err.code === 1) {
              const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
              setGpsError({
                type: isInIframe ? 'iframe_blocked' : 'permission_denied',
                message: isInIframe
                  ? 'Acesso ao GPS bloqueado pelo iframe. Adicione allow="geolocation" no iframe.'
                  : 'Permissão de localização negada.',
                canOpenStandalone: isInIframe
              });
            }
          },
          useHighAccuracy
            ? { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
            : { enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 }
        );
      } catch (e) {
        console.warn('Erro ao iniciar watchPosition passivo:', e);
      }
    };

    startWatcher(true);

    return () => {
      if (passiveWatchId !== null) {
        navigator.geolocation.clearWatch(passiveWatchId);
      }
    };
  }, [acquireBestPosition, mapInstance]);

  // Se as coordenadas reais do navegador chegarem antes do mapa estar pronto, centraliza assim que o mapa carregar
  useEffect(() => {
    if (mapInstance && userLocation && hasRealGpsFix && !hasCenteredInitialRef.current) {
      hasCenteredInitialRef.current = true;
      mapInstance.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
    }
  }, [mapInstance, userLocation, hasRealGpsFix]);

  // =========================================================================
  // GEOFENCING / PROXIMIDADE AUTOMÁTICA DE CHEGADA:
  // Ao chegar próximo (<= 75 metros) a uma marker de coleta, entrega ou troca,
  // já abre os dados e detalhes da encomenda automaticamente.
  // Se o entregador fechar o card, não abre de novo enquanto estiver em movimento
  // naquele local, só quando chegar perto de outro ou se afastar (> 180m) e voltar.
  // =========================================================================
  const dismissedProximityPlacesRef = useRef<Map<string, { dismissedAt: number; coords: { lat: number; lng: number } }>>(new Map());

  const dismissPlaceProximity = useCallback((placeId: string) => {
    const target = allPlaces.find(p => p.id === placeId);
    if (target) {
      dismissedProximityPlacesRef.current.set(placeId, {
        dismissedAt: Date.now(),
        coords: target.coordinates
      });
    } else if (selectedPlace && selectedPlace.id === placeId) {
      dismissedProximityPlacesRef.current.set(placeId, {
        dismissedAt: Date.now(),
        coords: selectedPlace.coordinates
      });
    }
  }, [allPlaces, selectedPlace]);

  useEffect(() => {
    if (!userLocation) return;

    const now = Date.now();
    const currentLoc = { lat: userLocation.lat, lng: userLocation.lng };

    // 1. Limpa locais dispensados se o entregador se afastou (> 180m) ou se passou o cooldown de 5 minutos
    dismissedProximityPlacesRef.current.forEach((data, placeId) => {
      const dist = getDistanceMeters(currentLoc, data.coords);
      const elapsed = now - data.dismissedAt;
      if (dist > 180 || elapsed > 5 * 60 * 1000) {
        dismissedProximityPlacesRef.current.delete(placeId);
      }
    });

    // Se já estiver com um local selecionado aberto ou modal de novo pedido, não interrompe
    if (selectedPlace || isNewOrderModalOpen) {
      return;
    }

    // 2. Busca markers ativas da sequência atual que não estejam concluídas
    const activePlaces = filterPlacesBySequence(allPlaces).filter(p => {
      if (p.orderStage === 'concluido' || (p.operationType as any) === 'concluido') {
        return false;
      }

      // Se foi dispensado recentemente e ainda está nas proximidades, não reabre
      if (dismissedProximityPlacesRef.current.has(p.id)) {
        return false;
      }

      // Se for perfil de motorista e o ponto foi atribuído a outro entregador, ignora
      if (currentRole === 'motorista') {
        const currentDriverId = 'usr-mot-04';
        if (p.assignedDriverId && p.assignedDriverId !== currentDriverId) {
          return false;
        }
      }

      return true;
    });

    if (activePlaces.length === 0) return;

    // 3. Encontra o ponto mais próximo dentro do raio de chegada (75 metros)
    let closestPlace: Place | null = null;
    let minDistance = Infinity;

    for (const place of activePlaces) {
      const dist = getDistanceMeters(currentLoc, place.coordinates);
      if (dist <= 75 && dist < minDistance) {
        minDistance = dist;
        closestPlace = place;
      }
    }

    // 4. Ao chegar pertinho (<= 75m):
    // Regra EncomendasZap solicitada:
    // - Se for entrega: abre a foto da coleta (ou entrega)
    // - Se for coleta: abre os detalhes
    // - Se for troca: abre os detalhes também
    if (closestPlace) {
      if (mapInstance) {
        mapInstance.flyTo([closestPlace.coordinates.lat, closestPlace.coordinates.lng], 17, {
          duration: 1.2,
          easeLinearity: 0.25
        });
      }

      if (closestPlace.operationType === 'entrega') {
        // Busca a foto da coleta ou da entrega
        let photoToOpen: string | null = closestPlace.photos?.[0] || closestPlace.imageUrl || null;
        if (!photoToOpen) {
          const siblingColeta = allPlaces.find(p => 
            p.id !== closestPlace!.id &&
            ((closestPlace!.orderCode && p.orderCode === closestPlace!.orderCode) ||
             (closestPlace!.id.match(/\d+/)?.[0] && p.id.startsWith(`pedido-${closestPlace!.id.match(/\d+/)?.[0]}-`))) &&
            (p.imageUrl || p.photos?.length)
          );
          photoToOpen = siblingColeta?.photos?.[0] || siblingColeta?.imageUrl || null;
        }

        if (!photoToOpen) {
          try {
            const numericId = closestPlace.id.match(/\d+/)?.[0];
            const cachedColeta = numericId ? localStorage.getItem(`encomendaszap_photos_pedido-${numericId}-coleta`) : null;
            const cachedSelf = localStorage.getItem(`encomendaszap_photos_${closestPlace.id}`);
            const raw = cachedColeta || cachedSelf;
            if (raw) {
              const parsed = JSON.parse(raw);
              photoToOpen = Array.isArray(parsed) ? parsed[0] : parsed;
            }
          } catch {}
        }

        setSelectedPlace(closestPlace);
        if (photoToOpen) {
          openPhotoViewer(photoToOpen, closestPlace);
        }
      } else {
        // Se for coleta ou se for troca: abre os detalhes
        closePhotoViewer();
        setSelectedPlace(closestPlace);
      }
    }
  }, [userLocation, allPlaces, selectedPlace, isNewOrderModalOpen, currentRole, mapInstance, openPhotoViewer, closePhotoViewer]);

  const flyToLocation = useCallback((coords: LocationCoordinates, zoom: number = 16) => {
    setCurrentCoords(coords);
    saveLocationToStorage(coords, zoom);
    if (mapInstance) {
      mapInstance.flyTo([coords.lat, coords.lng], zoom, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [mapInstance]);

  const { addOrderDraft, saveNewOrder, addNewOrder } = useOrderCreation({ currentRole, user, setAllPlaces, setSelectedPlace, flyToLocation, updatePlaceDetails, orderMutationVersion, setSavedPlaces, setCustomers, pendingOrderCreations });

  // Dá baixa em um ponto (coleta, troca ou entrega) e avança para a próxima etapa conforme as regras do EncomendasZap
  const { performCompletePlaceWaypoint } = useOrderCompletion({ selectedPlace, allPlaces, savedPlaces, orderMutationVersion, user, currentCoords, setCompletedWaypointMarks, setAllPlaces, setSavedPlaces, setSelectedPlace, setViewingPhotoPlace, setViewingPhotoUrl, flyToLocation });

  const completePlaceWaypoint = useCallback(
    (placeId: string, receiverName?: string, notes?: string, proximity?: BaixaProximity, pickupPhotos?: string[]) =>
      runOncePerKey(pendingWaypointCompletions.current, getBaseOrderId(resolvePlaceId(placeId)), () =>
        performCompletePlaceWaypoint(placeId, receiverName, notes, proximity, pickupPhotos)),
    [performCompletePlaceWaypoint, resolvePlaceId]
  );

  // Reinicia / sincroniza as encomendas ativas diretamente do servidor
  const resetWorkflowToColetas = useCallback(() => {
    setCompletedWaypointMarks([]);
    try {
      localStorage.setItem('encomendaszap_completed_marks', JSON.stringify([]));
    } catch (e) {}
    setSelectedPlace(null);
    refreshServerData();
  }, [refreshServerData]);

  // Admin/atendente desfaz a baixa: o pedido volta ao estado anterior e a marca de concluído some
  const revertCompletedMark = useCallback(async (markId: string): Promise<boolean> => {
    const mark = completedWaypointMarks.find(m => m.id === markId);
    if (!mark) return false;
    const pedidoId = mark.orderId.match(/pedido-(\d+)/)?.[1] || mark.orderCode?.match(/(\d+)/)?.[1] || mark.orderId.match(/\d+/)?.[0];
    if (!pedidoId) return false;
    const res: any = await api.reverterBaixa(pedidoId, mark.operationType);
    if (!res?.success) {
      console.warn('[Reverter baixa]', res?.message);
      return false;
    }
    setCompletedWaypointMarks(prev => {
      const next = prev.filter(m => !(
        (m.orderId.match(/pedido-(\d+)/)?.[1] || m.orderId) === pedidoId && m.operationType === mark.operationType
      ));
      try {
        localStorage.setItem('encomendaszap_completed_marks', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    refreshServerData();
    return true;
  }, [completedWaypointMarks, refreshServerData]);

  const stopUserTracking = useCallback(() => {
    setIsTrackingUser(false);
    setIsLocating(false);
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const toggleUserTracking = useCallback(() => {
    if (isTrackingUser) {
      stopUserTracking();
      return;
    }

    setIsLocating(true);
    setIsTrackingUser(true);

    const trackingZoom = 18;

    // Se já tiver coordenadas reais confirmadas do navegador, voa até elas
    if (userLocation && hasRealGpsFix) {
      flyToLocation(userLocation, trackingZoom);
    }

    acquireBestPosition(
      (coords) => {
        setHasRealGpsFix(true);
        setUserLocation(coords);
        setCurrentCoords(coords);
        flyToLocation(coords, trackingZoom);
        saveLocationToStorage(coords, trackingZoom);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        if (userLocation && hasRealGpsFix) {
          flyToLocation(userLocation, trackingZoom);
        }
      }
    );

    // Clear any prior watcher
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Set up continuous watch with automatic degradation from high to low accuracy on error
    let activeHighAccuracy = true;
    const startActiveWatcher = (highAccuracy: boolean) => {
      try {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const liveCoords: LocationCoordinates = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp || Date.now()
            };
            setUserLocation(liveCoords);
            setCurrentCoords(liveCoords);
            saveLocationToStorage(liveCoords, mapInstance ? mapInstance.getZoom() : trackingZoom);
            setIsLocating(false);
            setGpsError(null);
          },
          (error) => {
            console.warn('Active geolocation tracking notice:', error);
            if (activeHighAccuracy && (error.code === 3 || error.code === 2)) {
              activeHighAccuracy = false;
              startActiveWatcher(false);
            }
          },
          highAccuracy
            ? { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
            : { enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 }
        );
      } catch (e) {
        console.warn('Erro ao configurar watcher ativo:', e);
      }
    };

    startActiveWatcher(true);
  }, [isTrackingUser, userLocation, stopUserTracking, flyToLocation, mapInstance, acquireBestPosition]);

  const locateUser = useCallback(() => {
    toggleUserTracking();
  }, [toggleUserTracking]);

  // Foco imediato na localização atual do motorista (moto) com zoom 17 e retomada do seguimento GPS
  const focusDriverLocation = useCallback(() => {
    const targetCoords = (userLocation && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && userLocation.lat !== 0)
      ? userLocation
      : (currentCoords && typeof currentCoords.lat === 'number' && !isNaN(currentCoords.lat) && currentCoords.lat !== 0)
      ? currentCoords
      : DEFAULT_COORDS;

    const targetZoom = 17;

    // 1. Garante que o rastreamento está ativo
    if (!isTrackingUser) {
      toggleUserTracking();
    }

    // 2. Dispara evento para o FullscreenMap limpar qualquer trava de arrasto manual
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zap:focus-driver', {
        detail: { coords: targetCoords, zoom: targetZoom }
      }));
    }

    // 3. Centraliza a câmera no mapa
    if (mapInstance && targetCoords) {
      mapInstance.flyTo([targetCoords.lat, targetCoords.lng], targetZoom, {
        duration: 1.0,
        easeLinearity: 0.25
      });
    } else if (targetCoords) {
      flyToLocation(targetCoords, targetZoom);
    }

    // 4. Solicita fix GPS de alta precisão
    acquireBestPosition(
      (coords) => {
        setUserLocation(coords);
        setCurrentCoords(coords);
        setHasRealGpsFix(true);
        if (mapInstance) {
          mapInstance.flyTo([coords.lat, coords.lng], targetZoom, {
            duration: 1.0,
            easeLinearity: 0.25
          });
        }
      },
      (err) => {
        console.warn('Focus driver GPS acquisition warning:', err);
      }
    );
  }, [isTrackingUser, userLocation, currentCoords, mapInstance, flyToLocation, toggleUserTracking, acquireBestPosition]);

  const viewAllMarkers = useCallback(() => {
    if (!mapInstance) return;

    // Se estiver seguindo a posição GPS, desativa para manter a visualização em todas as makers
    stopUserTracking();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zap:manual-pan'));
    }

    // Agrupa todas as makers ativas (allPlaces + savedPlaces)
    const placesMap = new Map<string, Place>();
    (savedPlaces || []).filter(p => !p.id.startsWith('pedido-')).forEach(p => placesMap.set(p.id, p));
    (allPlaces || []).forEach(p => placesMap.set(p.id, p));

    // Filtra marcadores válidos e não concluídos
    const rawValidPlaces = Array.from(placesMap.values()).filter(p => 
      p.orderStage !== 'concluido' &&
      (p.operationType as any) !== 'concluido' &&
      p.coordinates &&
      typeof p.coordinates.lat === 'number' &&
      typeof p.coordinates.lng === 'number' &&
      !isNaN(p.coordinates.lat) &&
      !isNaN(p.coordinates.lng) &&
      p.coordinates.lat !== 0 &&
      p.coordinates.lng !== 0
    );

    // 1. SE FOR MOTORISTA:
    // "tem que visualizar a moto e as makers, apenas da cidade em que o motorista estiver.
    // Se estiver em Goiânia, visualiza só em Goiânia; se estiver em Anápolis, visualiza só em Anápolis."
    if (currentRole === 'motorista') {
      const driverPos = (userLocation && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && userLocation.lat !== 0)
        ? userLocation
        : currentCoords;
      const driverCity = getDriverCurrentCity(driverPos, user);

      // Filtra makers apenas da cidade atual do motorista atribuídas ou visíveis
      const cityPlaces = rawValidPlaces.filter(p => {
        if (!isPlaceInCity(p, driverCity)) return false;
        return realtimeAssignmentService.isPlaceAssignedToUser(p, user);
      });

      const points: Array<{ lat: number; lng: number }> = [];
      if (driverPos && typeof driverPos.lat === 'number' && !isNaN(driverPos.lat) && driverPos.lat !== 0) {
        points.push(driverPos);
      }
      cityPlaces.forEach(p => points.push(p.coordinates));

      if (points.length === 0) {
        const fallbackCenter = KNOWN_CITIES.find(c => c.name === driverCity)?.center || DEFAULT_COORDS;
        mapInstance.flyTo([fallbackCenter.lat, fallbackCenter.lng], 15, { animate: true, duration: 1.2 });
        return;
      }

      if (points.length === 1) {
        mapInstance.flyTo([points[0].lat, points[0].lng], 16, { animate: true, duration: 1.2 });
        return;
      }

      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      if (minLat === maxLat && minLng === maxLng) {
        mapInstance.flyTo([minLat, minLng], 16, { animate: true, duration: 1.2 });
      } else {
        mapInstance.fitBounds(
          [
            [minLat, minLng],
            [maxLat, maxLng]
          ],
          {
            padding: [75, 75],
            maxZoom: 16,
            animate: true,
            duration: 1.2
          }
        );
      }
      return;
    }

    // 2. SE FOR ADMIN / ATENDENTE / TERMINAL:
    // "Na administração, deve visualizar tudo, inclusive as motos que estiverem rodando.
    // Quando clicar, deve abrir e mostrar tudo, com as motos também."
    const activeRunningMotos = (drivers || []).filter(d => 
      d.status !== 'offline' &&
      !isDriverStale(d) &&
      d.coordinates &&
      typeof d.coordinates.lat === 'number' &&
      typeof d.coordinates.lng === 'number' &&
      !isNaN(d.coordinates.lat) &&
      !isNaN(d.coordinates.lng) &&
      d.coordinates.lat !== 0 &&
      d.coordinates.lng !== 0
    );

    const points: Array<{ lat: number; lng: number }> = [
      ...rawValidPlaces.map(p => p.coordinates),
      ...activeRunningMotos.map(d => d.coordinates)
    ];

    if (points.length === 0) {
      if (userLocation) {
        mapInstance.flyTo([userLocation.lat, userLocation.lng], 15, { animate: true, duration: 1 });
      } else if (currentCoords) {
        mapInstance.flyTo([currentCoords.lat, currentCoords.lng], 14, { animate: true, duration: 1 });
      }
      return;
    }

    if (points.length === 1) {
      mapInstance.flyTo([points[0].lat, points[0].lng], 16, { animate: true, duration: 1.2 });
      return;
    }

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (minLat === maxLat && minLng === maxLng) {
      mapInstance.flyTo([minLat, minLng], 16, { animate: true, duration: 1.2 });
    } else {
      mapInstance.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng]
        ],
        {
          padding: [75, 75],
          maxZoom: 16,
          animate: true,
          duration: 1.2
        }
      );
    }
  }, [mapInstance, allPlaces, savedPlaces, drivers, currentRole, userLocation, currentCoords, user, stopUserTracking]);

  const retryGps = useCallback(() => {
    setGpsError(null);
    setIsLocating(true);
    acquireBestPosition(
      (coords) => {
        setUserLocation(coords);
        setCurrentCoords(coords);
        flyToLocation(coords, 18);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      }
    );
  }, [acquireBestPosition, flyToLocation]);

  const addToHistory = useCallback((item: { query: string; placeName?: string; coordinates?: LocationCoordinates }) => {
    recordPlaceUsage({
      id: `hist-${Date.now()}`,
      name: item.query,
      address: item.placeName || item.query,
      coordinates: item.coordinates || { lat: -16.6869, lng: -49.2648 }
    });

    setSearchHistory(prev => [
      {
        id: `hist-${Date.now()}`,
        query: item.query,
        placeName: item.placeName,
        coordinates: item.coordinates,
        timestamp: Date.now()
      },
      ...prev.filter(h => h.query.toLowerCase() !== item.query.toLowerCase()).slice(0, 19)
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  const toggleSavePlace = useCallback((place: Place) => {
    setSavedPlaces(prev => {
      const exists = prev.some(p => p.id === place.id);
      if (exists) {
        return prev.filter(p => p.id !== place.id);
      } else {
        return [...prev, place];
      }
    });
  }, []);

  const isPlaceSaved = useCallback((placeId: string) => {
    return savedPlaces.some(p => p.id === placeId);
  }, [savedPlaces]);

  const deletePlace = useCallback(async (placeId: string): Promise<boolean> => {
    if (currentRole === 'motorista') {
      console.warn('[MapContext.deletePlace] Motoristas não possuem permissão para excluir pedidos.');
      return false;
    }

    const baseKey = getOrderKey({ id: placeId });
    const cleanId = cleanOrderId(placeId) || placeId.replace(/\D/g, '');
    const isTarget = (p: { id: string; orderCode?: string }) => {
      if (!p || !p.id) return false;
      if (p.id === placeId) return true;
      if (getOrderKey(p) === baseKey) return true;
      const num = cleanOrderId(p.id) || (p.orderCode ? p.orderCode.replace(/\D/g, '') : '');
      if (cleanId && num && cleanId === num) return true;
      return false;
    };

    // Pedidos que nunca chegaram ao servidor (id local) só precisam sair do cache local
    const isServerOrder = /\d/.test(placeId) && !isTemporaryOrderId(placeId);
    if (isServerOrder) {
      try {
        const res = await api.deletePedido(cleanId || placeId);
        if (res && res.success === false && res.message?.toLowerCase().includes('permissão')) {
          console.warn('[MapContext.deletePlace] Servidor recusou a exclusão:', res?.message);
          return false;
        }
      } catch (err) {
        console.warn('[MapContext.deletePlace] Erro ao excluir pedido na API:', err);
      }
    }

    orderMutationVersion.current += 1;

    setAllPlaces(prev => {
      const next = prev.filter(p => !isTarget(p));
      scheduleStorageSave('encomendaszap_all_places', next);
      return next;
    });

    setSavedPlaces(prev => {
      const next = prev.filter(p => !isTarget(p));
      scheduleStorageSave('encomendaszap_saved_places', next);
      return next;
    });

    setCompletedOrders(prev => {
      const next = prev.filter(p => !isTarget(p));
      scheduleStorageSave('encomendaszap_completed_orders', next);
      return next;
    });

    setCompletedWaypointMarks(prev => {
      const next = prev.filter(m => !m.orderId || !isTarget({ id: m.orderId, orderCode: m.orderCode }));
      scheduleStorageSave('encomendaszap_completed_marks', next);
      return next;
    });

    setSelectedPlace(prev => (prev && isTarget(prev) ? null : prev));

    try {
      realtimeAssignmentService.unassignOrder(placeId);
      if (cleanId) {
        realtimeAssignmentService.unassignOrder(cleanId);
        realtimeAssignmentService.unassignOrder(`pedido-${cleanId}`);
      }
    } catch {}

    return true;
  }, [currentRole]);

  const updateUser = useCallback((updated: Partial<UserProfile>) => {
    setUser(prev => {
      const next = { ...prev, ...updated };
      if (updated.avatarUrl) {
        try {
          if (!updated.avatarUrl.startsWith('data:') || updated.avatarUrl.length < 100000) {
            localStorage.setItem('encomendaszap_user_avatar', updated.avatarUrl);
            const loggedStr = localStorage.getItem('encomendaszap_logged_account');
            if (loggedStr) {
              const acc = JSON.parse(loggedStr);
              acc.avatarUrl = updated.avatarUrl;
              localStorage.setItem('encomendaszap_logged_account', JSON.stringify(acc));
            }
          }
        } catch {}
      }
      return next;
    });
  }, []);

  const sessionValue = useMemo(() => ({ user, updateUser, currentRole, setCurrentRole, isAuthenticated, loginWithAccount, logout, isDriverOnline, setIsDriverOnline, driverActiveSeconds, userRequiredFields, updateUserRequiredFields }), [user, updateUser, currentRole, setCurrentRole, isAuthenticated, loginWithAccount, logout, isDriverOnline, setIsDriverOnline, driverActiveSeconds, userRequiredFields, updateUserRequiredFields]);
  const dataValue = useMemo(() => ({ allPlaces, savedPlaces, completedOrders, completedWaypointMarks, customers, drivers, selectedPlace, setSelectedPlace, selectedDriver, setSelectedDriver, addCustomer, persistCustomer, updateCustomer, deleteCustomer, addNewOrder, addOrderDraft, updatePlaceDetails, assignPlaceToDriver, claimPublicOrder, deletePlace, toggleSavePlace, isPlaceSaved, completePlaceWaypoint, revertCompletedMark }), [allPlaces, savedPlaces, completedOrders, completedWaypointMarks, customers, drivers, selectedPlace, setSelectedPlace, selectedDriver, setSelectedDriver, addCustomer, persistCustomer, updateCustomer, deleteCustomer, addNewOrder, addOrderDraft, updatePlaceDetails, assignPlaceToDriver, claimPublicOrder, deletePlace, toggleSavePlace, isPlaceSaved, completePlaceWaypoint, revertCompletedMark]);
  const navigationValue = useMemo(() => ({ mapInstance, setMapInstance, currentCoords, mapLayer, setMapLayer, mapTheme, setMapTheme, activeRoute, setActiveRoute, calculateRouteToPlace, calculateOrderRoute, clearActiveRoute, userLocation, isTrackingUser, hasRealGpsFix, gpsAccuracy, gpsError, clearGpsError, retryGps, flyToLocation, locateUser, focusDriverLocation, viewAllMarkers, isLocating, toggleUserTracking, stopUserTracking, dismissPlaceProximity, defaultNavApp, setDefaultNavApp }), [mapInstance, setMapInstance, currentCoords, mapLayer, setMapLayer, mapTheme, setMapTheme, activeRoute, setActiveRoute, calculateRouteToPlace, calculateOrderRoute, clearActiveRoute, userLocation, isTrackingUser, hasRealGpsFix, gpsAccuracy, gpsError, clearGpsError, retryGps, flyToLocation, locateUser, focusDriverLocation, viewAllMarkers, isLocating, toggleUserTracking, stopUserTracking, dismissPlaceProximity, defaultNavApp, setDefaultNavApp]);
  return (
    <MapUiContext.Provider value={uiState}>
    <MapSessionContext.Provider value={sessionValue}>
    <MapDataContext.Provider value={dataValue}>
    <MapNavigationContext.Provider value={navigationValue}>
    <MapContext.Provider
      value={{
        mapInstance,
        setMapInstance,
        currentCoords,
        selectedPlace,
        setSelectedPlace,
        mapLayer,
        setMapLayer,
        mapTheme,
        setMapTheme,
        showTraffic,
        setShowTraffic,
        isSidebarOpen,
        setIsSidebarOpen,
        isProfileOpen,
        setIsProfileOpen,
        isLoginModalOpen,
        setIsLoginModalOpen,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        isAdminSettingsOpen,
        setIsAdminSettingsOpen,
        isAdminUsersOpen,
        setIsAdminUsersOpen,
        adminUsersRoleFilter,
        setAdminUsersRoleFilter,
        isCustomerListOpen,
        setIsCustomerListOpen,
        openCustomerList,
        closeCustomerList,
        isOrdersModalOpen,
        routeSelectMode,
        routeSelectedIds,
        startRouteSelection,
        cancelRouteSelection,
        toggleRouteSelection,
        isRoutePickerOpen,
        setIsRoutePickerOpen,
        setIsOrdersModalOpen,
        openOrdersModal,
        closeOrdersModal,
        isFinancialModalOpen,
        setIsFinancialModalOpen,
        financialInitialTab,
        openFinancialModal,
        closeFinancialModal,
        dateRangeFilter,
        setDateRangeFilter,
        clearDateRangeFilter,
        isCalendarModalOpen,
        setIsCalendarModalOpen,
        openCalendarModal,
        closeCalendarModal,
        isNewOrderModalOpen,
        setIsNewOrderModalOpen,
        newOrderInitialPlace,
        openNewOrderForm,
        addOrderDraft,
        addNewOrder,
        viewingPhotoUrl,
        setViewingPhotoUrl,
        viewingPhotoPlace,
        setViewingPhotoPlace,
        openPhotoViewer,
        closePhotoViewer,
        isDriverOnline,
        setIsDriverOnline,
        driverActiveSeconds,
        currentRole,
        setCurrentRole,
        isAuthenticated,
        loginWithAccount,
        logout,
        searchQuery,
        setSearchQuery,
        searchHistory,
        addToHistory,
        clearHistory,
        activeRoute,
        setActiveRoute,
        calculateRouteToPlace,
        calculateOrderRoute,
        clearActiveRoute,
        defaultNavApp,
        setDefaultNavApp,
        user,
        updateUser,
        userRequiredFields,
        updateUserRequiredFields,
        savedPlaces,
        allPlaces,
        completedOrders,
        completedWaypointMarks,
        revertCompletedMark,
        completePlaceWaypoint,
        resetWorkflowToColetas,
        updatePlaceDetails,
        customers,
        addCustomer,
        persistCustomer,
        updateCustomer,
        deleteCustomer,
        customerLocationModalData,
        openCustomerLocationModal,
        closeCustomerLocationModal,
        assignPlaceToDriver,
        claimPublicOrder,
        toggleSavePlace,
        isPlaceSaved,
        deletePlace,
        drivers,
        selectedDriver,
        setSelectedDriver,
        vehicleFilter,
        setVehicleFilter,
        operationFilter,
        setOperationFilter,
        operationsFilter,
        toggleOperationFilter,
        setAllOperationsFilter,
        flyToLocation,
        locateUser,
        focusDriverLocation,
        viewAllMarkers,
        isLocating,
        userLocation,
        isTrackingUser,
        toggleUserTracking,
        stopUserTracking,
        dismissPlaceProximity,
        hasRealGpsFix,
        gpsAccuracy,
        gpsError,
        clearGpsError,
        retryGps,

        // Integração com Servidor Express
        serverStatus,
        serverMessage,
        serverLatencyMs,
        apiBaseUrl: apiBaseUrlState,
        updateApiBaseUrl,
        refreshServerData,
        isSyncingServer,

        // Monitoramento em Segundo Plano (PWA com tela desligada)
        backgroundTrackingStatus,
        startBackgroundGps,
        stopBackgroundGps
      }}
    >
      {children}
    </MapContext.Provider>
    </MapNavigationContext.Provider>
    </MapDataContext.Provider>
    </MapSessionContext.Provider>
    </MapUiContext.Provider>
  );
};
