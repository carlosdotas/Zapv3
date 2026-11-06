import React, { useCallback } from 'react';
import { Place, OperationType, CompletedWaypointMark } from '../../types/map';
import { api } from '../../services/api';
import { mergeCompletedWaypointMarks } from '../../utils/completedWaypointMarks';
import { BaixaProximity } from '../../services/apiTypes';
import { scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';
import { resolvePlaceId, isTempPedidoNumber } from '../mapWorkflow';

interface Dependencies {
  selectedPlace: MapContextType['selectedPlace'];
  allPlaces: MapContextType['allPlaces'];
  savedPlaces: MapContextType['savedPlaces'];
  orderMutationVersion: React.MutableRefObject<number>;
  user: MapContextType['user'];
  currentCoords: MapContextType['currentCoords'];
  setCompletedWaypointMarks: React.Dispatch<React.SetStateAction<CompletedWaypointMark[]>>;
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSavedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
  setViewingPhotoPlace: MapContextType['setViewingPhotoPlace'];
  setViewingPhotoUrl: MapContextType['setViewingPhotoUrl'];
  flyToLocation: MapContextType['flyToLocation'];
}

export function useOrderCompletion({ selectedPlace, allPlaces, savedPlaces, orderMutationVersion, user, currentCoords, setCompletedWaypointMarks, setAllPlaces, setSavedPlaces, setSelectedPlace, setViewingPhotoPlace, setViewingPhotoUrl, flyToLocation }: Dependencies) {
const performCompletePlaceWaypoint = useCallback(async (rawPlaceId: string, receiverName?: string, notes?: string, proximity?: BaixaProximity, pickupPhotos?: string[]): Promise<boolean> => {
    const placeId = resolvePlaceId(rawPlaceId);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = now.toISOString().split('T')[0];

    // Localiza o local alvo de forma síncrona imediata
    const place = (selectedPlace?.id === placeId ? selectedPlace : null) ||
                  allPlaces.find(p => p.id === placeId) ||
                  savedPlaces.find(p => p.id === placeId);

    const currentOp: OperationType = place?.operationType || 'coleta';
    const rawId = (place as any)?.pedido_id || (place as any)?.orderId || placeId;
    const cleanId = String(rawId).replace(/^pedido-/, '').replace(/-(coleta|entrega|troca|retorno)$/, '').trim();
    const matchFromId = String(rawId).match(/pedido-(\d+)/) || String(rawId).match(/^(\d+)$/);
    const orderNum = matchFromId 
      ? matchFromId[1] 
      : (cleanId.match(/\d+/)?.[0] || String(placeId).match(/pedido-(\d+)/)?.[1] || String(placeId).match(/\d+/)?.[0] || (place?.orderCode ? place.orderCode.match(/(\d+)/)?.[1] : ''));
    const targetPedidoId = orderNum || cleanId || placeId;
    const orderCode = place?.orderCode || (orderNum ? `EZ-${orderNum}-GO` : '');
    const isExchange = Boolean(place?.isExchangeOrder || place?.category?.toLowerCase().includes('troca'));
    const isFailedAttempt = Boolean(receiverName?.toLowerCase().includes('insucesso') || notes?.toLowerCase().includes('insucesso'));

    // Verifica se possui local de entrega real e válido configurado
    const hasRealDeliveryLocation = Boolean(
      place &&
      place.deliveryCoordinates &&
      typeof place.deliveryCoordinates.lat === 'number' &&
      !isNaN(place.deliveryCoordinates.lat) &&
      place.deliveryCoordinates.lat !== 0 &&
      (
        (place.deliveryAddress && place.deliveryAddress.trim() && place.deliveryAddress !== 'Ponto de Entrega' && place.deliveryAddress !== place.pickupAddress) ||
        (place.deliveryName && place.deliveryName.trim() && place.deliveryName !== 'Ponto de Entrega' && place.deliveryName !== place.pickupName) ||
        (place.pickupCoordinates && (Math.abs(place.deliveryCoordinates.lat - place.pickupCoordinates.lat) > 0.0001 || Math.abs(place.deliveryCoordinates.lng - place.pickupCoordinates.lng) > 0.0001))
      )
    );

    const hasRealExchangeLocation = Boolean(
      isExchange &&
      (
        (place?.exchangeCoordinates && typeof place.exchangeCoordinates.lat === 'number' && !isNaN(place.exchangeCoordinates.lat) && place.exchangeCoordinates.lat !== 0) ||
        hasRealDeliveryLocation
      )
    );

    // Determina se é a etapa final da encomenda:
    // 1. Se é entrega -> É final!
    // 2. Se é coleta SEM local de entrega e SEM troca -> "primeiro aparece o local de coleta, se nao tiver local de entrega ela some" -> É final!
    // 3. Se não é troca e não tem entrega -> É final!
    let isFinalOrderCompletion = false;
    if (currentOp === 'entrega') {
      isFinalOrderCompletion = true;
    } else if (currentOp === 'coleta' && !hasRealDeliveryLocation && !hasRealExchangeLocation) {
      isFinalOrderCompletion = true;
    } else if (!isExchange && currentOp !== 'coleta' && !hasRealDeliveryLocation) {
      isFinalOrderCompletion = true;
    }

    let collectionOwnerId = place?.collectionOwnerId;
    orderMutationVersion.current += 1;
    if (!isFailedAttempt && targetPedidoId && !isTempPedidoNumber(String(targetPedidoId).replace(/\D/g, '') || null)) {
      const cleanUserId = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;
      const etapa = currentOp === 'coleta' ? 'coletado' : currentOp === 'troca' ? 'trocado' : 'entregue';
      try {
        const actorName = currentOp === 'coleta' ? (user?.name || 'Operador') : (receiverName || user?.name || 'Operador');
        const result = await api.marcarColetaEntrega(targetPedidoId, etapa, cleanUserId, actorName, proximity);
        if (!result.success) {
          window.alert(result.message || 'Não foi possível registrar a etapa do pedido.');
          return false;
        }
        if (currentOp === 'coleta') {
          collectionOwnerId = result.data?.collection_owner_id != null
            ? String(result.data.collection_owner_id)
            : undefined;
        }
      } catch (error) {
        console.error('[Baixa] Erro ao registrar etapa:', error);
        window.alert('Não foi possível registrar a etapa do pedido. Verifique a conexão e tente novamente.');
        return false;
      }
    }
    orderMutationVersion.current += 1;
    const nextCollectionAssignment: Partial<Place> = isFailedAttempt ? {} : {
      orderVisibility: 'privado',
      assignedDriverId: collectionOwnerId,
      assignedDriverName: user?.name,
      assignedDriverPhone: user?.phone
    };

    // 1. Marcação visual no solo (Xzinho no asfalto com horário e tipo exato da operação)
    let placePhotos: string[] = [];
    try {
      const savedPhotosRaw = localStorage.getItem(`encomendaszap_photos_${placeId}`);
      if (savedPhotosRaw) {
        const parsed = JSON.parse(savedPhotosRaw);
        if (Array.isArray(parsed)) placePhotos = parsed;
      }
    } catch {}
    if (currentOp === 'coleta' && pickupPhotos?.length) {
      placePhotos = pickupPhotos;
    } else if (placePhotos.length === 0 && place?.photos && place.photos.length > 0) {
      placePhotos = [...place.photos];
    }
    if (placePhotos.length === 0 && place?.imageUrl) {
      placePhotos = [place.imageUrl];
    }

    const assignedDriverName = user?.name || place?.assignedDriverName || 'Motorista';

    const newCompletedMark: CompletedWaypointMark = {
      id: `mark-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderId: placeId,
      orderCode,
      operationType: currentOp,
      completedAt: Date.now(),
      timeStr,
      completedDate: todayStr,
      placeName: currentOp === 'coleta' 
        ? (place?.pickupName || place?.name || 'Local de Coleta')
        : (place?.name || 'Local'),
      address: currentOp === 'coleta'
        ? (place?.pickupAddress || place?.address || '')
        : (place?.address || ''),
      customerName: place?.customerName,
      coordinates: place ? { ...place.coordinates } : currentCoords,
      receiverName,
      details: notes,
      status: isFailedAttempt ? 'failed' : 'success',
      isFinal: isFinalOrderCompletion,
      driverName: assignedDriverName,
      driverId: user?.id ? String(user.id) : undefined,
      driverPhone: user?.phone || place?.assignedDriverPhone,
      driverPhoto: user?.avatarUrl,
      photos: placePhotos,
      imageUrl: placePhotos[0] || place?.imageUrl
    };

    setCompletedWaypointMarks(prev => {
      const nextMarks = mergeCompletedWaypointMarks([newCompletedMark], prev);
      try {
        localStorage.setItem('encomendaszap_completed_marks', JSON.stringify(nextMarks));
      } catch (e) {}
      return nextMarks;
    });

    if (typeof window !== 'undefined' && window.AndroidApp) {
      const msg = isFailedAttempt ? 'Tentativa registrada' : isFinalOrderCompletion ? 'Entrega concluída!' : 'Status do pedido atualizado!';
      window.AndroidApp.showNotification?.("EncomendasZap", msg);
      window.AndroidApp.vibrate?.(200);
    }

    // 2. Atualiza estado de allPlaces conforme as 4 regras do EncomendasZap:
    // - Coleta sem entrega: ela some!
    // - Coleta com entrega: ao coletar aparece o local de entrega!
    // - Coleta com troca: ao coletar aparece o local de troca!
    // - Troca concluída: por último o local de coleta vira o local de entrega!
    setAllPlaces(prev => {
      let nextList: Place[];
      if (isFinalOrderCompletion) {
        // Encomenda totalmente concluída: remove do mapa ("ela some")
        nextList = prev.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && p.id.startsWith(`pedido-${orderNum}`)) return false;
          if (orderCode && p.orderCode === orderCode) return false;
          return true;
        });
      } else if (currentOp === 'coleta') {
        // Remove a marker pendente da Coleta
        nextList = prev.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && p.id === `pedido-${orderNum}-coleta`) return false;
          return true;
        });

        if (isExchange && hasRealExchangeLocation && place) {
          // "se for troca primeiro e coleta, depois e local de troca"
          const exchangeCoords = place.exchangeCoordinates || place.deliveryCoordinates;
          const exchangeAddress = place.exchangeAddress || place.deliveryAddress || place.address;
          const exchangeName = place.exchangeName || (place.customerName ? `Troca: ${place.customerName}` : 'Ponto de Troca');
          const nextStepId = orderNum ? `pedido-${orderNum}-troca` : `troca-${placeId}`;

          if (exchangeCoords && !nextList.some(p => p.id === nextStepId)) {
            nextList.push({
              ...place,
              collectionRestricted: !isFailedAttempt,
              collectionOwnerId,
              ...nextCollectionAssignment,
              id: nextStepId,
              name: exchangeName,
              address: exchangeAddress,
              coordinates: exchangeCoords,
              imageUrl: placePhotos[0],
              photos: placePhotos,
              pickupPhotos: place.pickupPhotos || placePhotos,
              operationType: 'troca',
              orderStage: 'troca',
              category: 'Troca de Mercadoria',
              isExchangeOrder: true
            });
          }
        } else if (hasRealDeliveryLocation && place && place.deliveryCoordinates) {
          // "se tiver local de entrega ela aparece depois da coleta"
          const destCoords = place.deliveryCoordinates;
          const destAddress = place.deliveryAddress || place.address;
          const destName = place.deliveryName || (place.customerName ? `Entrega: ${place.customerName}` : 'Ponto de Entrega');
          const nextStepId = orderNum ? `pedido-${orderNum}-entrega` : `entrega-${placeId}`;

          if (!nextList.some(p => p.id === nextStepId)) {
            nextList.push({
              ...place,
              collectionRestricted: !isFailedAttempt,
              collectionOwnerId,
              ...nextCollectionAssignment,
              id: nextStepId,
              name: destName,
              address: destAddress,
              coordinates: destCoords,
              imageUrl: placePhotos[0],
              photos: placePhotos,
              pickupPhotos: placePhotos,
              operationType: 'entrega',
              orderStage: 'entrega',
              category: 'Entrega Expressa',
              isExchangeOrder: false
            });
          }
        }
      } else if (currentOp === 'troca' && isExchange && place) {
        // Troca concluída: remove o ponto de troca
        nextList = prev.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && p.id === `pedido-${orderNum}-troca`) return false;
          return true;
        });

        // "por ultimo o local de coleta vira o local de entrega" (retorno no mesmo local da coleta original)
        const returnCoords = place.pickupCoordinates || place.coordinates;
        const returnAddress = place.pickupAddress || place.address;
        const returnName = `2ª Entrega (Retorno à Coleta): ${place.pickupName || place.name}`;
        const returnId = orderNum ? `pedido-${orderNum}-retorno` : `retorno-${placeId}`;

        if (!nextList.some(p => p.id === returnId)) {
          nextList.push({
            ...place,
            id: returnId,
            name: returnName,
            address: returnAddress,
            coordinates: returnCoords,
            imageUrl: placePhotos[0],
            photos: placePhotos,
            pickupPhotos: placePhotos,
            operationType: 'entrega',
            orderStage: 'retorno',
            category: 'Troca de Mercadoria',
            isExchangeOrder: true
          });
        }
      } else {
        nextList = prev.filter(p => p.id !== placeId);
      }

      scheduleStorageSave('encomendaszap_all_places', nextList);
      return nextList;
    });

    // 3. Atualiza savedPlaces acompanhando o mesmo ciclo de vida
    setSavedPlaces(prevSaved => {
      let nextSaved: Place[];
      if (isFinalOrderCompletion) {
        nextSaved = prevSaved.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && (p.id.includes(orderNum) || (p.orderCode && p.orderCode.includes(orderNum)))) return false;
          if (orderCode && p.orderCode === orderCode) return false;
          return true;
        });
      } else if (currentOp === 'coleta') {
        nextSaved = prevSaved.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && p.id === `pedido-${orderNum}-coleta`) return false;
          return true;
        });

        if (isExchange && hasRealExchangeLocation && place) {
          const exchangeCoords = place.exchangeCoordinates || place.deliveryCoordinates;
          const exchangeAddress = place.exchangeAddress || place.deliveryAddress || place.address;
          const exchangeName = place.exchangeName || (place.customerName ? `Troca: ${place.customerName}` : 'Ponto de Troca');
          const nextStepId = orderNum ? `pedido-${orderNum}-troca` : `troca-${placeId}`;

          if (exchangeCoords && !nextSaved.some(p => p.id === nextStepId)) {
            nextSaved.push({
              ...place,
              collectionRestricted: !isFailedAttempt,
              collectionOwnerId,
              ...nextCollectionAssignment,
              id: nextStepId,
              name: exchangeName,
              address: exchangeAddress,
              coordinates: exchangeCoords,
              imageUrl: placePhotos[0],
              photos: placePhotos,
              pickupPhotos: placePhotos,
              operationType: 'troca',
              orderStage: 'troca',
              category: 'Troca de Mercadoria',
              isExchangeOrder: true
            });
          }
        } else if (hasRealDeliveryLocation && place && place.deliveryCoordinates) {
          const destCoords = place.deliveryCoordinates;
          const destAddress = place.deliveryAddress || place.address;
          const destName = place.deliveryName || (place.customerName ? `Entrega: ${place.customerName}` : 'Ponto de Entrega');
          const nextStepId = orderNum ? `pedido-${orderNum}-entrega` : `entrega-${placeId}`;

          if (!nextSaved.some(p => p.id === nextStepId)) {
            nextSaved.push({
              ...place,
              collectionRestricted: !isFailedAttempt,
              collectionOwnerId,
              ...nextCollectionAssignment,
              id: nextStepId,
              name: destName,
              address: destAddress,
              coordinates: destCoords,
              imageUrl: placePhotos[0],
              photos: placePhotos,
              pickupPhotos: placePhotos,
              operationType: 'entrega',
              orderStage: 'entrega',
              category: 'Entrega Expressa',
              isExchangeOrder: false
            });
          }
        }
      } else if (currentOp === 'troca' && isExchange && place) {
        nextSaved = prevSaved.filter(p => {
          if (p.id === placeId) return false;
          if (orderNum && p.id === `pedido-${orderNum}-troca`) return false;
          return true;
        });

        const returnCoords = place.pickupCoordinates || place.coordinates;
        const returnAddress = place.pickupAddress || place.address;
        const returnName = `2ª Entrega (Retorno à Coleta): ${place.pickupName || place.name}`;
        const returnId = orderNum ? `pedido-${orderNum}-retorno` : `retorno-${placeId}`;

        if (!nextSaved.some(p => p.id === returnId)) {
          nextSaved.push({
            ...place,
            id: returnId,
            name: returnName,
            address: returnAddress,
            coordinates: returnCoords,
            imageUrl: placePhotos[0],
            photos: placePhotos,
            pickupPhotos: place.pickupPhotos || placePhotos,
            operationType: 'entrega',
            orderStage: 'retorno',
            category: 'Troca de Mercadoria',
            isExchangeOrder: true
          });
        }
      } else {
        nextSaved = prevSaved.filter(p => p.id !== placeId);
      }

      scheduleStorageSave('encomendaszap_saved_places', nextSaved);
      return nextSaved;
    });

    // 4. Fecha imediatamente o card de detalhes
    setSelectedPlace(null);
    setViewingPhotoPlace(null);
    setViewingPhotoUrl(null);

    // 5. SINCRONIZAÇÃO COMPLETA E GARANTIDA COM O SERVIDOR
    if (targetPedidoId && !isTempPedidoNumber(String(targetPedidoId).replace(/\D/g, '') || null)) {
      const cleanUserId = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;
      const operatorName = receiverName || user?.name || 'Operador';
      const nowIso = now.toISOString();

      if (isFailedAttempt) {
        await api.savePedido({
          id: targetPedidoId,
          entrega_obs: notes || receiverName,
          status_pagamento: 'tentativa_sem_sucesso'
        }).catch(() => {});
        const presenceCampo = currentOp === 'coleta' ? 'coleta_saida_at' : currentOp === 'troca' ? 'troca_saida_at' : 'entrega_saida_at';
        await api.registrarPresenca(targetPedidoId, presenceCampo, nowIso).catch(() => {});
      } else {
        const etapaBackend = isFinalOrderCompletion && currentOp === 'coleta'
          ? 'coletado'
          : currentOp === 'coleta' 
          ? 'coletado' 
          : currentOp === 'troca' 
          ? 'trocado' 
          : 'entregue';

        // 5.2 Persiste etapa e campos de saída no registro do pedido
        try {
          await api.savePedido({
            id: targetPedidoId,
            etapa: isFinalOrderCompletion ? (currentOp === 'coleta' ? 'finalizado' : 'entregue') : etapaBackend,
            ...(currentOp === 'coleta' 
              ? { coleta_obs: notes || operatorName, coleta_saida_at: nowIso, coleta_user_nome: user?.name || 'Operador' }
              : currentOp === 'troca' 
              ? { troca_obs: notes || operatorName, troca_saida_at: timeStr, troca_at: timeStr, troca_user_id: cleanUserId, troca_user_nome: operatorName } 
              : { entrega_obs: notes || operatorName, entrega_saida_at: timeStr, entrega_at: timeStr, entrega_user_id: cleanUserId, entrega_user_nome: operatorName, status_pagamento: 'pago' }
            ),
            ...(isFinalOrderCompletion ? { status_pagamento: 'pago', etapa: 'finalizado' } : {})
          });
        } catch (err) {
          console.warn('[Baixa] Erro em savePedido:', err);
        }

        // 5.3 Registra presença de saída no servidor
        const presenceCampo = currentOp === 'coleta' ? 'coleta_saida_at' : currentOp === 'troca' ? 'troca_saida_at' : 'entrega_saida_at';
        await api.registrarPresenca(targetPedidoId, presenceCampo, nowIso).catch(() => {});

        // 5.4 Se foi a conclusão final da entrega ou coleta única, finaliza o pedido oficialmente
        if (isFinalOrderCompletion) {
          try {
            await api.finalizarPedido(targetPedidoId, cleanUserId);
          } catch (err) {
            console.warn('[Baixa] Erro em finalizarPedido:', err);
          }
        }
      }
    }
    return true;
  }, [allPlaces, savedPlaces, selectedPlace, currentCoords, flyToLocation, user]);
  return { performCompletePlaceWaypoint };
}
