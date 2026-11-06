import React, { useCallback } from 'react';
import { Place, Driver, CompletedWaypointMark } from '../../types/map';
import { driverTrackingClient, isDriverStale } from '../../services/driverTrackingClient';
import { Customer } from '../../types/customer';
import { api, getAuthToken } from '../../services/api';
import { backendPedidoToPlace, backendPedidoToPlaces, backendOrderMarkerToPlace, backendUserToCustomer, formatPhotoUrl, getOrderDateBadgeFromDate } from '../../services/apiAdapters';
import { excludeCoveredOrders, isTemporaryOrderId, getOrderKey } from '../../utils/orderIds';
import { shouldApplyOrderSync } from '../../utils/orderSync';
import { mergeCompletedWaypointMarks } from '../../utils/completedWaypointMarks';
import { BackendPedido, BackendUser } from '../../services/apiTypes';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { areArraysEqualFast, getPlaceSignature, getCustomerSignature, getDriverSignature, scheduleStorageSave } from '../../utils/backgroundScheduler';
import type { MapContextType } from '../mapStoreTypes';

interface Dependencies {
  orderSyncRequestVersion: React.MutableRefObject<number>;
  orderMutationVersion: React.MutableRefObject<number>;
  setIsSyncingServer: React.Dispatch<React.SetStateAction<boolean>>;
  setServerStatus: React.Dispatch<React.SetStateAction<'connected' | 'offline' | 'checking'>>;
  setServerMessage: React.Dispatch<React.SetStateAction<string>>;
  setServerLatencyMs: React.Dispatch<React.SetStateAction<number | null>>;
  setCompletedWaypointMarks: React.Dispatch<React.SetStateAction<CompletedWaypointMark[]>>;
  setAllPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  setCompletedOrders: React.Dispatch<React.SetStateAction<Place[]>>;
  setSelectedPlace: MapContextType['setSelectedPlace'];
  lastCustomersSyncAt: React.MutableRefObject<number>;
  customerMutationVersion: React.MutableRefObject<number>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  currentRole: MapContextType['currentRole'];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
}

export function useServerDataSync({ orderSyncRequestVersion, orderMutationVersion, setIsSyncingServer, setServerStatus, setServerMessage, setServerLatencyMs, setCompletedWaypointMarks, setAllPlaces, setCompletedOrders, setSelectedPlace, lastCustomersSyncAt, customerMutationVersion, setCustomers, currentRole, setDrivers }: Dependencies) {
const refreshServerData = useCallback(async (opts?: { silent?: boolean }) => {
    const orderSyncSnapshot = {
      requestVersion: ++orderSyncRequestVersion.current,
      mutationVersion: orderMutationVersion.current
    };
    const silent = opts?.silent === true;
    const shouldLoadOrderHistory = !silent && Boolean(getAuthToken());
    if (!silent) {
      setIsSyncingServer(true);
      setServerStatus('checking');
    }

    try {
      const conn = await api.checkConnection().catch(() => ({ ok: false, message: 'Servidor Express desconectado', latencyMs: undefined }));
      if (!conn.ok) {
        setServerStatus('offline');
        setServerMessage(conn.message);
      } else {
        setServerStatus('connected');
        setServerMessage(conn.message);
        setServerLatencyMs(conn.latencyMs || null);
      }

      // 1. Busca Markers do endpoint (/tracking/order_markers) para Hoje e Dias Anteriores
      // Regra de negócio explícita:
      // - Hoje e Dias Anteriores: mostra marcadores que não estiverem finalizados (coletas, trocas e entregas)
      // - Finalizados/Entregues: NUNCA aparecem como marcadores ativos no mapa
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

      const [markersData, pedidosRes, recentCompletedRes] = await Promise.all([
        api.getActiveOrderMarkersTodayAndYesterday().catch(error => {
          console.error('[Orders] Falha ao carregar os marcadores:', error);
          return { todayMarkers: [], yesterdayPendingMarkers: [], allActiveMarkers: [] };
        }),
        api.listAllPedidos({ limit: 250, active_only: true }).catch(error => {
          console.error('[Orders] Falha ao carregar a lista de pedidos:', error);
          return {
            success: false,
            data: [],
            message: error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.'
          };
        }),
        shouldLoadOrderHistory
          ? api.listPedidos({ limit: 250, completed_only: true }).catch(error => {
              console.error('[Orders] Falha ao carregar o histórico recente de pedidos:', error);
              return {
                success: false,
                data: [],
                message: error instanceof Error ? error.message : 'Não foi possível carregar o histórico de pedidos.'
              };
            })
          : Promise.resolve(null)
      ]);

      // Mapeia detalhes completos dos pedidos caso estejam disponíveis no banco
      const pedidosMap = new Map<string, any>();
      if (pedidosRes && pedidosRes.success && Array.isArray(pedidosRes.data)) {
        pedidosRes.data.forEach((p: any) => pedidosMap.set(String(p.id), p));
      }

      // Busca os detalhes completos dos pedidos ativos do banco (/pedidos/get)
      // Isso garante a leitura de coleta_user_id, coleta_user_nome, coleta_motoristas, etc.
      const activePedidoIds = pedidosRes.success
        ? Array.from(new Set([
            ...markersData.todayMarkers.map(m => m.pedido_id),
            ...markersData.yesterdayPendingMarkers.map(m => m.pedido_id)
          ].filter(Boolean).filter(id => !pedidosMap.has(String(id)))))
        : [];

      if (activePedidoIds.length > 0) {
        const toFetch = activePedidoIds.slice(0, 30);
        for (let i = 0; i < toFetch.length; i += 6) {
          const chunk = toFetch.slice(i, i + 6);
          const chunkOrders = await Promise.all(
            chunk.map(id => api.getPedido(id).then(r => r.data).catch(() => null))
          );
          chunkOrders.forEach(p => {
            if (p && p.id) {
              pedidosMap.set(String(p.id), p);
            }
          });
        }
      }

      if (!pedidosRes.success || !Array.isArray(pedidosRes.data)) {
        console.warn(
          '[Orders] A lista de pedidos não foi carregada; mantendo os pedidos locais até a próxima sincronização.',
          pedidosRes.message
        );
      }

      // Converte markers de Hoje
      const todayPlaces: Place[] = markersData.todayMarkers
        .map(m => backendOrderMarkerToPlace(m, 'hoje', pedidosMap.get(String(m.pedido_id))))
        .filter(p => p.orderStage !== 'concluido' && (p.operationType as any) !== 'concluido');

      // Converte markers de Dias Anteriores (ontem, 2 dias atrás, 3 dias atrás, etc.) que NÃO estejam finalizados
      const previousDaysPlaces: Place[] = markersData.yesterdayPendingMarkers
        .map(m => {
          const pOrder = pedidosMap.get(String(m.pedido_id));
          const dateBadge = getOrderDateBadgeFromDate(pOrder?.data || pOrder?.created_at || (m as any).data || (m as any).date);
          return backendOrderMarkerToPlace(m, dateBadge, pOrder);
        })
        .filter(p => p.orderStage !== 'concluido' && (p.operationType as any) !== 'concluido');

      const activeOrderPlaces = [...todayPlaces, ...previousDaysPlaces];

      // Mapeia IDs de pedidos já cobertos pelas markers
      const coveredOrderIds = new Set<string>();
      activeOrderPlaces.forEach(p => {
        const idMatch = p.id.match(/^pedido-(\d+)/);
        if (idMatch) coveredOrderIds.add(idMatch[1]);
        if (p.orderCode) {
          const codeMatch = p.orderCode.match(/^EZ-(\d+)/);
          if (codeMatch) coveredOrderIds.add(codeMatch[1]);
        }
      });

      // Inclui quaisquer pedidos de list_pedidos que estejam ativos (aprovado/coletando/coletado)
      // e que ainda não estejam presentes nas markers de hoje/ontem (cobre todas as makers de hoje e dias anteriores)
      const additionalActivePlaces: Place[] = [];
      if (pedidosRes && pedidosRes.success && Array.isArray(pedidosRes.data)) {
        const activePedidosList = pedidosRes.data.filter((p: any) => {
          const et = (p.etapa || '').toLowerCase().trim();
          return et !== 'entregue' && et !== 'finalizado' && et !== 'concluido' && et !== 'cancelado';
        });

        excludeCoveredOrders(activePedidosList, coveredOrderIds).forEach((p: any) => {
          const placesFromPedido = backendPedidoToPlaces(p);
          additionalActivePlaces.push(...placesFromPedido);
        });
      }

      // Lê baixas salvas para garantir que encomendas já finalizadas (entrega concluída) não retornem ao mapa
      const completedMarksRaw = localStorage.getItem('encomendaszap_completed_marks');
      const savedMarks: CompletedWaypointMark[] = completedMarksRaw ? JSON.parse(completedMarksRaw) : [];
      const locallyDoneOrderIds = new Set<string>();
      savedMarks.forEach(m => {
        if ((m.operationType === 'entrega' || m.isFinal) && m.status !== 'failed') {
          const match = m.orderId.match(/^pedido-(\d+)/) || (m.orderCode ? m.orderCode.match(/(\d+)/) : null);
          if (match) locallyDoneOrderIds.add(match[1]);
          if (m.orderCode) locallyDoneOrderIds.add(m.orderCode.trim());
          locallyDoneOrderIds.add(m.orderId);
        }
      });

      // Gera marcas com 'X' para coletas de pedidos vindos do backend cuja etapa já foi concluída
      const backendCompletedColetas: CompletedWaypointMark[] = [];
      if (pedidosRes && pedidosRes.success && Array.isArray(pedidosRes.data)) {
        pedidosRes.data.forEach((p: any) => {
          const et = (p.etapa || '').toLowerCase().trim();
          const isColetado = et === 'coletado' || et === 'trocando' || et === 'trocado' || et === 'retornando' || et === 'entregando' || et === 'entregue';
          if (!isColetado) return;

          const cLat = parseFloat(String(p.coleta_lat || p.coleta_locais_lat || ''));
          const cLng = parseFloat(String(p.coleta_lng || p.coleta_locais_lng || ''));
          if (isNaN(cLat) || isNaN(cLng) || cLat === 0 || cLng === 0) return;

          const markId = `backend-coleta-${p.id}`;
          const rawTime = p.coleta_saida_at || p.coleta_chegada_at || p.data || p.created_at;
          let timeFormatted = '12:00';
          if (rawTime) {
            const timeMatch = String(rawTime).match(/(\d{2}:\d{2})/);
            if (timeMatch) timeFormatted = timeMatch[1];
          }

          const photoRaw = p.coleta_foto || p.foto;
          const photoUrl = photoRaw ? formatPhotoUrl(photoRaw) : undefined;
          const photos = photoUrl ? [photoUrl] : [];

          backendCompletedColetas.push({
            id: markId,
            orderId: `pedido-${p.id}`,
            orderCode: p.order_code || `EZ-${p.id}-GO`,
            operationType: 'coleta',
            completedAt: Date.now(),
            timeStr: timeFormatted,
            completedDate: String(rawTime || todayStr).slice(0, 10),
            placeName: String(p.coleta_nome || p.coleta_local || p.coleta_user_nome || 'Local de Coleta'),
            address: String(p.coleta_endereco || 'Endereço da coleta'),
            customerName: String(p.coleta_user_nome || p.cliente_nome || ''),
            coordinates: { lat: cLat, lng: cLng },
            status: 'success',
            driverName: String(p.coleta_motoristas || p.motorista_nome || 'Motorista'),
            driverId: p.coleta_user_id ? String(p.coleta_user_id) : undefined,
            photos: photos,
            imageUrl: photoUrl || undefined
          });
        });
      }

      if (backendCompletedColetas.length > 0) {
        setCompletedWaypointMarks(prev => {
          if (!shouldApplyOrderSync(orderSyncSnapshot, orderSyncRequestVersion.current, orderMutationVersion.current)) return prev;
          return mergeCompletedWaypointMarks(prev, backendCompletedColetas);
        });
      }

      const allCombinedActivePlaces = [...activeOrderPlaces, ...additionalActivePlaces].filter(p => {
        if (p.orderStage === 'concluido' || (p.operationType as any) === 'concluido') return false;
        const idMatch = p.id.match(/^pedido-(\d+)/);
        if (idMatch && locallyDoneOrderIds.has(idMatch[1])) return false;
        if (p.orderCode && locallyDoneOrderIds.has(p.orderCode.trim())) return false;
        if (locallyDoneOrderIds.has(p.id)) return false;
        return true;
      }).map(p => {
        // Enriquecimento prioritário com Realtime Assignment (REST + polling)
        const numId = p.id.match(/\d+/)?.[0] || (p.orderCode ? p.orderCode.match(/\d+/)?.[0] : null);
        const rt = realtimeAssignmentService.getAssignmentForOrder(p.id, p.operationType) || 
                   (numId ? realtimeAssignmentService.getAssignmentForOrder(numId, p.operationType) : null);
        if (rt && rt.driverId && p.assignedDriverId === rt.driverId && !p.collectionRestricted) {
          return {
            ...p,
            assignedDriverId: rt.driverId,
            assignedDriverName: rt.driverName || p.assignedDriverName,
            assignedDriverPhone: rt.driverPhone || p.assignedDriverPhone,
            driverEnRoute: Boolean(rt.enRoute),
            acceptedByDriver: Boolean(rt.acceptedByDriver)
          };
        }
        return p;
      });

      // Atualiza allPlaces: apenas com markers ativas (coletas não coletadas, entregas não entregues e trocas)
      // Encomendas finalizadas/entregues são estritamente excluídas
      if (pedidosRes.success && Array.isArray(pedidosRes.data)) {
        setAllPlaces(prev => {
          if (!shouldApplyOrderSync(
            orderSyncSnapshot,
            orderSyncRequestVersion.current,
            orderMutationVersion.current
          )) {
            return prev;
          }

          // Preserva quaisquer encomendas criadas localmente que ainda estejam sendo salvas
          // Preserva só encomendas criadas localmente nos últimos 2 minutos (ainda sendo salvas); as antigas são fantasmas
          const freshLocalWindowMs = 2 * 60 * 1000;
          const locallyCreatedPending = prev.filter(p => {
            if (!p.id.startsWith('pedido-')) return false;
            const stamp = Number(p.id.replace('pedido-', '').split('-')[0]);
            return stamp > 1000000000 && Date.now() - stamp < freshLocalWindowMs;
          });
          // Garante que cada pedido no mapa tenha no máximo 1 ponto ativo (nunca duplica por coleta/entrega)
          const dedupedOrderPlaces = new Map<string, Place>();
          for (const fp of allCombinedActivePlaces) {
            const key = getOrderKey(fp);
            if (!dedupedOrderPlaces.has(key)) {
              dedupedOrderPlaces.set(key, fp);
            }
          }
          const finalPlaces = Array.from(dedupedOrderPlaces.values());
          const finalPlaceKeys = new Set(Array.from(dedupedOrderPlaces.keys()));
          locallyCreatedPending.forEach(lp => {
            const key = getOrderKey(lp);
            if (!finalPlaceKeys.has(key)) {
              finalPlaces.unshift(lp);
              finalPlaceKeys.add(key);
            }
          });

          if (areArraysEqualFast(prev, finalPlaces, getPlaceSignature)) {
            return prev;
          }
          scheduleStorageSave('encomendaszap_all_places', finalPlaces);
          return finalPlaces;
        });
      }

      // O histórico completo é carregado apenas na sincronização inicial/manual.
      // Atualizações periódicas usam só pedidos ativos para não bloquear o mapa.
      if (recentCompletedRes && recentCompletedRes.success && Array.isArray(recentCompletedRes.data)) {
        const doneList: Place[] = [];
        const seenDoneKeys = new Set<string>();
        recentCompletedRes.data.forEach((p: any) => {
          const et = (p.etapa || '').toLowerCase().trim();
          if (et !== 'entregue' && et !== 'finalizado' && et !== 'concluido' && et !== 'cancelado') return;
          const place = backendPedidoToPlace(p as BackendPedido);
          const key = getOrderKey(place);
          if (!seenDoneKeys.has(key)) {
            seenDoneKeys.add(key);
            doneList.push({ ...place, orderStage: 'concluido' });
          }
        });
        setCompletedOrders(prev => areArraysEqualFast(prev, doneList, getPlaceSignature) ? prev : doneList);
      }

      // Se há um local atualmente selecionado, sincroniza com os dados frescos do servidor
      setSelectedPlace(curr => {
        if (!curr) return null;
        if (!shouldApplyOrderSync(orderSyncSnapshot, orderSyncRequestVersion.current, orderMutationVersion.current)) return curr;
        if (
          localStorage.getItem('encomendaszap_user_role') === 'motorista' &&
          pedidosRes.success && Array.isArray(pedidosRes.data) &&
          /^pedido-\d+/.test(curr.id) && !isTemporaryOrderId(curr.id) &&
          !allCombinedActivePlaces.some(p => getOrderKey(p) === getOrderKey(curr))
        ) return null;
        const refreshed = allCombinedActivePlaces.find(p => p.id === curr.id);
        if (refreshed && getPlaceSignature(refreshed) !== getPlaceSignature(curr)) {
          return {
            ...curr,
            ...refreshed,
            imageUrl: refreshed.imageUrl,
            photos: refreshed.photos,
            pickupPhotos: refreshed.pickupPhotos,
            deliveryPhotos: refreshed.deliveryPhotos,
            collectionRestricted: refreshed.collectionRestricted,
            collectionOwnerId: refreshed.collectionOwnerId,
            orderStage: refreshed.orderStage
          };
        }
        return curr;
      });

      // 3. Busca Clientes / Usuários do backend (POST /pedidos/list_users)
      // Intervalo espaçado para 3 minutos em segundo plano para não sobrecarregar a thread principal nem o backend
      if (Date.now() - lastCustomersSyncAt.current >= 180000) {
        const syncVersion = customerMutationVersion.current;
        const users: BackendUser[] = [];
        let cursor: string | undefined;
        let usersLoadComplete = true;
        do {
          const usersRes = await api.listUsers({ limit: 100, ...(cursor ? { cursor } : {}) });
          if (!usersRes.success || !Array.isArray(usersRes.data)) {
            usersLoadComplete = false;
            console.warn('[Customers] Não foi possível carregar todos os clientes:', usersRes.message);
            break;
          }
          users.push(...usersRes.data);
          if (!usersRes.hasMore) break;
          if (!usersRes.cursor) {
            usersLoadComplete = false;
            console.warn('[Customers] A paginação de clientes não retornou o próximo cursor.');
            break;
          }
          cursor = usersRes.cursor;
        } while (true);

        if (usersLoadComplete && syncVersion === customerMutationVersion.current) {
          const nextCustomers = users.map(backendUserToCustomer);
          setCustomers(prev => areArraysEqualFast(prev, nextCustomers, getCustomerSignature) ? prev : nextCustomers);
          lastCustomersSyncAt.current = Date.now();
        }
      }

      // 4. Busca Motoristas Reais Ativos e em Tempo Real (exclui inativos há mais de 30 minutos)
      if (currentRole !== 'motorista') {
        const liveDrivers = await driverTrackingClient.fetchLiveDrivers();
        const validLiveDrivers = liveDrivers.filter(d => !isDriverStale(d));
        setDrivers(prev => areArraysEqualFast(prev, validLiveDrivers, getDriverSignature) ? prev : validLiveDrivers);
      } else {
        setDrivers(prev => prev.length ? [] : prev);
      }
    } catch (e: any) {
      setServerStatus('offline');
      setServerMessage(e?.message || 'Falha ao buscar dados do servidor.');
    } finally {
      if (!silent) setIsSyncingServer(false);
    }
  }, []);
  return { refreshServerData };
}
