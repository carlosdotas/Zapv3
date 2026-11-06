import React, { useCallback } from 'react';
import { Place } from '../../types/map';
import { api } from '../../services/api';
import { scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';
import { resolvePlaceId, isTempPedidoNumber } from '../mapWorkflow';

interface Dependencies {
  allPlaces: MapContextType['allPlaces'];
  selectedPlace: MapContextType['selectedPlace'];
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSavedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
  currentRole: MapContextType['currentRole'];
}

export function useOrderEditing({ allPlaces, selectedPlace, setAllPlaces, setSavedPlaces, setSelectedPlace, currentRole }: Dependencies) {
const updatePlaceDetails = useCallback(async (placeId: string, partial: Partial<Place>): Promise<boolean> => {
    const currentPlace = allPlaces.find(place => place.id === placeId) ||
      (selectedPlace?.id === placeId ? selectedPlace : undefined);
    const operation = partial.operationType || currentPlace?.operationType ||
      (placeId.match(/-(coleta|troca|entrega|retorno)$/)?.[1] === 'troca' ? 'troca'
        : placeId.match(/-(coleta|troca|entrega|retorno)$/)?.[1] === 'coleta' ? 'coleta' : 'entrega');
    const routePoint = operation === 'coleta' ? 'pickup' : operation === 'troca' ? 'exchange' : 'delivery';
    const routeFields = {
      pickup: { visibility: 'pickupVisibility', driverId: 'pickupAssignedDriverId', driverName: 'pickupAssignedDriverName', driverPhone: 'pickupAssignedDriverPhone', sellerName: 'pickupSellerName', sellerPhone: 'pickupSellerPhone', notes: 'pickupNotes' },
      exchange: { visibility: 'exchangeVisibility', driverId: 'exchangeAssignedDriverId', driverName: 'exchangeAssignedDriverName', driverPhone: 'exchangeAssignedDriverPhone', sellerName: 'exchangeSellerName', sellerPhone: 'exchangeSellerPhone', notes: 'exchangeNotes' },
      delivery: { visibility: 'deliveryVisibility', driverId: 'deliveryAssignedDriverId', driverName: 'deliveryAssignedDriverName', driverPhone: 'deliveryAssignedDriverPhone', sellerName: 'deliverySellerName', sellerPhone: 'deliverySellerPhone', notes: 'deliveryNotes' }
    } as const;
    const activeFields = routeFields[routePoint];
    const resolvedPartial: Partial<Place> = { ...partial };
    const hasField = (field: keyof Place) => Object.prototype.hasOwnProperty.call(partial, field);
    const setActiveField = (field: keyof Place, value: unknown) => {
      (resolvedPartial as Record<string, unknown>)[field] = value;
    };

    if (hasField('orderVisibility')) setActiveField(activeFields.visibility, partial.orderVisibility);
    if (hasField('assignedDriverId')) setActiveField(activeFields.driverId, partial.assignedDriverId || '');
    if (hasField('assignedDriverName')) setActiveField(activeFields.driverName, partial.assignedDriverName || '');
    if (hasField('assignedDriverPhone')) setActiveField(activeFields.driverPhone, partial.assignedDriverPhone || '');
    if (hasField('sellerName') || hasField('responsibleName')) {
      setActiveField(activeFields.sellerName, partial.sellerName ?? partial.responsibleName ?? '');
    }
    if (hasField('sellerPhone') || hasField('responsiblePhone')) {
      setActiveField(activeFields.sellerPhone, partial.sellerPhone ?? partial.responsiblePhone ?? '');
    }
    if ((hasField('observations') || hasField('driverNotes')) && !hasField(activeFields.notes)) {
      setActiveField(activeFields.notes, partial.observations ?? partial.driverNotes ?? '');
    }
    const resolvedPlace = { ...(currentPlace || {}), ...resolvedPartial } as Place;

    setAllPlaces(prev => {
      const next = prev.map(p => p.id === placeId ? { ...p, ...resolvedPartial } : p);
      scheduleStorageSave('encomendaszap_all_places', next);
      return next;
    });

    setSavedPlaces(prev => {
      const next = prev.map(p => p.id === placeId ? { ...p, ...resolvedPartial } : p);
      scheduleStorageSave('encomendaszap_saved_places', next);
      return next;
    });

    setSelectedPlace(prev => {
      if (prev && prev.id === placeId) {
        return { ...prev, ...resolvedPartial };
      }
      return prev;
    });

    // Sincroniza atualização de pedido no servidor (Motoristas NÃO podem editar pedidos)
    const isDriver = currentRole === 'motorista' || localStorage.getItem('encomendaszap_user_role') === 'motorista';
    if (isDriver) {
      return false;
    }

    const numId = resolvePlaceId(placeId).match(/pedido-(\d+)/)?.[1] || placeId.match(/\d+/)?.[0];
    if (numId && !isTempPedidoNumber(numId)) {
      try {
        const result = await api.savePedido({
        id: numId,
        ...(partial.customerName !== undefined ? { cliente: partial.customerName } : {}),
        ...(partial.customerPhone !== undefined ? { phone: partial.customerPhone } : {}),
        // orderStage (coleta/troca/entrega/retorno) é só a visão da parada ativa no mapa, não a etapa do banco.
        // Enviá-lo como etapa fazia o backend gravar "pendente" e reabrir pedidos já entregues.
        ...(partial.orderStage === 'concluido' ? { etapa: 'entregue' } : {}),
        ...(partial.operationType && !partial.orderStage ? { tipo_encomenda: partial.operationType } : {}),
        ...(partial.vehicleType ? { tipo_veiculo: partial.vehicleType } : {}),
        ...((partial.driverNotes !== undefined || partial.observations !== undefined)
          ? { detalhes: partial.observations ?? partial.driverNotes ?? '' }
          : {}),
        ...(partial.price !== undefined ? { total: partial.price } : {}),
        ...(partial.name ? { local: partial.name } : {}),
        ...(partial.pickupName ? { coleta_nome: partial.pickupName, coleta_local: partial.pickupName } : {}),
        ...(partial.pickupAddress ? { coleta_endereco: partial.pickupAddress } : {}),
        ...(partial.pickupCoordinates?.lat ? { coleta_lat: partial.pickupCoordinates.lat } : {}),
        ...(partial.pickupCoordinates?.lng ? { coleta_lng: partial.pickupCoordinates.lng } : {}),
        ...(partial.pickupContact ? { coleta_contato: partial.pickupContact } : {}),
        ...(partial.pickupPhone ? { coleta_phone: partial.pickupPhone } : {}),
        ...(partial.pickupNotes !== undefined ? { coleta_obs: partial.pickupNotes, pickupNotes: partial.pickupNotes } : {}),
        ...(partial.deliveryName ? { entrega_nome: partial.deliveryName, entrega_local: partial.deliveryName } : {}),
        ...(partial.deliveryAddress ? { entrega_endereco: partial.deliveryAddress } : {}),
        ...(partial.deliveryCoordinates?.lat ? { entrega_lat: partial.deliveryCoordinates.lat } : {}),
        ...(partial.deliveryCoordinates?.lng ? { entrega_lng: partial.deliveryCoordinates.lng } : {}),
        ...(partial.deliveryContact ? { entrega_contato: partial.deliveryContact } : {}),
        ...(partial.deliveryPhone ? { entrega_phone: partial.deliveryPhone } : {}),
        ...(partial.deliveryNotes !== undefined ? { entrega_obs: partial.deliveryNotes, deliveryNotes: partial.deliveryNotes } : {}),
        ...(partial.exchangeName ? { troca_nome: partial.exchangeName } : {}),
        ...(partial.exchangeAddress ? { troca_endereco: partial.exchangeAddress } : {}),
        ...(partial.exchangeCoordinates?.lat ? { troca_lat: partial.exchangeCoordinates.lat } : {}),
        ...(partial.exchangeCoordinates?.lng ? { troca_lng: partial.exchangeCoordinates.lng } : {}),
        ...(partial.exchangeNotes !== undefined ? { troca_obs: partial.exchangeNotes, exchangeNotes: partial.exchangeNotes } : {}),
        ...({
          pickupVisibility: resolvedPlace.pickupVisibility,
          pickupAssignedDriverId: resolvedPlace.pickupAssignedDriverId ?? '',
          pickupAssignedDriverPhone: resolvedPlace.pickupAssignedDriverPhone ?? '',
          pickupAssignedDriverName: resolvedPlace.pickupAssignedDriverName ?? '',
          pickupSellerName: resolvedPlace.pickupSellerName ?? '',
          pickupSellerPhone: resolvedPlace.pickupSellerPhone ?? '',
          exchangeVisibility: resolvedPlace.exchangeVisibility,
          exchangeAssignedDriverId: resolvedPlace.exchangeAssignedDriverId ?? '',
          exchangeAssignedDriverPhone: resolvedPlace.exchangeAssignedDriverPhone ?? '',
          exchangeAssignedDriverName: resolvedPlace.exchangeAssignedDriverName ?? '',
          exchangeSellerName: resolvedPlace.exchangeSellerName ?? '',
          exchangeSellerPhone: resolvedPlace.exchangeSellerPhone ?? '',
          deliveryVisibility: resolvedPlace.deliveryVisibility,
          deliveryAssignedDriverId: resolvedPlace.deliveryAssignedDriverId ?? '',
          deliveryAssignedDriverPhone: resolvedPlace.deliveryAssignedDriverPhone ?? '',
          deliveryAssignedDriverName: resolvedPlace.deliveryAssignedDriverName ?? '',
          deliverySellerName: resolvedPlace.deliverySellerName ?? '',
          deliverySellerPhone: resolvedPlace.deliverySellerPhone ?? ''
        })
        });
        if (!result.success) {
          console.warn(`[updatePlaceDetails] O servidor recusou salvar o pedido ${numId}:`, result.message);
          return false;
        }
      } catch (error) {
        console.warn(`[updatePlaceDetails] Falha ao salvar o pedido ${numId}:`, error);
        return false;
      }
    }
    return true;
  }, [allPlaces, selectedPlace, currentRole]);
  return { updatePlaceDetails };
}
