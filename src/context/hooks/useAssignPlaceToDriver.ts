import React, { useCallback } from 'react';
import { Place, Driver, OperationType } from '../../types/map';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';

interface Dependencies {
  allPlaces: MapContextType['allPlaces'];
  selectedPlace: MapContextType['selectedPlace'];
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSavedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
}

export function useAssignPlaceToDriver({ allPlaces, selectedPlace, setAllPlaces, setSavedPlaces, setSelectedPlace }: Dependencies) {
const assignPlaceToDriver = useCallback(async (placeId: string, driverId: string | null, driverPhone?: string, driverName?: string, acceptedByDriver = false): Promise<boolean> => {
    const cleanMotoristaId = driverId ? parseInt(driverId.replace(/\D/g, ''), 10) || null : null;
    const finalDriverId = cleanMotoristaId ? String(cleanMotoristaId) : (driverId || undefined);

    const targetPlace = allPlaces.find(p => p.id === placeId) || (selectedPlace?.id === placeId ? selectedPlace : null);
    const op: OperationType = targetPlace?.operationType || (placeId.includes('entrega') ? 'entrega' : placeId.includes('troca') ? 'troca' : 'coleta');

    try {
      if (finalDriverId) {
      await realtimeAssignmentService.assignOrder(placeId, {
        id: finalDriverId,
        name: driverName,
        phone: driverPhone
      }, op, acceptedByDriver);

      if (typeof window !== 'undefined' && window.AndroidApp) {
        window.AndroidApp.showNotification?.("EncomendasZap", "Pedido direcionado ao entregador!");
        window.AndroidApp.vibrate?.(200);
      }
    } else {
      await realtimeAssignmentService.unassignOrder(placeId, op);
    }
    } catch (error) {
      console.error('[Driver Assignment] Falha ao alterar motorista:', error);
      window.alert(error instanceof Error ? error.message : 'Não foi possível alterar o motorista.');
      return false;
    }

    const updateAssignment = (p: Place): Place => {
      if (p.id !== placeId) return p;
      const visibility: 'privado' | 'publico' = finalDriverId ? 'privado' : 'publico';
      const point = op === 'coleta'
        ? { pickupVisibility: visibility, pickupAssignedDriverId: finalDriverId, pickupAssignedDriverPhone: driverPhone || undefined, pickupAssignedDriverName: driverName || undefined }
        : op === 'troca'
          ? { exchangeVisibility: visibility, exchangeAssignedDriverId: finalDriverId, exchangeAssignedDriverPhone: driverPhone || undefined, exchangeAssignedDriverName: driverName || undefined }
          : { deliveryVisibility: visibility, deliveryAssignedDriverId: finalDriverId, deliveryAssignedDriverPhone: driverPhone || undefined, deliveryAssignedDriverName: driverName || undefined };
      return {
        ...p, ...point, orderVisibility: visibility, assignedDriverId: finalDriverId,
        assignedDriverPhone: driverPhone || undefined, assignedDriverName: driverName || undefined,
        acceptedByDriver: Boolean(finalDriverId && acceptedByDriver)
      };
    };

    setAllPlaces(prev => {
      const next = prev.map(updateAssignment);
      scheduleStorageSave('encomendaszap_all_places', next);
      return next;
    });

    setSavedPlaces(prev => {
      const next = prev.map(updateAssignment);
      scheduleStorageSave('encomendaszap_saved_places', next);
      return next;
    });

    setSelectedPlace(prev => {
      return prev ? updateAssignment(prev) : prev;
    });

    window.dispatchEvent(new Event('zap:refresh-orders'));
    return true;
  }, [allPlaces, selectedPlace]);
  return { assignPlaceToDriver };
}
