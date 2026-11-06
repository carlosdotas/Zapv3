import React, { useCallback } from 'react';
import { Place, OperationType } from '../../types/map';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';

interface Dependencies {
  user: MapContextType['user'];
  allPlaces: MapContextType['allPlaces'];
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSavedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
}

export function useClaimPublicOrder({ user, allPlaces, setAllPlaces, setSavedPlaces, setSelectedPlace }: Dependencies) {
const claimPublicOrder = useCallback(async (placeId: string, operation?: OperationType): Promise<boolean> => {
    const driverId = user.id;
    if (!driverId) throw new Error('Não foi possível identificar o motorista. Faça login novamente.');
    const driverName = user.name || 'Motorista Parceiro';
    const driverPhone = user.phone || '';
    const claimOp: OperationType | undefined = operation || allPlaces.find(p => p.id === placeId)?.operationType ||
      (placeId.endsWith('-coleta') ? 'coleta' : placeId.endsWith('-troca') ? 'troca' : placeId.endsWith('-entrega') ? 'entrega' : undefined);
    if (!claimOp) {
      throw new Error('Não foi possível identificar a etapa do pedido. Atualize o mapa e tente novamente.');
    }

    // Reserva o pedido no servidor primeiro: se outro motorista aceitou antes, este perde
    const won = await realtimeAssignmentService.claimOrder(placeId, { id: driverId, name: driverName, phone: driverPhone }, claimOp);
    if (!won) return false;
    const confirmedDriverId = realtimeAssignmentService.getAssignmentForOrder(placeId, claimOp)?.driverId || driverId;

    const operationAssignment = claimOp === 'coleta'
      ? {
          pickupVisibility: 'privado' as const,
          pickupAssignedDriverId: confirmedDriverId,
          pickupAssignedDriverName: driverName,
          pickupAssignedDriverPhone: driverPhone
        }
      : claimOp === 'troca'
        ? {
            exchangeVisibility: 'privado' as const,
            exchangeAssignedDriverId: confirmedDriverId,
            exchangeAssignedDriverName: driverName,
            exchangeAssignedDriverPhone: driverPhone
          }
        : {
            deliveryVisibility: 'privado' as const,
            deliveryAssignedDriverId: confirmedDriverId,
            deliveryAssignedDriverName: driverName,
            deliveryAssignedDriverPhone: driverPhone
          };
    const claimedPlace = (place: Place): Place => ({
      ...place,
      orderVisibility: 'privado',
      assignedDriverId: confirmedDriverId,
      assignedDriverName: driverName,
      assignedDriverPhone: driverPhone,
      acceptedByDriver: true,
      ...operationAssignment
    });

    // Atualiza visibilidade como privado para consolidar que não é mais aberto/público
    setAllPlaces(prev => {
      const next = prev.map(p => {
        return p.id === placeId ? claimedPlace(p) : p;
      });
      scheduleStorageSave('encomendaszap_all_places', next);
      return next;
    });

    setSavedPlaces(prev => {
      const next = prev.map(p => {
        return p.id === placeId ? claimedPlace(p) : p;
      });
      scheduleStorageSave('encomendaszap_saved_places', next);
      return next;
    });

    setSelectedPlace(prev => {
      return prev?.id === placeId ? claimedPlace(prev) : prev;
    });

    window.dispatchEvent(new Event('zap:refresh-orders'));
    return true;
  }, [user, allPlaces]);
  return { claimPublicOrder };
}
