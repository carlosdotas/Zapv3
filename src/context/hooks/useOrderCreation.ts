import React, { useCallback } from 'react';
import { Place } from '../../types/map';
import { Customer } from '../../types/customer';
import { customerOrderStatsService } from '../../services/customerOrderStatsService';
import { api } from '../../services/api';
import { isTemporaryOrderId, getOrderKey } from '../../utils/orderIds';
import { runOncePerKey } from '../../utils/orderSync';
import { sanitizeNewOrderAssignments } from '../../utils/newOrderAssignment';
import { buildMapOrderPayload } from '../../services/mapOrderPayload';
import { scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';
import { tempPedidoIdMap } from '../mapWorkflow';

interface Dependencies {
  currentRole: MapContextType['currentRole'];
  user: MapContextType['user'];
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
  flyToLocation: MapContextType['flyToLocation'];
  updatePlaceDetails: MapContextType['updatePlaceDetails'];
  orderMutationVersion: React.MutableRefObject<number>;
  setSavedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  pendingOrderCreations: React.MutableRefObject<Map<string, Promise<boolean>>>;
}

export function useOrderCreation({ currentRole, user, setAllPlaces, setSelectedPlace, flyToLocation, updatePlaceDetails, orderMutationVersion, setSavedPlaces, setCustomers, pendingOrderCreations }: Dependencies) {
const addOrderDraft = useCallback((newPlace: Place): boolean => {
    if (currentRole === 'motorista' || user?.userRole === 'motorista') {
      console.warn('[addOrderDraft] Motoristas não possuem permissão para adicionar pedidos.');
      return false;
    }

    setAllPlaces(prev => {
      const next = [newPlace, ...prev.filter(place => place.id !== newPlace.id)];
      scheduleStorageSave('encomendaszap_all_places', next);
      return next;
    });
    setSelectedPlace(newPlace);
    flyToLocation(newPlace.coordinates, 16);
    return true;
  }, [currentRole, user, flyToLocation]);

  const saveNewOrder = useCallback(async (rawPlace: Place): Promise<boolean> => {
    const newPlace = sanitizeNewOrderAssignments(rawPlace);
    // Regra de permissão: Motorista NÃO PODE adicionar pedidos
    if (currentRole === 'motorista' || user?.userRole === 'motorista') {
      console.warn('[addNewOrder] Motoristas não possuem permissão para adicionar pedidos.');
      return false;
    }

    // Se o pedido já é um pedido existente no sistema, apenas atualiza para evitar duplicação de marker
    const persistedIdMatch = /^pedido-(\d+)(?:-(?:coleta|entrega|troca|retorno))?$/i.exec(newPlace.id);
    const hasPersistedId = Boolean(persistedIdMatch && Number(persistedIdMatch[1]) < 1_000_000_000_000);
    const isExistingOrder = !isTemporaryOrderId(newPlace.id) && hasPersistedId;
    if (isExistingOrder) {
      return updatePlaceDetails(rawPlace.id, newPlace);
    }

    // O banco é a fonte única: o pedido só entra no mapa depois de gravado (/pedidos/save)
    try {
      const res = await api.savePedido(buildMapOrderPayload(newPlace));
      if (!res.success || !res.data?.id) {
        window.alert(res.message || 'Não foi possível salvar o pedido. Verifique a conexão e tente novamente.');
        return false;
      }

      const savedId = String(res.data.id);
      const serverPlaceId = `pedido-${savedId}`;
      const serverOrderCode = `EZ-${savedId}-GO`;
      orderMutationVersion.current += 1;
      tempPedidoIdMap.set(newPlace.id, serverPlaceId);
      const persistedPlace: Place = { ...newPlace, id: serverPlaceId, orderCode: serverOrderCode };
      const persistedKey = getOrderKey(persistedPlace);
      // Remove qualquer rascunho, variante de coleta/entrega ou cópia para manter rigorosamente 1 único pedido
      setAllPlaces(prev => {
        const next = [persistedPlace, ...prev.filter(p => p.id !== newPlace.id && p.id !== serverPlaceId && getOrderKey(p) !== persistedKey)];
        scheduleStorageSave('encomendaszap_all_places', next);
        return next;
      });
      setSavedPlaces(prev => {
        const next = [persistedPlace, ...prev.filter(p => p.id !== newPlace.id && p.id !== serverPlaceId && getOrderKey(p) !== persistedKey)];
        scheduleStorageSave('encomendaszap_saved_places', next);
        return next;
      });
      setSelectedPlace(prev => (!prev || prev.id === newPlace.id) ? persistedPlace : prev);
      flyToLocation(persistedPlace.coordinates, 16);
      if (newPlace.customerPhone || newPlace.customerName || newPlace.customerId) {
        const customerStatsRecord = {
          fullName: newPlace.customerName,
          phone: newPlace.customerPhone,
          id: newPlace.customerId
        };
        customerOrderStatsService.registerOrder(customerStatsRecord);
        const orderCount = customerOrderStatsService.getOrderCount(customerStatsRecord);
        setCustomers(prev => prev.map(customer => {
          const phoneDigits = (customer.phone || '').replace(/\D/g, '');
          const customerPhoneDigits = (newPlace.customerPhone || '').replace(/\D/g, '');
          const name = (customer.fullName || '').trim().toLowerCase();
          const customerName = (newPlace.customerName || '').trim().toLowerCase();
          const matches = (newPlace.customerId && customer.id === newPlace.customerId) ||
            (customerPhoneDigits.length >= 8 && phoneDigits &&
              (phoneDigits === customerPhoneDigits || phoneDigits.endsWith(customerPhoneDigits) || customerPhoneDigits.endsWith(phoneDigits))) ||
            (name && customerName && (name === customerName || name.includes(customerName) || customerName.includes(name)));
          return matches ? { ...customer, orderCount } : customer;
        }));
      }
      return true;
    } catch (err) {
      console.warn('Erro ao salvar pedido na API:', err);
      window.alert(err instanceof Error ? err.message : 'Erro ao salvar o pedido. Verifique a conexão e tente novamente.');
      return false;
    }
  }, [flyToLocation, updatePlaceDetails, currentRole, user]);

  const addNewOrder = useCallback((rawPlace: Place): Promise<boolean> => {
    return runOncePerKey(
      pendingOrderCreations.current,
      rawPlace.id,
      () => saveNewOrder(rawPlace)
    );
  }, [saveNewOrder]);
  return { addOrderDraft, saveNewOrder, addNewOrder };
}
