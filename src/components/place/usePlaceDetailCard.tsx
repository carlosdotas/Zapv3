import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { UserCheck, ArrowDownToLine, Package, Repeat, Camera, Zap, FileText, Layers, Bike, Car, Truck, ShoppingBag, Mail, Edit3, Globe, Lock } from 'lucide-react';
import { useMapStore } from '../../context/MapContext';
import { isStreetOrAddress } from '../../utils/placeUtils';
import { androidBridge } from '../../services/androidBridge';
import type { BaixaProximity } from '../../services/apiTypes';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { setNavSession } from '../../services/presenceService';
import { openExternalNavigation } from '../map/NavAppIcons';
import { Place, OperationType, PackageItemType, VehicleCollectionType } from '../../types/map';
import { Customer, AgendaContact, TargetFieldType } from '../../types/customer';
import { getPlaceDateBadgeInfo } from '../map/mapMarkers';
import { isCustomerMissingLocation, getOrderLocationsForOperation, isUnnamedOrGenericPlace } from '../../utils/customerLocationUtils';
import { extractNumericId } from '../../utils/orderSequence';
import { isTemporaryOrderId } from '../../utils/orderIds';
import { calculateDistanceKm } from '../../utils/geoUtils';
import { getSuggestedOrderPlaceName } from '../../utils/orderPlaceName';
import { resolveOrderLocationsForSave } from '../../utils/orderDefaultLocation';
import { persistOrderPhoto } from '../../services/orderPhotoService';
import { api } from '../../services/api';
import { settingsService } from '../../services/settingsService';
import { placeService } from '../../services/placeService';
import { formatPhotoUrl, extractPhotoUrls, extractDriverAssignmentFromPedido } from '../../services/apiAdapters';
import { LIMITE_BAIXA_DISTANTE_M, formatPhoneDisplay, getClosingTime, getOpeningTime, getTimeUntilClosing, formatDistance } from './placeDetailHelpers';

export function usePlaceDetailCard() {

  const { 
    selectedPlace, 
    setSelectedPlace, 
    flyToLocation,
    calculateRouteToPlace,
    calculateOrderRoute,
    clearActiveRoute,
    defaultNavApp,
    setDefaultNavApp,
    userLocation,
    currentCoords,
    activeRoute,
    currentRole,
    assignPlaceToDriver,
    drivers,
    updatePlaceDetails,
    addNewOrder,
    persistCustomer,
    viewingPhotoUrl,
    setViewingPhotoUrl,
    openPhotoViewer,
    savedPlaces,
    allPlaces,
    completePlaceWaypoint,
    dismissPlaceProximity,
    user,
    customers,
    openCustomerLocationModal,
    operationsFilter,
    claimPublicOrder
  } = useMapStore();

  const canManageDriverAssignment = currentRole === 'admin_geral' || currentRole === 'atendente' || (currentRole as string) === 'admin';
  const isDriverRole = currentRole === 'motorista';

  // Estados para recusa/cancelamento por parte do motorista
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalReason, setRefusalReason] = useState<string>('');
  const [refusalNotes, setRefusalNotes] = useState<string>('');
  const [isSubmittingRefusal, setIsSubmittingRefusal] = useState(false);
  const [isClaimingOrder, setIsClaimingOrder] = useState(false);

  const handleClaimThisOrder = async () => {
    if (!selectedPlace) return;
    setIsClaimingOrder(true);
    try {
      const won = await claimPublicOrder(selectedPlace.id);
      if (!won) {
        setSaveSuccessToast('Este pedido já foi aceito por outro motorista.');
        setSelectedPlace(null);
        return;
      }
      setSaveSuccessToast('🎉 Pedido aceito com sucesso! Você é o responsável.');
      if (typeof window !== 'undefined' && (window as any).AndroidApp) {
        (window as any).AndroidApp.showNotification?.("EncomendasZap", "Pedido assumido com sucesso!");
        (window as any).AndroidApp.vibrate?.(250);
      }
    } catch (err) {
      console.warn('Erro ao assumir pedido:', err);
      setSaveSuccessToast(err instanceof Error ? err.message : 'Não foi possível aceitar o pedido.');
    } finally {
      setIsClaimingOrder(false);
    }
  };

  // Outras encomendas no mesmo local
  const siblingPlaces = useMemo(() => {
    if (!selectedPlace || !allPlaces) return [];
    return allPlaces.filter(p => 
      p.id !== selectedPlace.id && (
        (p.name && selectedPlace.name && p.name.trim().toLowerCase() === selectedPlace.name.trim().toLowerCase()) ||
        (Math.abs(p.coordinates.lat - selectedPlace.coordinates.lat) < 0.0003 && Math.abs(p.coordinates.lng - selectedPlace.coordinates.lng) < 0.0003)
      )
    );
  }, [selectedPlace, allPlaces]);

  // Verifica se o cliente está sem localização cadastrada
  const customerMissingLocation = useMemo(() => {
    return isCustomerMissingLocation(selectedPlace, customers);
  }, [selectedPlace, customers]);

  // Resolução exata de locais de acordo com o tipo de operação (coleta, entrega, troca)
  const orderResolvedLocations = useMemo(() => {
    if (!selectedPlace) return null;
    const op = selectedPlace.operationType || 'coleta';
    return getOrderLocationsForOperation(selectedPlace, op, customers);
  }, [selectedPlace, customers]);

  // Se cliente não tiver local, limpa a rota ativa
  useEffect(() => {
    if (customerMissingLocation) {
      clearActiveRoute();
    }
  }, [customerMissingLocation, clearActiveRoute]);

  const [isTracingRoute, setIsTracingRoute] = useState(false);
  const handleTraceOrderRoute = async () => {
    if (!selectedPlace) return;
    if (customerMissingLocation || !orderResolvedLocations?.canTraceRoute) {
      clearActiveRoute();
      return;
    }
    setIsTracingRoute(true);
    await calculateOrderRoute(selectedPlace);
    setIsTracingRoute(false);
  };

  // Verifica se a encomenda já está salva/adicionada no mapa
  const isAlreadySaved = useMemo(() => {
    if (!selectedPlace) return false;
    if (isTemporaryOrderId(selectedPlace.id)) return false;

    // Está salva se já for um pedido persistido ou estiver presente na lista de locais ativos/salvos do mapa
    if (selectedPlace.id && /^pedido-\d+(?:-(?:coleta|entrega|troca|retorno))?$/i.test(selectedPlace.id)) return true;
    if (allPlaces?.some(p => p.id === selectedPlace.id)) return true;
    if (savedPlaces?.some(p => p.id === selectedPlace.id)) return true;

    const selNum = extractNumericId(selectedPlace.id) || extractNumericId(selectedPlace.orderCode);
    if (selNum) {
      if (allPlaces?.some(p => {
        const pNum = extractNumericId(p.id) || extractNumericId(p.orderCode);
        return pNum && pNum === selNum;
      })) return true;
      if (savedPlaces?.some(p => {
        const pNum = extractNumericId(p.id) || extractNumericId(p.orderCode);
        return pNum && pNum === selNum;
      })) return true;
    }

    return false;
  }, [selectedPlace, allPlaces, savedPlaces]);

  // Modo de edição manual: quando a marker for adicionada/salva, só aceita editar se clicar no botão "Editar"
  // Regra de segurança: Motoristas NÃO possuem permissão para adicionar nem editar pedidos
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const canEdit = !isDriverRole && (!isAlreadySaved || isEditingOrder);
  const isNewOrderDraft = isTemporaryOrderId(selectedPlace?.id);

  const handleLockedEditAttempt = useCallback(() => {
    if (isDriverRole) {
      setSaveSuccessToast('🔒 Motoristas não possuem permissão para adicionar ou editar pedidos.');
    } else {
      setIsEditingOrder(true);
    }
  }, [isDriverRole]);

  // Reseta modo de edição e menus quando o pedido mudar
  useLayoutEffect(() => {
    setIsEditingOrder(!isDriverRole && isNewOrderDraft);
    setIsActionsMenuOpen(false);
    setShowNavChooser(false);
  }, [selectedPlace?.id, isDriverRole, isNewOrderDraft]);

  // Estados para seleção e cadastro de clientes e responsáveis
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [selectorTargetField, setSelectorTargetField] = useState<TargetFieldType>('customer');
  const [isCustomerRegistrationOpen, setIsCustomerRegistrationOpen] = useState(false);
  const [registrationInitialData, setRegistrationInitialData] = useState<Partial<Customer> | AgendaContact | null>(null);

  // Estado para o formulário direto de Vendedor (Responsável) com Nome, Telefone e Agenda
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [routeSellerTarget, setRouteSellerTarget] = useState<'pickup' | 'exchange' | 'delivery' | null>(null);

  const handleSaveSellerResponsible = (data: { name: string; phone: string }) => {
    if (!selectedPlace) return;
    const target = routeSellerTarget ||
      (selectedPlace.operationType === 'troca' ? 'exchange' : selectedPlace.operationType === 'entrega' ? 'delivery' : 'pickup');
    const targetOperation = target === 'pickup' ? 'coleta' : target === 'exchange' ? 'troca' : 'entrega';
    const activeContact = selectedPlace.operationType === targetOperation
      ? {
          responsibleName: data.name,
          responsiblePhone: data.phone,
          sellerName: data.name,
          sellerPhone: data.phone,
          managerName: data.name,
          managerPhone: data.phone
        }
      : {};

    if (target === 'pickup') {
      updatePlaceDetails(selectedPlace.id, {
        ...activeContact,
        pickupSellerName: data.name,
        pickupSellerPhone: data.phone
      });
      return;
    }
    if (target === 'exchange') {
      updatePlaceDetails(selectedPlace.id, {
        ...activeContact,
        exchangeSellerName: data.name,
        exchangeSellerPhone: data.phone
      });
      return;
    }
    updatePlaceDetails(selectedPlace.id, {
      ...activeContact,
      deliverySellerName: data.name,
      deliverySellerPhone: data.phone
    });
  };

  // Estados para direcionamento de motorista
  const [isDriverSelectorOpen, setIsDriverSelectorOpen] = useState(false);
  const [routeDriverTarget, setRouteDriverTarget] = useState<'pickup' | 'exchange' | 'delivery' | null>(null);
  const [driverToast, setDriverToast] = useState<string | null>(null);
  const hasCustomerRoute = Boolean(orderResolvedLocations?.canTraceRoute && !customerMissingLocation);

  // Define manualmente o outro ponto da rota (o local padrão só entra ao salvar sem local definido)
  const [isCounterpartPickerOpen, setIsCounterpartPickerOpen] = useState(false);
  const [counterpartQuery, setCounterpartQuery] = useState('');
  const [counterpartResults, setCounterpartResults] = useState<Place[]>([]);

  useEffect(() => {
    const q = counterpartQuery.trim();
    if (!isCounterpartPickerOpen || q.length < 2) {
      setCounterpartResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await placeService.searchPlaces(q, 8);
      if (!cancelled) setCounterpartResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [counterpartQuery, isCounterpartPickerOpen]);

  const applyCounterpartLocation = (place: Place) => {
    if (!selectedPlace || selectedPlace.operationType === 'troca') return;
    const address = place.address || place.name;
    const updates: Partial<Place> = selectedPlace.operationType === 'entrega'
      ? { pickupName: place.name, pickupAddress: address, pickupCoordinates: place.coordinates }
      : { deliveryName: place.name, deliveryAddress: address, deliveryCoordinates: place.coordinates };
    if (isNewOrderDraft) setSelectedPlace({ ...selectedPlace, ...updates });
    else updatePlaceDetails(selectedPlace.id, updates);
    setIsCounterpartPickerOpen(false);
    setCounterpartQuery('');
  };

  const counterpartLabel = selectedPlace?.operationType === 'entrega' ? 'coleta' : 'entrega';
  const showCounterpartButton = Boolean(
    selectedPlace && canEdit && selectedPlace.operationType !== 'troca' && !hasCustomerRoute
  );
  const getRouteSeller = (point: 'pickup' | 'exchange' | 'delivery') => {
    const fields = point === 'pickup'
      ? { name: selectedPlace?.pickupSellerName, phone: selectedPlace?.pickupSellerPhone, operation: 'coleta' }
      : point === 'exchange'
        ? { name: selectedPlace?.exchangeSellerName, phone: selectedPlace?.exchangeSellerPhone, operation: 'troca' }
        : { name: selectedPlace?.deliverySellerName, phone: selectedPlace?.deliverySellerPhone, operation: 'entrega' };
    const isActivePoint = selectedPlace?.operationType === fields.operation;
    return {
      name: fields.name || (isActivePoint ? selectedPlace?.sellerName || selectedPlace?.responsibleName || selectedPlace?.managerName : '') || '',
      phone: fields.phone || (isActivePoint ? selectedPlace?.sellerPhone || selectedPlace?.responsiblePhone || selectedPlace?.managerPhone : '') || ''
    };
  };
  const getRouteDriver = (point: 'pickup' | 'exchange' | 'delivery') => {
    const fields = point === 'pickup'
      ? {
          id: selectedPlace?.pickupAssignedDriverId,
          name: selectedPlace?.pickupAssignedDriverName,
          phone: selectedPlace?.pickupAssignedDriverPhone,
          visibility: selectedPlace?.pickupVisibility,
          operation: 'coleta'
        }
      : point === 'exchange'
        ? {
            id: selectedPlace?.exchangeAssignedDriverId,
            name: selectedPlace?.exchangeAssignedDriverName,
            phone: selectedPlace?.exchangeAssignedDriverPhone,
            visibility: selectedPlace?.exchangeVisibility,
            operation: 'troca'
          }
        : {
            id: selectedPlace?.deliveryAssignedDriverId,
            name: selectedPlace?.deliveryAssignedDriverName,
            phone: selectedPlace?.deliveryAssignedDriverPhone,
            visibility: selectedPlace?.deliveryVisibility,
            operation: 'entrega'
          };
    const isActivePoint = selectedPlace?.operationType === fields.operation;
    return {
      id: fields.id || (isActivePoint ? selectedPlace?.assignedDriverId : undefined),
      name: fields.name || (isActivePoint ? selectedPlace?.assignedDriverName : undefined),
      phone: fields.phone || (isActivePoint ? selectedPlace?.assignedDriverPhone : undefined),
      visibility: fields.visibility || (isActivePoint ? selectedPlace?.orderVisibility : undefined) || 'publico'
    };
  };
  const renderRouteSellerCard = (
    point: 'pickup' | 'exchange' | 'delivery',
    label: string,
    allowEditing = true
  ) => {
    const contact = getRouteSeller(point);
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-slate-200 p-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-600">
            Vendedor / responsável da {label.toLowerCase()}
          </p>
          <p className="text-[11px] font-bold text-slate-800 truncate">
            {contact.name || <span className="text-slate-400 italic font-normal">Não informado</span>}
          </p>
          <p className="text-[9px] text-slate-500 truncate">
            {contact.phone ? formatPhoneDisplay(contact.phone) : 'Sem telefone'}
          </p>
        </div>
        {canEdit && allowEditing && (
          <button
            type="button"
            onClick={() => {
              setRouteSellerTarget(point);
              setIsSellerModalOpen(true);
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-[#0B5187] border border-blue-200 text-[9px] font-black hover:bg-blue-50"
            title={`Editar vendedor/responsável da ${label.toLowerCase()}`}
          >
            <Edit3 className="w-3 h-3" />
            {contact.name ? 'Editar' : 'Adicionar'}
          </button>
        )}
      </div>
    );
  };
  const getRouteAssignmentPlaceId = useCallback((point: 'pickup' | 'exchange' | 'delivery') => {
    if (!selectedPlace) return '';
    const operation = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
    const orderId = selectedPlace.orderId || selectedPlace.id.match(/pedido-(\d+)/)?.[1];
    if (orderId) return `pedido-${orderId}-${operation}`;
    return `${selectedPlace.id.replace(/-(coleta|troca|entrega|retorno)$/i, '')}-${operation}`;
  }, [selectedPlace]);

  const updateRoutePointVisibility = useCallback(async (point: 'pickup' | 'exchange' | 'delivery', visibility: 'publico' | 'privado') => {
    if (!selectedPlace) return;
    const operation = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
    const isActivePoint = selectedPlace.operationType === operation;
    const clearActiveDriver = visibility === 'publico' && isActivePoint
      ? {
          assignedDriverId: undefined,
          assignedDriverName: undefined,
          assignedDriverPhone: undefined
        }
      : {};
    const clearPointDriver = visibility === 'publico'
      ? point === 'pickup'
        ? {
            pickupAssignedDriverId: undefined,
            pickupAssignedDriverName: undefined,
            pickupAssignedDriverPhone: undefined
          }
        : point === 'exchange'
          ? {
              exchangeAssignedDriverId: undefined,
              exchangeAssignedDriverName: undefined,
              exchangeAssignedDriverPhone: undefined
            }
          : {
              deliveryAssignedDriverId: undefined,
              deliveryAssignedDriverName: undefined,
              deliveryAssignedDriverPhone: undefined
            }
      : {};
    const pointVisibility = point === 'pickup'
      ? { pickupVisibility: visibility }
      : point === 'exchange'
        ? { exchangeVisibility: visibility }
        : { deliveryVisibility: visibility };
    const updates: Partial<Place> = {
      ...pointVisibility,
      ...(isActivePoint ? { orderVisibility: visibility } : {}),
      ...clearPointDriver,
      ...clearActiveDriver
    };
    if (visibility === 'publico') {
      if (!await assignPlaceToDriver(getRouteAssignmentPlaceId(point), null, undefined, undefined)) return;
    } else {
      await updatePlaceDetails(selectedPlace.id, updates);
    }
    clearActiveRoute();
  }, [selectedPlace, assignPlaceToDriver, getRouteAssignmentPlaceId, updatePlaceDetails, clearActiveRoute]);

  const handleSelectDriverForRoutePoint = useCallback(async (driverOption: { id: string; phone?: string; name?: string }) => {
    if (!selectedPlace || !routeDriverTarget) return;
    const point = routeDriverTarget;
    const operation = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
    if (!await assignPlaceToDriver(getRouteAssignmentPlaceId(point), driverOption.id, driverOption.phone, driverOption.name)) return;
    clearActiveRoute();
    setIsDriverSelectorOpen(false);
    setRouteDriverTarget(null);
    setDriverToast(`${operation === 'coleta' ? 'Coleta' : operation === 'troca' ? 'Troca' : 'Entrega'} privada direcionada para ${driverOption.name}!`);
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, routeDriverTarget, assignPlaceToDriver, getRouteAssignmentPlaceId, clearActiveRoute]);

  const handleRemoveDriverFromRoutePoint = useCallback(async (point: 'pickup' | 'exchange' | 'delivery' = routeDriverTarget || 'pickup') => {
    if (!selectedPlace) return;
    if (!await assignPlaceToDriver(getRouteAssignmentPlaceId(point), null, undefined, undefined)) return;
    clearActiveRoute();
    setIsDriverSelectorOpen(false);
    setRouteDriverTarget(null);
    setDriverToast('Motorista desvinculado. O ponto voltou a ficar público.');
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, routeDriverTarget, assignPlaceToDriver, getRouteAssignmentPlaceId, clearActiveRoute]);

  // Informações do motorista direcionado
  const assignedDriverObj = useMemo(() => {
    if (!selectedPlace) return null;
    return drivers.find(d => 
      (selectedPlace.assignedDriverId && (d.id === selectedPlace.assignedDriverId || d.id.replace(/\D/g, '') === selectedPlace.assignedDriverId.replace(/\D/g, ''))) ||
      (selectedPlace.assignedDriverPhone && d.phone && d.phone.replace(/\D/g, '') === selectedPlace.assignedDriverPhone.replace(/\D/g, ''))
    ) || null;
  }, [selectedPlace, drivers]);

  const handleSelectDriverForPlace = useCallback(async (driverOption: { id: string; phone?: string; name?: string }) => {
    if (!selectedPlace) return;
    if (!await assignPlaceToDriver(selectedPlace.id, driverOption.id, driverOption.phone, driverOption.name)) return;
    clearActiveRoute();
    setDriverToast(`Encomenda privada direcionada para ${driverOption.name}!`);
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, assignPlaceToDriver, clearActiveRoute]);

  const handleRemoveDriverFromPlace = useCallback(async () => {
    if (!selectedPlace) return;
    if (!await assignPlaceToDriver(selectedPlace.id, null, undefined, undefined)) return;
    clearActiveRoute();
    setDriverToast('Motorista desvinculado. Encomenda disponível para todos.');
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, assignPlaceToDriver, clearActiveRoute]);

  const handleSetVisibilityPublic = useCallback(async () => {
    if (!selectedPlace) return;
    if (!await assignPlaceToDriver(selectedPlace.id, null, undefined, undefined)) return;
    clearActiveRoute();
    setDriverToast('Visibilidade definida como Público (aparece para todos os motoristas).');
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, assignPlaceToDriver, clearActiveRoute]);

  const handleSetVisibilityPrivate = useCallback(() => {
    if (!selectedPlace) return;
    clearActiveRoute();
    updatePlaceDetails(selectedPlace.id, {
      orderVisibility: 'privado'
    });
    setDriverToast('Visibilidade definida como Privado. Selecione um motorista se desejar.');
    setTimeout(() => setDriverToast(null), 3500);
  }, [selectedPlace, updatePlaceDetails, clearActiveRoute]);

  const handleDraftVisibilityChange = useCallback((visibility: 'publico' | 'privado') => {
    if (!selectedPlace) return;
    const point = routeDriverTarget ||
      (selectedPlace.operationType === 'troca' ? 'exchange' : selectedPlace.operationType === 'entrega' ? 'delivery' : 'pickup');
    updateRoutePointVisibility(point, visibility);
    setDriverToast(`Visibilidade da ${point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega'} definida como ${visibility === 'publico' ? 'Público' : 'Privado'}.`);
    setTimeout(() => setDriverToast(null), 3500);
  }, [routeDriverTarget, selectedPlace, updateRoutePointVisibility]);

  const [copied, setCopied] = useState(false);
  const [sharedToast, setSharedToast] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [showNavChooser, setShowNavChooser] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [saveAsDefaultNav, setSaveAsDefaultNav] = useState<boolean>(true);

  // Estados dos seletores interativos do cabeçalho superior (Tipo, Agenda, Veículo, Carga)
  const [showOperationPicker, setShowOperationPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showPackagePicker, setShowPackagePicker] = useState(false);

  // Estados para Tipo Personalizado de Encomenda e Medidas/Volumes
  const [newCustomPackageInput, setNewCustomPackageInput] = useState('');
  const [showCustomCargoDetails, setShowCustomCargoDetails] = useState(false);
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');

  // Lista dinâmica e persistida de tipos de encomendas
  const [customPackageTypes, setCustomPackageTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('encomendaszap_custom_package_types');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const BASE_PACKAGE_TYPES = useMemo(() => [
    { key: 'caixa_pequena', label: 'Caixa Pequena', emoji: '📦' },
    { key: 'caixa_media', label: 'Caixa Média', emoji: '📦' },
    { key: 'caixa_grande', label: 'Caixa Grande', emoji: '📦' },
    { key: 'sacola', label: 'Sacola', emoji: '🛍️' },
    { key: 'envelope', label: 'Envelope', emoji: '✉️' },
    { key: 'documento', label: 'Documento / Papel', emoji: '📄' },
    { key: 'alimentos', label: 'Alimentos / Refeição', emoji: '🍔' },
    { key: 'farmacia', label: 'Farmácia / Remédio', emoji: '💊' },
    { key: 'eletronicos', label: 'Eletrônicos', emoji: '📱' },
    { key: 'roupas', label: 'Roupas / Confecção', emoji: '👗' },
    { key: 'flores', label: 'Flores / Presente', emoji: '💐' },
    { key: 'autopecas', label: 'Peças / Autopeças', emoji: '⚙️' },
    { key: 'ferramentas', label: 'Ferramentas', emoji: '🛠️' },
    { key: 'fragil', label: 'Frágil / Vidro', emoji: '🧪' },
    { key: 'cilindro', label: 'Cilindro / Tubo', emoji: '🛢️' },
    { key: 'outro', label: 'Outro', emoji: '📦' }
  ], []);

  const allAvailablePackageTypes = useMemo(() => {
    const list = [...BASE_PACKAGE_TYPES];
    customPackageTypes.forEach(customName => {
      if (!list.some(item => item.label.toLowerCase() === customName.toLowerCase() || item.key.toLowerCase() === customName.toLowerCase())) {
        list.push({
          key: customName.toLowerCase().replace(/\s+/g, '_'),
          label: customName,
          emoji: '✨'
        });
      }
    });
    return list;
  }, [BASE_PACKAGE_TYPES, customPackageTypes]);

  const handleAddCustomPackageType = useCallback(() => {
    const trimmed = newCustomPackageInput.trim();
    if (!trimmed || !selectedPlace) return;
    if (!customPackageTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      const next = [...customPackageTypes, trimmed];
      setCustomPackageTypes(next);
      try {
        localStorage.setItem('encomendaszap_custom_package_types', JSON.stringify(next));
      } catch {}
    }
    updatePlaceDetails(selectedPlace.id, { packageType: trimmed as any });
    setNewCustomPackageInput('');
  }, [newCustomPackageInput, selectedPlace, customPackageTypes, updatePlaceDetails]);

  // Estado para editar observações por etapa (Coleta, Troca, Entrega)
  const [isEditingObservations, setIsEditingObservations] = useState(false);
  const [editedObservations, setEditedObservations] = useState('');
  const [editedPickupNotes, setEditedPickupNotes] = useState('');
  const [editedExchangeNotes, setEditedExchangeNotes] = useState('');
  const [editedDeliveryNotes, setEditedDeliveryNotes] = useState('');
  const [draftPlaceName, setDraftPlaceName] = useState('');
  const [showPlaceNameError, setShowPlaceNameError] = useState(false);
  const placeNameInputRef = useRef<HTMLInputElement>(null);
  const draftObservationRef = useRef<HTMLTextAreaElement>(null);
  const placeNameDraftRef = useRef<{ id: string; edited: boolean } | null>(null);
  const draftObservationEditedRef = useRef(false);
  useEffect(() => {
    if (!selectedPlace || !isNewOrderDraft || isDriverRole) return;
    draftObservationEditedRef.current = false;
    const timer = window.setTimeout(() => draftObservationRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [selectedPlace?.id, isNewOrderDraft, isDriverRole]);
  useEffect(() => {
    if (!selectedPlace || !isNewOrderDraft) {
      placeNameDraftRef.current = null;
      return;
    }
    if (placeNameDraftRef.current?.id !== selectedPlace.id) {
      placeNameDraftRef.current = { id: selectedPlace.id, edited: false };
      setShowPlaceNameError(false);
    }
    if (placeNameDraftRef.current.edited) return;
    const suggestedName = getSuggestedOrderPlaceName(selectedPlace);
    setDraftPlaceName(suggestedName);
    if (selectedPlace.isResolvingAddress || suggestedName) return;
    const timer = window.setTimeout(() => {
      if (!draftObservationEditedRef.current &&
          (document.activeElement === draftObservationRef.current || document.activeElement === document.body)) {
        placeNameInputRef.current?.focus();
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [selectedPlace?.id, selectedPlace?.name, selectedPlace?.address, selectedPlace?.category, selectedPlace?.isUnnamed, selectedPlace?.isResolvingAddress, isNewOrderDraft]);
  const isPlaceNameInvalid = !draftPlaceName.trim();
  const [draftOrderComment, setDraftOrderComment] = useState('');
  const [editingRouteComment, setEditingRouteComment] = useState<'pickup' | 'delivery' | null>(null);
  const [viewNotePoint, setViewNotePoint] = useState<'pickup' | 'exchange' | 'delivery' | null>(null);
  const [viewNoteText, setViewNoteText] = useState('');

  // Modal da Etapa Final com Detalhes, Rota, Preços e Compartilhar no Zap
  const [isFinalDetailsOpen, setIsFinalDetailsOpen] = useState(false);

  // Lista de Fotos personalizadas da encomenda/ponto (múltiplas fotos)
  const [customPhotos, setCustomPhotos] = useState<string[]>([]);
  const photoUploadsRef = useRef(new Map<string, Promise<{ path?: string; error?: string; stage: 'coleta' | 'entrega' }>>());
  const photoUploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const photoSourceRef = useRef(new Map<string, string>());
  const pickupProofRef = useRef(new Set<string>());
  const [isFinalizingPhoto, setIsFinalizingPhoto] = useState(false);

  // Distância calculada até o local
  const originCoords = userLocation || currentCoords;
  const directDistanceKm = (originCoords && selectedPlace)
    ? calculateDistanceKm(originCoords, selectedPlace.coordinates)
    : null;

  const effectiveDistanceKm = activeRoute?.distanceKm ?? directDistanceKm;
  const distanceFormatted = effectiveDistanceKm != null ? formatDistance(effectiveDistanceKm) : null;

  // ==========================================
  // SISTEMA DE CÂMERA PRÓPRIO CHEIA NA TELA
  // ==========================================
  const [isFullScreenCameraOpen, setIsFullScreenCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Foto temporária capturada para visualização/confirmação
  const [previewCapturedPhoto, setPreviewCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const scheduleCalendarInputRef = useRef<HTMLInputElement>(null);

  // Estados do Diálogo de Coleta / Entrega / Troca
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [farWarning, setFarWarning] = useState<{ proximity: BaixaProximity; proceed: () => void } | null>(null);
  const [operationStatus, setOperationStatus] = useState<'success' | 'failed'>('success');
  const [receiverName, setReceiverName] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageItemType>('caixa');
  const [volumesCount, setVolumesCount] = useState('1 volume');
  const [volumeQuantity, setVolumeQuantity] = useState<number>(1);
  const [volumeQuantityInput, setVolumeQuantityInput] = useState<string>('1');

  const handleUpdateVolumeQuantity = (num: number) => {
    const valid = Math.max(1, Math.min(999, num));
    setVolumeQuantity(valid);
    setVolumeQuantityInput(String(valid));
    setVolumesCount(`${valid} ${valid === 1 ? 'volume' : 'volumes'}`);
  };

  const handleVolumeInputChange = (val: string) => {
    setVolumeQuantityInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const valid = Math.min(999, parsed);
      setVolumeQuantity(valid);
      setVolumesCount(`${valid} ${valid === 1 ? 'volume' : 'volumes'}`);
    }
  };

  const handleVolumeInputBlur = () => {
    const parsed = parseInt(volumeQuantityInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      handleUpdateVolumeQuantity(1);
    } else {
      handleUpdateVolumeQuantity(parsed);
    }
  };
  const [notes, setNotes] = useState('');
  const [photoErrorMsg, setPhotoErrorMsg] = useState('');
  const [showObservationSheet, setShowObservationSheet] = useState(false);
  const [failReason, setFailReason] = useState('Local Fechado');
  const [showFailReasonPicker, setShowFailReasonPicker] = useState(false);
  const [registeredOutcome, setRegisteredOutcome] = useState<{
    status: 'success' | 'failed';
    time: string;
    details?: string;
  } | null>(null);

  // Animação de subida e gesto de fechar arrastando para baixo
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Relógio sincronizado a cada 30 segundos para atualizar em quanto tempo vai fechar
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const startYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const lastCalculatedPlaceIdRef = useRef<string | null>(null);
  const currentActivePlaceIdRef = useRef<string | null>(null);
  const calculateRouteRef = useRef(calculateRouteToPlace);
  calculateRouteRef.current = calculateRouteToPlace;

  // Reset ao selecionar novo local
  useEffect(() => {
    if (selectedPlace) {
      // Se for o mesmo local já aberto, NÃO resetar e NUNCA fechar a câmera
      if (currentActivePlaceIdRef.current === selectedPlace.id) {
        return;
      }
      currentActivePlaceIdRef.current = selectedPlace.id;

      setIsClosing(false);
      setDragY(0);
      currentDragYRef.current = 0;
      
      // Carrega as fotos da etapa e, na entrega, as fotos da coleta.
      let initialPhotos: string[] = [];
      if (selectedPlace.photos && selectedPlace.photos.length > 0) {
        initialPhotos = extractPhotoUrls(selectedPlace.photos, 'md');
      } else if (selectedPlace.imageUrl) {
        const formatted = formatPhotoUrl(selectedPlace.imageUrl, 'md');
        if (formatted) initialPhotos = [formatted];
      }
      pickupProofRef.current = new Set(selectedPlace.pickupPhotos || []);
      photoUploadsRef.current = new Map();
      photoUploadQueueRef.current = Promise.resolve();
      photoSourceRef.current = new Map();
      try {
        const saved = localStorage.getItem(`encomendaszap_photos_${selectedPlace.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validSaved = parsed
              .filter((p: any) => typeof p === 'string' && !p.includes('images.unsplash.com'))
              .map((p: string) => formatPhotoUrl(p, 'md') || p)
              .filter(Boolean);
            if (validSaved.length > 0) {
              initialPhotos = Array.from(new Set([...initialPhotos, ...validSaved]));
            }
          }
        }
      } catch {}
      setCustomPhotos(initialPhotos);

      setRegisteredOutcome(null);
      setReceiverName(selectedPlace.customerName || selectedPlace.sellerName || '');
      setSelectedPackage(selectedPlace.packageType || 'caixa');
      setNotes('');
      setShowOperationPicker(false);
      setShowSchedulePicker(false);
      setShowVehiclePicker(false);
      setShowPackagePicker(false);
      setIsEditingObservations(false);
      setEditingRouteComment(null);
      setEditedObservations(selectedPlace.observations || '');
      setEditedPickupNotes(selectedPlace.pickupNotes || '');
      setEditedExchangeNotes(selectedPlace.exchangeNotes || '');
      setEditedDeliveryNotes(selectedPlace.deliveryNotes || '');
      setDraftOrderComment(
        selectedPlace.operationType === 'troca'
          ? selectedPlace.exchangeNotes || selectedPlace.observations || ''
          : selectedPlace.operationType === 'entrega'
            ? selectedPlace.deliveryNotes || selectedPlace.observations || ''
            : selectedPlace.pickupNotes || selectedPlace.observations || ''
      );
      setNewCustomPackageInput('');

      // Inicializa dimensões a partir de selectedPlace.dimensions (ex: 30x20x15 cm)
      if (selectedPlace.dimensions) {
        const parts = selectedPlace.dimensions.replace(/cm/gi, '').trim().split(/[xX*]/);
        if (parts.length >= 3) {
          setDimLength(parts[0].trim());
          setDimWidth(parts[1].trim());
          setDimHeight(parts[2].trim());
        } else {
          setDimLength(selectedPlace.dimensions);
          setDimWidth('');
          setDimHeight('');
        }
      } else {
        setDimLength('');
        setDimWidth('');
        setDimHeight('');
      }

      closeFullScreenCamera();

      // A rota só deve ser traçada quando o usuário clicar no GPS para navegar
      lastCalculatedPlaceIdRef.current = selectedPlace.id;

      // Sincroniza em background com os dados mais recentes do pedido no banco de dados (/pedidos/get)
      const numericOrderId = selectedPlace.id.match(/pedido-(\d+)/)?.[1] || selectedPlace.id.match(/\d+/)?.[0];
      if (numericOrderId) {
        api.getPedido(numericOrderId).then(res => {
          if (res.success && res.data) {
            const assignment = extractDriverAssignmentFromPedido(res.data, selectedPlace.operationType);
            if (assignment.driverId && (!selectedPlace.assignedDriverId || selectedPlace.assignedDriverId !== assignment.driverId)) {
              updatePlaceDetails(selectedPlace.id, {
                assignedDriverId: assignment.driverId,
                assignedDriverName: assignment.driverName,
                assignedDriverPhone: assignment.driverPhone
              });
            }
          }
        }).catch(() => {});
      }

      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 20);
      return () => clearTimeout(timer);
    } else {
      currentActivePlaceIdRef.current = null;
      lastCalculatedPlaceIdRef.current = null;
      setIsVisible(false);
      closeFullScreenCamera();
    }
  }, [selectedPlace?.id]);

  // Função para fechar suavemente com animação para baixo
  const triggerClose = useCallback(() => {
    setIsClosing(true);
    setIsVisible(false);
    closeFullScreenCamera();
    if (selectedPlace) {
      dismissPlaceProximity(selectedPlace.id);
    }
    setTimeout(() => {
      setSelectedPlace(null);
      // Mantém a rota ativa no mapa conforme solicitado pelo usuário:
      // A rota traçada não é apagada ao fechar o card de detalhes nem ao navegar.
      // Ela só será substituída se clicar em outro ponto e traçar outra rota.
      setIsClosing(false);
      setDragY(0);
      currentDragYRef.current = 0;
    }, 240);
  }, [selectedPlace, setSelectedPlace, dismissPlaceProximity]);

  // Cancelamento do pedido pelo motorista (desiste da rota; justificativa obrigatória gravada no banco)
  const handleConfirmRefusal = useCallback(async () => {
    const justification = refusalNotes.trim();
    if (!selectedPlace || !refusalReason) return;
    if (justification.length < 5) return;
    setIsSubmittingRefusal(true);

    try {
      const fullReasonText = justification.startsWith(refusalReason) ? justification : `${refusalReason} - ${justification}`;
      const operation = selectedPlace.operationType || 'coleta';
      const numericPedidoId = selectedPlace.id.match(/pedido-(\d+)/)?.[1] || selectedPlace.id.match(/\d+/)?.[0];
      if (!numericPedidoId) throw new Error('Não foi possível identificar o pedido recusado.');

      const response = await realtimeAssignmentService.declineClaimedOrder(
        numericPedidoId,
        operation,
        fullReasonText
      );
      if (!response.success) {
        throw new Error(response.message || 'Não foi possível devolver o pedido ao público.');
      }

      // Atualiza imediatamente o estado local após a confirmação do servidor.
      await updatePlaceDetails(selectedPlace.id, {
        operationType: operation,
        orderVisibility: 'publico',
        assignedDriverId: undefined,
        assignedDriverPhone: undefined,
        assignedDriverName: undefined
      });

      setDriverToast('Pedido cancelado. A central foi notificada.');
      setTimeout(() => setDriverToast(null), 4000);
      setShowRefusalModal(false);
      setRefusalReason('');
      setRefusalNotes('');

      // Fecha suavemente o card de detalhes
      triggerClose();
    } catch (e) {
      console.warn('Erro ao recusar rota:', e);
      setDriverToast(e instanceof Error ? e.message : 'Não foi possível devolver o pedido ao público.');
      setTimeout(() => setDriverToast(null), 5000);
    } finally {
      setIsSubmittingRefusal(false);
    }
  }, [selectedPlace, refusalReason, refusalNotes, updatePlaceDetails, triggerClose]);

  // Gestos de toque (Touch) para arrastar para baixo e fechar
  const handleTouchStart = (e: React.TouchEvent) => {
    if (contentScrollRef.current && contentScrollRef.current.scrollTop > 5) {
      return;
    }
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;

    if (deltaY > 0) {
      const pull = Math.min(deltaY, 260);
      currentDragYRef.current = pull;
      setDragY(pull);
    } else {
      currentDragYRef.current = 0;
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (currentDragYRef.current > 80) {
      triggerClose();
    } else {
      setDragY(0);
      currentDragYRef.current = 0;
    }
  };

  // Gestos com mouse no puxador / topo
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    startYRef.current = e.clientY;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      if (deltaY > 0) {
        const pull = Math.min(deltaY, 260);
        currentDragYRef.current = pull;
        setDragY(pull);
      } else {
        currentDragYRef.current = 0;
        setDragY(0);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      if (currentDragYRef.current > 80) {
        triggerClose();
      } else {
        setDragY(0);
        currentDragYRef.current = 0;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ==========================================
  // FUNÇÕES DA CÂMERA PRÓPRIA CHEIA NA TELA
  // ==========================================
  const openFullScreenCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setPreviewCapturedPhoto(null);
    setCameraError(null);
    setIsFullScreenCameraOpen(true);
    setFocusPoint(null);
    setZoomLevel(1.0);
    setPhotoErrorMsg('');
    setShowObservationSheet(false);

    // Encerra stream anterior se houver
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Câmera não suportada neste dispositivo.');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch {
        // Fallback para constraints simples caso a alta resolução falhe ou seja recusada
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;

      const bindVideo = () => {
        if (videoRef.current) {
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
          }
          videoRef.current.play().catch(e => {
            console.warn('Play do vídeo:', e);
          });
        }
      };

      bindVideo();
      setTimeout(bindVideo, 100);
      setTimeout(bindVideo, 350);
      requestAnimationFrame(bindVideo);
    } catch (err: any) {
      console.warn('Erro ao abrir câmera:', err);
      setCameraError('Câmera indisponível ou permissão negada. Você pode escolher fotos da galeria.');
    }
  };

  const closeFullScreenCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsFullScreenCameraOpen(false);
    setPreviewCapturedPhoto(null);
    setCameraError(null);
    setShowObservationSheet(false);
    setShowFailReasonPicker(false);
  };

  const openFullScreenCameraForFailure = () => {
    setOperationStatus('failed');
    setPhotoErrorMsg('');
    setShowFailReasonPicker(false);
    openFullScreenCamera();
  };

  const handleFlipCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    openFullScreenCamera(nextFacing);
  };

  // Toque na tela para focar estilo smartphone
  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusPoint({ x, y });

    setTimeout(() => {
      setFocusPoint(prev => (prev?.x === x && prev?.y === y ? null : prev));
    }, 2000);
  };

  const addCapturedPhoto = (dataUrl: string) => {
    if (!selectedPlace || isFinalizingPhoto || isSavingOrder) return;
    const place = selectedPlace;
    const stage: 'coleta' | 'entrega' = place.operationType === 'entrega' || place.operationType === 'troca' ? 'entrega' : 'coleta';
    const isDraft = isTemporaryOrderId(place.id);
    const pickupProof = pickupProofRef.current;
    const photoSources = photoSourceRef.current;
    if (stage === 'coleta') pickupProof.add(dataUrl);
    setCustomPhotos(prev => [...prev, dataUrl]);
    setPhotoErrorMsg('');

    const task = photoUploadQueueRef.current.then(async () => {
      try {
        const orderId = isDraft ? undefined : (String(place.orderId || place.pedido_id || place.id).match(/\d+/)?.[0]);
        if (!isDraft && !orderId) throw new Error('Não foi possível identificar o pedido para anexar a foto.');
        const path = await persistOrderPhoto(api, dataUrl, stage, orderId);
        const photo = formatPhotoUrl(path, 'md') || path;
        photoSources.set(photo, dataUrl);
        if (pickupProof.delete(dataUrl)) pickupProof.add(photo);
        if (currentActivePlaceIdRef.current === place.id) {
          setCustomPhotos(prev => prev.map(item => item === dataUrl ? photo : item));
          setSelectedPlace(prev => {
            if (!prev || prev.id !== place.id) return prev;
            const field = stage === 'coleta' ? 'pickupPhotos' : 'deliveryPhotos';
            const photos = [...(prev[field] || []), photo];
            return { ...prev, [field]: photos, imageUrl: photo, photos: [photo, ...(prev.photos || [])] };
          });
        }
        return { path, stage };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível salvar a foto.';
        console.error('[Fotos] Falha ao salvar foto do pedido:', error);
        if (currentActivePlaceIdRef.current === place.id) setPhotoErrorMsg(message);
        return { error: message, stage };
      }
    });
    photoUploadsRef.current.set(dataUrl, task);
    photoUploadQueueRef.current = task.then(() => undefined);
  };

  // Disparador de foto estilo Samsung Camera (as fotos saem embaixo e a câmera continua aberta!)
  const handleTakeShutterPhoto = () => {
    // Se o stream WebRTC não estiver ativo ou houver restrição no navegador,
    // aciona diretamente a câmera física do aparelho (Samsung / iPhone):
    if (!videoRef.current || cameraError || !streamRef.current || videoRef.current.videoWidth === 0) {
      nativeCameraInputRef.current?.click();
      return;
    }

    // Feedback visual imediato ao bater foto (flash rápido da tela)
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), flashMode === 'on' ? 200 : 90);

    try {
      if (navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch {}

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      if (zoomLevel > 1.0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      
      addCapturedPhoto(dataUrl);
    }
  };

  // Escolher fotos da galeria sem fechar a câmera
  const handleGalleryFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            addCapturedPhoto(event.target.result as string);
          }
        };
        reader.onerror = () => setPhotoErrorMsg('Não foi possível ler a foto selecionada.');
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  // Distância entre o motorista (GPS ao vivo) e o local; null se a posição real é desconhecida
  const getBaixaProximity = (): BaixaProximity | null => {
    const pos = androidBridge.getNativeCoordinates() || userLocation;
    if (!pos || !selectedPlace) return null;
    const distanceM = calculateDistanceKm(pos, selectedPlace.coordinates) * 1000;
    if (!Number.isFinite(distanceM) || distanceM <= LIMITE_BAIXA_DISTANTE_M) return null;
    return { distanceM: Math.round(distanceM), lat: pos.lat, lng: pos.lng };
  };

  // Finalizar Registro da Operação direto da Câmera
  const handleFinalizeRegistration = async (confirmedFar?: BaixaProximity) => {
    if (!selectedPlace || isFinalizingPhoto) return;
    setPhotoErrorMsg('');

    // Validação de foto obrigatória na Coleta em caso de sucesso
    const isColetaOp = selectedPlace?.orderStage === 'coleta' || selectedPlace?.operationType === 'coleta';
    if (isColetaOp && operationStatus === 'success' && pickupProofRef.current.size === 0) {
      setPhotoErrorMsg('Foto obrigatória: aponte a câmera e tire a foto da mercadoria para finalizar a coleta.');
      return;
    }
    if (isTemporaryOrderId(selectedPlace.id)) {
      setPhotoErrorMsg('Salve o pedido antes de registrar a coleta ou entrega.');
      return;
    }

    const far = confirmedFar || getBaixaProximity();
    if (far && !confirmedFar) {
      setFarWarning({ proximity: far, proceed: () => handleFinalizeRegistration(far) });
      return;
    }

    setIsFinalizingPhoto(true);
    try {
      const uploads = await Promise.all(photoUploadsRef.current.values());
      const failedUpload = uploads.find(upload => upload.error);
      if (failedUpload) {
        setPhotoErrorMsg(`Não foi possível salvar a foto: ${failedUpload.error}. Remova a foto e tente novamente.`);
        return;
      }
      const completed = operationStatus === 'success'
        ? await completePlaceWaypoint(selectedPlace.id, receiverName, notes, confirmedFar, Array.from(pickupProofRef.current))
        : await completePlaceWaypoint(selectedPlace.id, `Insucesso: ${failReason}`, `Tentativa sem sucesso: ${failReason}${notes ? ` - ${notes}` : ''}`, confirmedFar);
      if (!completed) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setRegisteredOutcome({
        status: operationStatus,
        time: timeStr,
        details: operationStatus === 'success'
          ? `${receiverName ? `Por: ${receiverName} • ` : ''}${volumeQuantity} vol`
          : failReason
      });
      closeFullScreenCamera();
      setShowOperationModal(false);
    } finally {
      setIsFinalizingPhoto(false);
    }
  };

  // Excluir uma foto da lista
  const handleDeletePhoto = async (indexToDelete: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedPlace || isFinalizingPhoto) return;
    const removed = customPhotos[indexToDelete];
    if (!removed) return;
    const pickupProof = pickupProofRef.current;
    const photoUploads = photoUploadsRef.current;
    const photoSources = photoSourceRef.current;
    setIsFinalizingPhoto(true);
    setPhotoErrorMsg('');
    try {
      const source = photoSources.get(removed) || removed;
      const upload = await photoUploads.get(source);
      const photo = upload?.path ? (formatPhotoUrl(upload.path, 'md') || upload.path) : removed;
      const stage = upload?.stage ||
        (selectedPlace.deliveryPhotos?.includes(photo) ? 'entrega' :
          selectedPlace.pickupPhotos?.includes(photo) ? 'coleta' : undefined);
      if (stage && !upload?.error && !isTemporaryOrderId(selectedPlace.id)) {
        const orderId = String(selectedPlace.orderId || selectedPlace.pedido_id || selectedPlace.id).match(/\d+/)?.[0];
        if (!orderId) throw new Error('Não foi possível identificar o pedido.');
        const result = await api.removeFoto(orderId, upload?.path || photo, stage === 'coleta' ? 'coleta_foto' : 'entrega_foto');
        if (!result.success) throw new Error(result.message || 'Não foi possível remover a foto.');
      }
      pickupProof.delete(source);
      pickupProof.delete(photo);
      photoUploads.delete(source);
      photoSources.delete(photo);
      try {
        const key = `encomendaszap_photos_${selectedPlace.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            localStorage.setItem(key, JSON.stringify(parsed.filter(item =>
              typeof item !== 'string' || (formatPhotoUrl(item, 'md') || item) !== photo
            )));
          }
        }
      } catch (error) {
        console.error('[Fotos] Não foi possível atualizar as fotos locais:', error);
        if (currentActivePlaceIdRef.current === selectedPlace.id) {
          setPhotoErrorMsg('Foto removida do pedido, mas não foi possível atualizar as fotos locais.');
        }
      }
      if (currentActivePlaceIdRef.current === selectedPlace.id) {
        setCustomPhotos(prev => prev.filter(item => item !== removed && item !== photo));
      }
      setSelectedPlace(prev => {
        if (!prev || prev.id !== selectedPlace.id) return prev;
        const photos = (prev.photos || []).filter(item => item !== photo && item !== removed);
        return {
          ...prev,
          photos,
          imageUrl: photos[0],
          pickupPhotos: prev.pickupPhotos?.filter(item => item !== photo),
          deliveryPhotos: prev.deliveryPhotos?.filter(item => item !== photo)
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível remover a foto.';
      console.error('[Fotos] Falha ao remover foto:', error);
      if (currentActivePlaceIdRef.current === selectedPlace.id) setPhotoErrorMsg(message);
    } finally {
      setIsFinalizingPhoto(false);
    }
  };

  // Descartar foto do preview e voltar para o visor
  const handleRetakePhoto = () => {
    setPreviewCapturedPhoto(null);
    if (!streamRef.current) {
      openFullScreenCamera(cameraFacing);
    }
  };

  // Finalizar Registro da Operação
  const handleSaveOperation = (confirmedFar?: BaixaProximity) => handleFinalizeRegistration(confirmedFar);

  if (!selectedPlace) return null;

  const { lat, lng } = selectedPlace.coordinates;
  const operationType: OperationType = selectedPlace.operationType || 'entrega';
  const isExchange = Boolean(selectedPlace.isExchangeOrder);
  const orderStage = selectedPlace.orderStage || (selectedPlace.operationType === 'troca' ? 'troca' : selectedPlace.operationType === 'entrega' ? 'entrega' : 'coleta');
  
  const hasCustomer = Boolean(selectedPlace.customerName && selectedPlace.customerName.trim());
  const customerName = selectedPlace.customerName || '';
  const customerPhone = selectedPlace.customerPhone || '';
  const placeDateBadge = getPlaceDateBadgeInfo(selectedPlace);
  const activeRoutePoint: 'exchange' | 'delivery' | 'pickup' = operationType === 'troca' ? 'exchange' : operationType === 'entrega' ? 'delivery' : 'pickup';
  const activeRouteSeller = getRouteSeller(activeRoutePoint);
  
  const hasResponsible = Boolean(
    activeRouteSeller.name ||
    (selectedPlace.responsibleName && selectedPlace.responsibleName.trim()) ||
    (selectedPlace.sellerName && selectedPlace.sellerName.trim()) || 
    (selectedPlace.managerName && selectedPlace.managerName.trim())
  );
  const responsibleName = activeRouteSeller.name || selectedPlace.sellerName || selectedPlace.responsibleName || selectedPlace.managerName || '';
  const responsiblePhone = activeRouteSeller.phone || selectedPlace.sellerPhone || selectedPlace.responsiblePhone || selectedPlace.managerPhone || customerPhone;
  const selectedDriverName = selectedPlace.assignedDriverName || assignedDriverObj?.name || '';
  const renderRoutePointDetails = (point: 'pickup' | 'exchange' | 'delivery') => {
    const seller = getRouteSeller(point);
    if (!canEdit && hasCustomerRoute) return null;
    const notes = point === 'pickup'
      ? selectedPlace.pickupNotes || selectedPlace.observations || ''
      : point === 'exchange'
        ? selectedPlace.exchangeNotes || selectedPlace.observations || ''
        : selectedPlace.deliveryNotes || selectedPlace.observations || '';

    if (!seller.name && !notes) return null;

    return (
      <div className="mt-1.5 space-y-0.5 border-l-2 border-slate-200 pl-2 text-[9.5px]">
        {seller.name && (
          <p className="flex items-center gap-1 font-bold text-slate-600">
            <UserCheck className="h-3 w-3 shrink-0 text-[#0B5187]" />
            <span className="truncate">Responsável: {seller.name}</span>
          </p>
        )}
        {notes && (
          <p className="flex items-start gap-1 font-medium text-slate-500">
            <FileText className="mt-0.5 h-3 w-3 shrink-0 text-amber-700" />
            <span className="line-clamp-2 whitespace-pre-wrap break-words">Obs.: {notes}</span>
          </p>
        )}
      </div>
    );
  };
  const renderViewRoutePointActions = (point: 'pickup' | 'exchange' | 'delivery') => {
    if (isNewOrderDraft || canEdit) return null;
    const seller = getRouteSeller(point);
    const driver = getRouteDriver(point);
    const label = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
    const driverDisplayName = driver.name || (point === activeRoutePoint ? assignedDriverObj?.name : '') || '';
    const driverPhoneNumber = driver.phone || (point === activeRoutePoint ? assignedDriverObj?.phone : '') || '';
    const hasDriver = Boolean(driverDisplayName || driver.id);
    const canPickDriver = canEdit && canManageDriverAssignment;
    const note = (point === 'pickup'
      ? selectedPlace.pickupNotes
      : point === 'exchange'
        ? selectedPlace.exchangeNotes
        : selectedPlace.deliveryNotes) || (point === activeRoutePoint ? selectedPlace.observations : '') || '';
    const isEditingNote = viewNotePoint === point;
    const VisibilityIcon = driver.visibility === 'privado' ? Lock : Globe;

    const openSeller = () => {
      setRouteSellerTarget(point);
      setIsSellerModalOpen(true);
    };
    const openDriver = () => {
      setRouteDriverTarget(point);
      setIsDriverSelectorOpen(true);
    };
    const saveNote = () => {
      const value = viewNoteText.trim();
      const routeNote = point === 'pickup'
        ? { pickupNotes: value }
        : point === 'exchange'
          ? { exchangeNotes: value }
          : { deliveryNotes: value };
      updatePlaceDetails(selectedPlace.id, {
        ...routeNote,
        ...(point === activeRoutePoint ? { observations: value } : {})
      });
      setViewNotePoint(null);
      setSaveSuccessToast(`Comentário da ${label} salvo.`);
      setTimeout(() => setSaveSuccessToast(null), 3000);
    };

    const contactButton = (
      colors: string,
      title: string,
      name: string,
      phone: string,
      icon: React.ReactNode,
      onEdit?: () => void
    ) => (
      <div className="flex min-w-0 flex-1 basis-[46%] items-stretch gap-0.5">
        <button
          type="button"
          disabled={!phone}
          onClick={() => handleWhatsApp(phone, name)}
          className={`inline-flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black text-white shadow-sm transition-colors disabled:opacity-70 ${colors}`}
          title={phone ? `Chamar ${name} no WhatsApp` : 'Sem telefone cadastrado'}
        >
          {icon}
          <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-tight">
            <span>{title}</span><br />
            <span className="font-semibold">{name}</span><br />
            <span className="text-[9px] font-bold text-white/90">{phone ? 'Clique para chamar no zap' : 'Sem telefone'}</span>
          </span>
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={`inline-flex w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${colors}`}
            title={`Alterar ${title.toLowerCase()}`}
          >
            <Edit3 className="h-3 w-3" />
          </button>
        )}
      </div>
    );

    const addButton = (colors: string, text: string, icon: React.ReactNode, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-w-0 flex-1 basis-[46%] items-center justify-between gap-1.5 rounded-lg px-2 py-2 text-[10px] font-black text-white shadow-sm transition-colors ${colors}`}
      >
        {icon}
        <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">{text}</span>
      </button>
    );

    const sellerColors = 'border border-orange-700 bg-orange-500 hover:bg-orange-600';
    const driverColors = 'border border-emerald-700 bg-emerald-600 hover:bg-emerald-700';
    const showSeller = Boolean(seller.name) || canEdit;
    const showDriver = hasDriver || canPickDriver;

    if (!showSeller && !showDriver && !note.trim() && !canEdit) return null;

    return (
      <div className="mt-2 space-y-1.5">
        {(showSeller || showDriver) && (
          <div className="flex flex-wrap gap-1">
            {showSeller && (seller.name
              ? contactButton(sellerColors, 'Vendedor', seller.name, seller.phone, <UserCheck className="h-3.5 w-3.5 shrink-0" />, canEdit ? openSeller : undefined)
              : addButton(sellerColors, 'Definir vendedor', <UserCheck className="h-3.5 w-3.5 shrink-0" />, openSeller))}
            {showDriver && (hasDriver
              ? contactButton(driverColors, 'Motorista', driverDisplayName || `#${driver.id}`, driverPhoneNumber, <VisibilityIcon className="h-3.5 w-3.5 shrink-0" />, canPickDriver ? openDriver : undefined)
              : addButton(driverColors, 'Motorista', <VisibilityIcon className="h-3.5 w-3.5 shrink-0" />, openDriver))}
          </div>
        )}
        {canEdit ? (
          <label className="block rounded-xl border-2 border-red-300 bg-red-50/70 p-1.5 shadow-sm">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-700">
              <FileText className="h-3 w-3 shrink-0" />
              Observações da {label}
            </span>
            <textarea
            value={isEditingNote ? viewNoteText : note}
            onFocus={() => {
              if (!isEditingNote) {
                setViewNoteText(note);
                setViewNotePoint(point);
              }
            }}
            onChange={event => {
              setViewNotePoint(point);
              setViewNoteText(event.target.value);
            }}
            onBlur={() => {
              if (isEditingNote) {
                saveNote();
                setViewNotePoint(null);
              }
            }}
            rows={3}
            placeholder={`Escreva as observações da ${label}...`}
            className="w-full resize-y rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-600 outline-none placeholder:font-medium placeholder:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          </label>
        ) : note.trim() ? (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-1.5">
            <span className="mb-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-700">
              <FileText className="h-3 w-3 shrink-0" />
              Observações da {label}
            </span>
            <p className="whitespace-pre-wrap break-words text-xs font-bold leading-snug text-red-600">{note}</p>
          </div>
        ) : null}
      </div>
    );
  };
  const renderDraftRoutePointActions = (point: 'pickup' | 'exchange' | 'delivery') => {
    if (!canEdit || !hasCustomerRoute) return null;
    const seller = getRouteSeller(point);
    const driver = getRouteDriver(point);
    const label = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
    const note = point === 'pickup'
      ? selectedPlace.pickupNotes || ''
      : point === 'exchange'
        ? selectedPlace.exchangeNotes || ''
        : selectedPlace.deliveryNotes || '';

    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setRouteSellerTarget(point);
              setIsSellerModalOpen(true);
            }}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-800 hover:bg-orange-100"
          >
            <UserCheck className="h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">
              {seller.name ? <><span>Vendedor</span><br /><span className="font-semibold">{seller.name}</span></> : 'Definir vendedor'}
            </span>
            {seller.name && <Edit3 className="h-2.5 w-2.5 shrink-0" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setRouteDriverTarget(point);
              setIsDriverSelectorOpen(true);
            }}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-800 hover:bg-emerald-100"
          >
            {driver.visibility === 'privado' ? <Lock className="h-3 w-3 shrink-0" /> : <Globe className="h-3 w-3 shrink-0" />}
            <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">
              {driver.name ? <><span>Motorista</span><br /><span className="font-semibold">{driver.name}</span></> : 'Motorista'}
            </span>
            {driver.name && <Edit3 className="h-2.5 w-2.5 shrink-0" />}
          </button>
        </div>
        <label className="block rounded-xl border-2 border-red-300 bg-red-50/70 p-1.5 shadow-sm">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-700">
            <FileText className="h-3 w-3 shrink-0" />
            Observações da {label}
          </span>
          <textarea
          ref={isNewOrderDraft && point === activeRoutePoint ? draftObservationRef : undefined}
          value={note}
          onChange={event => {
            if (isNewOrderDraft && point === activeRoutePoint) draftObservationEditedRef.current = true;
            const value = event.target.value;
            const routeNote = point === 'pickup'
              ? { pickupNotes: value }
              : point === 'exchange'
                ? { exchangeNotes: value }
                : { deliveryNotes: value };
            setSelectedPlace({
              ...selectedPlace,
              ...routeNote,
              ...(point === activeRoutePoint ? { observations: value } : {})
            });
            if (point === activeRoutePoint) setDraftOrderComment(value);
          }}
          rows={3}
          placeholder={`Escreva as observações da ${label}...`}
          className="w-full resize-y rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-600 outline-none placeholder:font-medium placeholder:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
        />
        </label>
      </div>
    );
  };

  // Primeira foto do local/encomenda para identificação visual imediata
  const rawFirstPhoto = customPhotos[0] || selectedPlace.imageUrl || selectedPlace.pickupPhotos?.[0] || null;
  const firstPhoto = rawFirstPhoto ? (formatPhotoUrl(rawFirstPhoto, 'md') || rawFirstPhoto) : null;

  // Handlers para seleção e cadastro de clientes / responsáveis
  const handleOpenCustomerSelector = (field: TargetFieldType) => {
    setSelectorTargetField(field);
    setIsCustomerSelectorOpen(true);
  };

  const handleSelectCustomer = (customer: Customer) => {
    if (!selectedPlace) return;

    if (selectorTargetField === 'customer') {
      const op = selectedPlace.operationType || 'coleta';
      const isGeneric = isUnnamedOrGenericPlace(selectedPlace);
      const placeName = selectedPlace.name;

      const tempPlace: Place = {
        ...selectedPlace,
        name: placeName,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerId: customer.id,
        customerAddress: customer.address || undefined,
        customerCoordinates: customer.coordinates || undefined
      };
      const resolved = getOrderLocationsForOperation(tempPlace, op, [customer, ...customers]);

      const updated: Partial<Place> = {
        name: placeName,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerId: customer.id,
        customerAddress: customer.address || undefined,
        customerCoordinates: customer.coordinates || undefined
      };

      if (resolved.canTraceRoute) {
        if (op === 'coleta') {
          // Coleta: o local de entrega é do cliente
          updated.pickupAddress = selectedPlace.address;
          updated.pickupCoordinates = selectedPlace.coordinates;
          updated.deliveryAddress = resolved.deliveryAddress;
          updated.deliveryCoordinates = resolved.deliveryCoordinates;
          updated.deliveryContact = customer.fullName;
          updated.deliveryPhone = customer.phone;
        } else if (op === 'entrega') {
          // Entrega: o local de coleta é do cliente
          updated.pickupAddress = resolved.pickupAddress;
          updated.pickupCoordinates = resolved.pickupCoordinates;
          updated.pickupContact = customer.fullName;
          updated.pickupPhone = customer.phone;
          updated.deliveryAddress = selectedPlace.address;
          updated.deliveryCoordinates = selectedPlace.coordinates;
        } else if (op === 'troca') {
          // Troca: coleta no cliente, troca no local de troca, entrega no cliente
          updated.pickupAddress = resolved.pickupAddress;
          updated.pickupCoordinates = resolved.pickupCoordinates;
          updated.pickupContact = customer.fullName;
          updated.pickupPhone = customer.phone;
          updated.exchangeAddress = selectedPlace.address;
          updated.exchangeCoordinates = selectedPlace.coordinates;
          updated.deliveryAddress = resolved.deliveryAddress;
          updated.deliveryCoordinates = resolved.deliveryCoordinates;
          updated.deliveryContact = customer.fullName;
          updated.deliveryPhone = customer.phone;
        }
      }

      updatePlaceDetails(selectedPlace.id, updated);
      setSelectedPlace({
        ...selectedPlace,
        ...updated
      });

      clearActiveRoute();
    } else {
      const updated = {
        managerName: customer.fullName,
        managerPhone: customer.phone,
        sellerName: customer.fullName,
        sellerPhone: customer.phone
      };
      updatePlaceDetails(selectedPlace.id, updated);
      setSelectedPlace({
        ...selectedPlace,
        ...updated
      });
    }

    setIsCustomerSelectorOpen(false);
  };

  const handleOpenRegistrationFromDrawer = (initialData?: Partial<Customer> | AgendaContact) => {
    setIsCustomerSelectorOpen(false);
    setRegistrationInitialData(initialData || null);
    setIsCustomerRegistrationOpen(true);
  };

  const handleSaveCustomerFromRegistration = async (newCustomer: Customer) => {
    const savedCustomer = await persistCustomer(newCustomer);
    if (!savedCustomer) {
      window.alert('Não foi possível salvar o endereço do cliente no banco de dados.');
      return;
    }

    // Vincula o cliente salvo ao pedido selecionado no mapa.
    if (selectedPlace) {
      if (selectorTargetField === 'customer') {
        const op = selectedPlace.operationType || 'coleta';
        const isGeneric = isUnnamedOrGenericPlace(selectedPlace);
        const placeName = selectedPlace.name;

        const tempPlace: Place = {
          ...selectedPlace,
          name: placeName,
          customerName: newCustomer.fullName,
          customerPhone: newCustomer.phone,
          customerId: savedCustomer.id,
          customerAddress: newCustomer.address || undefined,
          customerCoordinates: newCustomer.coordinates || undefined
        };
        const resolved = getOrderLocationsForOperation(tempPlace, op, [newCustomer, ...customers]);
        const updated: Partial<Place> = {
          name: placeName,
          customerName: newCustomer.fullName,
          customerPhone: newCustomer.phone,
          customerId: savedCustomer.id,
          customerAddress: newCustomer.address || undefined,
          customerCoordinates: newCustomer.coordinates || undefined
        };

        if (resolved.canTraceRoute) {
          if (op === 'coleta') {
            updated.pickupAddress = selectedPlace.address;
            updated.pickupCoordinates = selectedPlace.coordinates;
            updated.deliveryAddress = resolved.deliveryAddress;
            updated.deliveryCoordinates = resolved.deliveryCoordinates;
            updated.deliveryContact = newCustomer.fullName;
            updated.deliveryPhone = newCustomer.phone;
          } else if (op === 'entrega') {
            updated.pickupAddress = resolved.pickupAddress;
            updated.pickupCoordinates = resolved.pickupCoordinates;
            updated.pickupContact = newCustomer.fullName;
            updated.pickupPhone = newCustomer.phone;
            updated.deliveryAddress = selectedPlace.address;
            updated.deliveryCoordinates = selectedPlace.coordinates;
          } else if (op === 'troca') {
            updated.pickupAddress = resolved.pickupAddress;
            updated.pickupCoordinates = resolved.pickupCoordinates;
            updated.pickupContact = newCustomer.fullName;
            updated.pickupPhone = newCustomer.phone;
            updated.exchangeAddress = selectedPlace.address;
            updated.exchangeCoordinates = selectedPlace.coordinates;
            updated.deliveryAddress = resolved.deliveryAddress;
            updated.deliveryCoordinates = resolved.deliveryCoordinates;
            updated.deliveryContact = newCustomer.fullName;
            updated.deliveryPhone = newCustomer.phone;
          }
        }

        updatePlaceDetails(selectedPlace.id, updated);
        setSelectedPlace({
          ...selectedPlace,
          ...updated
        });

        clearActiveRoute();
      } else {
        const updated = {
          managerName: newCustomer.fullName,
          managerPhone: newCustomer.phone,
          sellerName: newCustomer.fullName,
          sellerPhone: newCustomer.phone
        };
        updatePlaceDetails(selectedPlace.id, updated);
        setSelectedPlace({
          ...selectedPlace,
          ...updated
        });
      }
    }

    setIsCustomerRegistrationOpen(false);
    setRegistrationInitialData(null);
  };

  // Informações do motorista direcionado (calculadas para exibição no card)
  const assignedDriverDisplayName = 
    selectedPlace?.assignedDriverName || 
    assignedDriverObj?.name || 
    (selectedPlace?.assignedDriverPhone ? `Motorista (${selectedPlace.assignedDriverPhone})` : 'Motorista Atribuído');

  const assignedVehicleEmoji = 
    assignedDriverObj?.vehicleType === 'moto' ? '🏍️' 
    : assignedDriverObj?.vehicleType === 'utilitario' ? '🚚' 
    : '🚗';

  const assignedDriverSubtitle = 
    assignedDriverObj?.vehicleModel 
      ? `${assignedDriverObj.vehicleModel}${assignedDriverObj.vehiclePlate ? ` • ${assignedDriverObj.vehiclePlate}` : ''}`
      : (selectedPlace?.assignedDriverPhone || 'Motorista em trânsito');

  // Observações do local (apenas se preenchido)
  const observations = (selectedPlace.observations || selectedPlace.driverNotes || selectedPlace.description || '').trim();

  const closingTime = getClosingTime(selectedPlace, currentTime);
  const openingTime = getOpeningTime(selectedPlace);
  const timeUntilClose = getTimeUntilClosing(closingTime, currentTime);
  let isOpen = true;
  if (selectedPlace.openNow === false) {
    isOpen = false;
  } else if (timeUntilClose && timeUntilClose.text === 'fechado') {
    isOpen = false;
  } else if (openingTime && closingTime) {
    const currentM = currentTime.getHours() * 60 + currentTime.getMinutes();
    const openMatch = openingTime.match(/(\d{1,2}):(\d{2})/);
    const closeMatch = closingTime.match(/(\d{1,2}):(\d{2})/);
    if (openMatch && closeMatch) {
      const openM = parseInt(openMatch[1], 10) * 60 + parseInt(openMatch[2], 10);
      const closeM = parseInt(closeMatch[1], 10) * 60 + parseInt(closeMatch[2], 10);
      if (closeM > openM) {
        if (currentM < openM || currentM >= closeM) isOpen = false;
      } else {
        // Fecha na madrugada
        if (currentM < openM && currentM >= closeM) isOpen = false;
      }
    }
  }

  const isTrocaOp = operationType === 'troca' || orderStage === 'troca' || isExchange;
  const isColetaOp = !isTrocaOp && (operationType === 'coleta' || orderStage === 'coleta');

  const operationConfig = isTrocaOp
    ? {
        title: 'Registrar Troca',
        label: 'Troca',
        btnBg: 'bg-[#7C3AED] hover:bg-[#6D28D9] shadow-md shadow-purple-600/25',
        icon: Repeat,
        badgeBg: 'bg-[#7C3AED]',
        hint: 'Item coletado na origem. Entregar o novo e recolher o item a ser trocado com o cliente.'
      }
    : isColetaOp
    ? {
        title: 'Registrar Coleta',
        label: 'Coleta',
        btnBg: 'bg-[#0B5187] hover:bg-[#083D66] shadow-md shadow-blue-900/25',
        icon: ArrowDownToLine,
        badgeBg: 'bg-[#0B5187]',
        hint: 'Local de coleta aprovado. Após a coleta, o sistema mostrará o local de entrega.'
      }
    : {
        title: 'Registrar Entrega',
        label: 'Entrega',
        btnBg: 'bg-[#FF5E00] hover:bg-[#E05300] shadow-md shadow-orange-500/25',
        icon: Package,
        badgeBg: 'bg-[#FF5E00]',
        hint: 'Mercadoria coletada na origem. Realizar a entrega final no destinatário.'
      };

  const OperationIcon = operationConfig.icon;

  // Configuração do Tipo de Veículo com Cores Vivas e Diferenciadas
  const vehicleType: VehicleCollectionType = selectedPlace.vehicleType || 'moto';
  const vehicleConfig = {
    moto: {
      label: 'Moto',
      icon: Bike,
      bg: 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
    },
    carro: {
      label: 'Carro',
      icon: Car,
      bg: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-300 shadow-2xs'
    },
    utilitario: {
      label: 'Utilitário',
      icon: Truck,
      bg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-300 shadow-2xs'
    }
  }[vehicleType] || {
    label: 'Moto',
    icon: Bike,
    bg: 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
  };
  const VehicleIcon = vehicleConfig.icon;

  // Configuração do Tipo de Encomenda / Embalagem com Suporte Dinâmico a Novos Tipos
  const packageTypeStr = (selectedPlace.packageType || 'caixa').toString();
  const packageConfig = (() => {
    const lower = packageTypeStr.toLowerCase();
    if (lower === 'caixa') {
      return { label: 'Caixa', icon: Package, bg: 'bg-blue-100 hover:bg-blue-200 text-blue-950 border-blue-300 shadow-2xs' };
    }
    if (lower === 'sacola') {
      return { label: 'Sacola', icon: ShoppingBag, bg: 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-300 shadow-2xs' };
    }
    if (lower === 'envelope') {
      return { label: 'Envelope', icon: Mail, bg: 'bg-purple-100 hover:bg-purple-200 text-purple-950 border-purple-300 shadow-2xs' };
    }
    if (lower === 'documento') {
      return { label: 'Documento', icon: FileText, bg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-300 shadow-2xs' };
    }
    if (lower === 'cilindro') {
      return { label: 'Cilindro', icon: Layers, bg: 'bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border-cyan-300 shadow-2xs' };
    }
    return {
      label: packageTypeStr.charAt(0).toUpperCase() + packageTypeStr.slice(1),
      icon: Package,
      bg: 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
    };
  })();
  const PackageIcon = packageConfig.icon;

  // Compartilha a localização com o texto completo de informações do local e telefone
  const handleShareLocation = async () => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const opLabel = operationConfig.label.toUpperCase();
    
    // Formata o telefone para exibição clara
    const formatPhone = (phone?: string) => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 13 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
      }
      if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
      return phone;
    };

    const clientPhoneFormatted = formatPhone(customerPhone);
    const respPhoneFormatted = formatPhone(responsiblePhone);
    const isStreet = isStreetOrAddress(selectedPlace);
    const horarioText = isStreet
      ? '📍 Tipo: Via pública / Endereço (Acesso livre 24h)'
      : isOpen
      ? `🕒 Horário: Aberto ⋅ Fecha às ${closingTime}${timeUntilClose && timeUntilClose.text !== 'fechado' ? ` (${timeUntilClose.text})` : ''}`
      : `🕒 Horário: Fechado ⋅ Abre às ${openingTime || '08:00'}`;

    const shareText = `📍 *${selectedPlace.name}*
🏷️ Operação: ${opLabel}
${horarioText}
👤 Cliente: ${customerName || 'Não informado'}
📞 Tel. Cliente: ${clientPhoneFormatted || 'Não informado'}
📋 Responsável: ${responsibleName || 'Não informado'}
📱 Tel. Responsável: ${respPhoneFormatted || 'Não informado'}
🏠 Endereço: ${selectedPlace.address}${observations ? `\n📝 Observações: ${observations}` : ''}
🗺️ Localização no Mapa: ${mapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedPlace.name,
          text: shareText,
          url: mapsUrl
        });
        return;
      } catch (err) {
        // Usuário cancelou ou navegador não suportou janela de compartilhamento
      }
    }

    // Fallback garantido e seguro: copia para a área de transferência
    try {
      if (navigator.clipboard && document.hasFocus && document.hasFocus()) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error('Clipboard writeText unavailable or unfocused');
      }
    } catch {
      // Fallback usando textarea temporária caso o iframe não tenha foco
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // Fallback silencioso sem quebrar
      }
    }
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 2500);
  };

  const executeDirectNavigation = (targetApp: 'google_maps' | 'waze', saveAsDefaultChoice = false) => {
    if (!selectedPlace) return;
    const { lat, lng } = selectedPlace.coordinates;

    if (saveAsDefaultChoice) {
      setDefaultNavApp(targetApp);
    }

    // 1. Traça a rota animada no mapa interno estilo Uber somente quando clica para ir no GPS
    calculateRouteToPlace(selectedPlace);

    // Avisa a central (admin/atendente/terminal) que o motorista está a caminho
    if (isDriverRole) {
      void realtimeAssignmentService.markEnRoute(selectedPlace.id, selectedPlace.operationType, true).catch(() => {});
      setNavSession({
        placeId: selectedPlace.id,
        operationType: selectedPlace.operationType || 'coleta',
        name: selectedPlace.name || 'Local',
        lat,
        lng,
        startedAt: Date.now()
      });
    }
    // 2. Fecha o card de detalhes suavemente mantendo a rota visível na tela
    triggerClose();
    setShowNavChooser(false);

    // 3. Abre direto na navegação
    if (targetApp === 'google_maps' || targetApp === 'waze') {
      openExternalNavigation(targetApp, lat, lng);
      return;
    }
  };

  const handleStartNavigation = (targetApp?: 'google_maps' | 'waze') => {
    if (targetApp) {
      executeDirectNavigation(targetApp, saveAsDefaultNav);
      return;
    }

    // Se já tiver aplicativo padrão configurado (Google Maps ou Waze), navega direto!
    if (defaultNavApp === 'google_maps' || defaultNavApp === 'waze') {
      executeDirectNavigation(defaultNavApp, false);
      return;
    }

    // Se não tem padrão ainda, abre o seletor no aplicativo
    setShowNavChooser(true);
  };

  // Alternância do tipo de operação com a regra:
  // - Coleta: o local de entrega é do cliente (Origem: Local do mapa -> Destino: Cliente)
  // - Entrega: o local de coleta é do cliente (Origem: Cliente -> Destino: Local do mapa)
  // - Troca: Coleta no cliente -> Troca no local de troca -> Entrega no cliente
  const handleApplyOperationType = (newOp: OperationType) => {
    if (!selectedPlace) return;
    const tempPlace: Place = {
      ...selectedPlace,
      operationType: newOp,
      orderStage: newOp,
      isExchangeOrder: newOp === 'troca'
    };
    const resolved = getOrderLocationsForOperation(tempPlace, newOp, customers);

    const updated: Partial<Place> = {
      operationType: newOp,
      orderStage: newOp,
      isExchangeOrder: newOp === 'troca'
    };

    if (resolved.canTraceRoute) {
      if (newOp === 'coleta') {
        updated.pickupAddress = selectedPlace.address;
        updated.pickupCoordinates = selectedPlace.coordinates;
        updated.deliveryAddress = resolved.deliveryAddress;
        updated.deliveryCoordinates = resolved.deliveryCoordinates;
      } else if (newOp === 'entrega') {
        updated.pickupAddress = resolved.pickupAddress;
        updated.pickupCoordinates = resolved.pickupCoordinates;
        updated.deliveryAddress = selectedPlace.address;
        updated.deliveryCoordinates = selectedPlace.coordinates;
      } else if (newOp === 'troca') {
        updated.pickupAddress = resolved.pickupAddress;
        updated.pickupCoordinates = resolved.pickupCoordinates;
        updated.exchangeAddress = selectedPlace.address;
        updated.exchangeCoordinates = selectedPlace.coordinates;
        updated.deliveryAddress = resolved.deliveryAddress;
        updated.deliveryCoordinates = resolved.deliveryCoordinates;
      }
    }

    updatePlaceDetails(selectedPlace.id, updated);
    setShowOperationPicker(false);

    clearActiveRoute();
  };

  // Cria um novo pedido/rascunho a partir do local/POI atualmente visualizado
  const handleAddNewOrderAtCurrentPlace = () => {
    if (!selectedPlace || isDriverRole) return;
    const tempId = `pedido-${Date.now()}`;
    const orderCode = `EZ-${Math.floor(1000 + Math.random() * 9000)}-GO`;
    const curOps = operationsFilter;
    const initialOp: OperationType = curOps?.coleta ? 'coleta' : curOps?.entrega ? 'entrega' : curOps?.troca ? 'troca' : 'coleta';

    const newDraft: Place = {
      ...selectedPlace,
      id: tempId,
      orderCode,
      operationType: initialOp,
      orderStage: initialOp,
      customerName: '',
      customerPhone: '',
      customerId: undefined,
      customerAddress: undefined,
      customerCoordinates: undefined,
      assignedDriverId: undefined,
      assignedDriverName: undefined,
      assignedDriverPhone: undefined,
      acceptedByDriver: false,
      orderVisibility: 'publico',
      pickupVisibility: 'publico',
      exchangeVisibility: 'publico',
      deliveryVisibility: 'publico',
      pickupAssignedDriverId: undefined,
      pickupAssignedDriverName: undefined,
      pickupAssignedDriverPhone: undefined,
      exchangeAssignedDriverId: undefined,
      exchangeAssignedDriverName: undefined,
      exchangeAssignedDriverPhone: undefined,
      deliveryAssignedDriverId: undefined,
      deliveryAssignedDriverName: undefined,
      deliveryAssignedDriverPhone: undefined,
      observations: '',
      driverNotes: `Novo pedido no local ${selectedPlace.name}.`,
      pickupAddress: initialOp === 'coleta' ? selectedPlace.address : undefined,
      pickupCoordinates: initialOp === 'coleta' ? selectedPlace.coordinates : undefined,
      deliveryAddress: initialOp === 'entrega' ? selectedPlace.address : undefined,
      deliveryCoordinates: initialOp === 'entrega' ? selectedPlace.coordinates : undefined,
      exchangeAddress: initialOp === 'troca' ? selectedPlace.address : undefined,
      exchangeCoordinates: initialOp === 'troca' ? selectedPlace.coordinates : undefined
    };

    setSelectedPlace(newDraft);
    setIsEditingOrder(true);
  };

  // Salva a encomenda/pedido no banco de dados e mapa conforme as regras de Coleta, Entrega e Troca
  const handleSavePlaceOrder = async () => {
    if (!selectedPlace || isDriverRole || isSavingOrder || isFinalizingPhoto) return;
    const op = selectedPlace.operationType || 'coleta';
    if (isNewOrderDraft && isPlaceNameInvalid) {
      setShowPlaceNameError(true);
      placeNameInputRef.current?.focus();
      return;
    }
    let uploadedPhotos: { path?: string; error?: string; stage: 'coleta' | 'entrega' }[] = [];
    if (isNewOrderDraft && photoUploadsRef.current.size) {
      setIsSavingOrder(true);
      uploadedPhotos = await Promise.all(photoUploadsRef.current.values());
      const failedUpload = uploadedPhotos.find(upload => upload.error);
      if (failedUpload) {
        setIsSavingOrder(false);
        window.alert(`Não foi possível salvar a foto: ${failedUpload.error}. Remova a foto e tente novamente.`);
        return;
      }
    }
    const finalObs = isNewOrderDraft && !hasCustomerRoute
      ? draftOrderComment
      : isEditingObservations ? editedObservations : (selectedPlace.observations || '');
    const draftRouteNotes: Partial<Place> = isNewOrderDraft && !hasCustomerRoute
      ? op === 'troca'
        ? { exchangeNotes: draftOrderComment }
        : op === 'entrega'
          ? { deliveryNotes: draftOrderComment }
          : { pickupNotes: draftOrderComment }
      : {};
    const updated = resolveOrderLocationsForSave({
      ...selectedPlace,
      name: isNewOrderDraft ? draftPlaceName.trim() : selectedPlace.name,
      pickupPhotos: Array.from(new Set([...(selectedPlace.pickupPhotos || []), ...uploadedPhotos.filter(upload => upload.stage === 'coleta' && upload.path).map(upload => upload.path!)].map(photo => formatPhotoUrl(photo, 'md') || photo))),
      deliveryPhotos: Array.from(new Set([...(selectedPlace.deliveryPhotos || []), ...uploadedPhotos.filter(upload => upload.stage === 'entrega' && upload.path).map(upload => upload.path!)].map(photo => formatPhotoUrl(photo, 'md') || photo))),
      observations: finalObs,
      ...draftRouteNotes,
      ...(isEditingObservations
        ? {
            pickupNotes: editedPickupNotes,
            exchangeNotes: selectedPlace.isExchangeOrder || op === 'troca' ? editedExchangeNotes : undefined,
            deliveryNotes: editedDeliveryNotes
          }
        : {})
    }, customers, settingsService.getSettings().defaultOrderLocation);

    clearActiveRoute();
    if (isAlreadySaved) {
      updatePlaceDetails(selectedPlace.id, updated);
      setSelectedPlace(updated);
    } else {
      setIsSavingOrder(true);
      try {
        const saved = await addNewOrder(updated);
        if (!saved) return;
      } finally {
        setIsSavingOrder(false);
      }
    }
    if (isEditingObservations) {
      setIsEditingObservations(false);
    }
    setEditingRouteComment(null);
    setIsEditingOrder(false);
    setSaveSuccessToast(!isAlreadySaved ? '✅ Encomenda adicionada no mapa!' : '✅ Alterações salvas!');
    setTimeout(() => setSaveSuccessToast(null), 3500);

    // Quando clicar em adicionar pedido o dialog deve fechar
    triggerClose();
  };

  const handleOpenGoogleMaps = () => {
    executeDirectNavigation('google_maps', false);
  };

  const handleWhatsApp = (targetPhone: string, _targetName?: string) => {
    let clean = targetPhone.replace(/\D/g, '');
    if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
      clean = `55${clean}`;
    }
    if (typeof window !== 'undefined' && window.AndroidApp?.openWhatsApp) {
      window.AndroidApp.openWhatsApp(clean, '');
    } else {
      window.open(`https://wa.me/${clean}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopy = async () => {
    const textToCopy = `${selectedPlace.name} - ${selectedPlace.address}`;
    try {
      if (navigator.clipboard && document.hasFocus && document.hasFocus()) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        throw new Error('Clipboard writeText unavailable or unfocused');
      }
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // Fallback silencioso
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const transformStyle: React.CSSProperties = {
    transform: !isVisible || isClosing 
      ? 'translateY(105%)' 
      : `translateY(${dragY}px)`,
    opacity: isClosing ? 0.4 : 1,
    transition: isDragging 
      ? 'none' 
      : 'transform 0.28s cubic-bezier(0.18, 0.9, 0.3, 1), opacity 0.22s ease-out'
  };

  
  return { saveSuccessToast, driverToast, setSaveSuccessToast, setDriverToast, galleryInputRef, handleGalleryFileSelected, cardRef, transformStyle, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, isNewOrderDraft, canEdit, handleLockedEditAttempt, setShowOperationPicker, setShowSchedulePicker, setShowVehiclePicker, setShowPackagePicker, operationType, showOperationPicker, handleApplyOperationType, placeDateBadge, showSchedulePicker, updatePlaceDetails, selectedPlace, scheduleCalendarInputRef, vehicleConfig, VehicleIcon, showVehiclePicker, vehicleType, packageConfig, PackageIcon, showPackagePicker, allAvailablePackageTypes, newCustomPackageInput, setNewCustomPackageInput, handleAddCustomPackageType, setShowCustomCargoDetails, showCustomCargoDetails, dimLength, setDimLength, dimWidth, dimHeight, setDimWidth, setDimHeight, isAlreadySaved, isEditingOrder, isDriverRole, setIsEditingOrder, triggerClose, contentScrollRef, registeredOutcome, operationConfig, openFullScreenCamera, firstPhoto, openPhotoViewer, placeNameInputRef, draftPlaceName, placeNameDraftRef, setDraftPlaceName, showPlaceNameError, isPlaceNameInvalid, distanceFormatted, closingTime, openingTime, isOpen, timeUntilClose, hasCustomerRoute, handleOpenCustomerSelector, customerName, setRouteSellerTarget, setIsSellerModalOpen, responsibleName, setRouteDriverTarget, setIsDriverSelectorOpen, selectedDriverName, hasCustomer, handleWhatsApp, customerPhone, renderViewRoutePointActions, activeRoutePoint, showCounterpartButton, setIsCounterpartPickerOpen, counterpartLabel, isCounterpartPickerOpen, counterpartQuery, setCounterpartQuery, counterpartResults, applyCounterpartLocation, activeRoute, orderResolvedLocations, renderRoutePointDetails, renderDraftRoutePointActions, clearActiveRoute, canManageDriverAssignment, handleSetVisibilityPublic, handleSetVisibilityPrivate, assignedVehicleEmoji, assignedDriverDisplayName, assignedDriverSubtitle, handleRemoveDriverFromPlace, setShowRefusalModal, draftObservationRef, draftOrderComment, draftObservationEditedRef, setDraftOrderComment, setSelectedPlace, showNavChooser, setShowNavChooser, executeDirectNavigation, saveAsDefaultNav, defaultNavApp, setSaveAsDefaultNav, setDefaultNavApp, isActionsMenuOpen, setIsActionsMenuOpen, setOperationStatus, setIsFinalDetailsOpen, setRefusalReason, setRefusalNotes, handleShareLocation, sharedToast, currentRole, isClaimingOrder, handleClaimThisOrder, handleSavePlaceOrder, isSavingOrder, handleStartNavigation, nativeCameraInputRef, isFullScreenCameraOpen, isFlashing, closeFullScreenCamera, operationStatus, setFlashMode, flashMode, handleFlipCamera, setShowFailReasonPicker, failReason, showFailReasonPicker, setFailReason, handleUpdateVolumeQuantity, volumeQuantity, setShowObservationSheet, notes, receiverName, handleViewfinderTap, cameraError, isFinalizingPhoto, handleFinalizeRegistration, videoRef, zoomLevel, focusPoint, setZoomLevel, showObservationSheet, setReceiverName, setNotes, photoErrorMsg, customPhotos, handleDeletePhoto, handleTakeShutterPhoto, showOperationModal, OperationIcon, setShowOperationModal, setPhotoErrorMsg, setSelectedPackage, selectedPackage, volumesCount, volumeQuantityInput, handleVolumeInputChange, handleVolumeInputBlur, handleSaveOperation, farWarning, setFarWarning, showRefusalModal, isSubmittingRefusal, refusalReason, refusalNotes, handleConfirmRefusal, isSellerModalOpen, routeSellerTarget, getRouteSeller, responsiblePhone, handleSaveSellerResponsible, isCustomerSelectorOpen, setIsCustomerSelectorOpen, selectorTargetField, handleSelectCustomer, handleOpenRegistrationFromDrawer, isCustomerRegistrationOpen, setIsCustomerRegistrationOpen, handleSaveCustomerFromRegistration, registrationInitialData, isDriverSelectorOpen, routeDriverTarget, handleSelectDriverForRoutePoint, handleSelectDriverForPlace, handleRemoveDriverFromRoutePoint, drivers, getRouteDriver, handleDraftVisibilityChange, isFinalDetailsOpen };

}
