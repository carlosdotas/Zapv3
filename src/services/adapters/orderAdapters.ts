import type { Place, LocationCoordinates, OperationType, OrderDateBadgeType, VehicleCollectionType } from '../../types/map';
import type { BackendPedido, BackendOrderMarker } from '../apiTypes';
import { collectionOwnership, withCollectionOwner } from '../../utils/collectionOwnership';
import { extractPhotoUrls } from './photoAdapters';
import { getOrderDateBadgeFromDate } from './orderDates';
import { extractCoordsFromString, resolveKnownAddressCoordinates } from './orderCoordinates';
import { extractDriverAssignmentFromPedido } from './orderAssignments';
import { pedidoPaymentFields, persistedMapOrderDetails, getRoutePointMetadata } from './orderDetails';
import type { RoutePointKey } from './orderDetails';

/**
 * Converte um Pedido retornado por POST /pedidos/list_pedidos em um Place ativo no mapa
 * Respeitando a dinâmica exata:
 * 1. Inicial / Pendente / Coletando -> marcador ativo na COLETA
 * 2. Coletado -> se troca, vai para TROCA; se entrega, vai para ENTREGA
 * 3. Trocado -> vai para a ENTREGA final
 * 4. Entregue / Finalizado -> orderStage: 'concluido'
 */
export function backendPedidoToPlace(pedido: BackendPedido): Place {
  const isExchange = pedido.tipo_encomenda === 'troca' || Boolean(pedido.troca_lat);
  
  const rawColetaLat = pedido.coleta_locais_lat ?? pedido.coleta_lat;
  const rawColetaLng = pedido.coleta_locais_lng ?? pedido.coleta_lng;
  const rawEntregaLat = pedido.entrega_locais_lat ?? pedido.entrega_lat;
  const rawEntregaLng = pedido.entrega_locais_lng ?? pedido.entrega_lng;

  const hasRealColeta = rawColetaLat != null && rawColetaLng != null && !isNaN(Number(rawColetaLat));
  const hasRealEntrega = rawEntregaLat != null && rawEntregaLng != null && !isNaN(Number(rawEntregaLat));

  const parsedColetaLat = typeof rawColetaLat === 'string' ? parseFloat(rawColetaLat) : Number(rawColetaLat);
  const parsedColetaLng = typeof rawColetaLng === 'string' ? parseFloat(rawColetaLng) : Number(rawColetaLng);
  const parsedEntregaLat = typeof rawEntregaLat === 'string' ? parseFloat(rawEntregaLat) : Number(rawEntregaLat);
  const parsedEntregaLng = typeof rawEntregaLng === 'string' ? parseFloat(rawEntregaLng) : Number(rawEntregaLng);

  const fallbackLat = !isNaN(parsedColetaLat) ? parsedColetaLat : (!isNaN(parsedEntregaLat) ? parsedEntregaLat : -16.686891);
  const fallbackLng = !isNaN(parsedColetaLng) ? parsedColetaLng : (!isNaN(parsedEntregaLng) ? parsedEntregaLng : -49.264794);

  const coletaLat = !isNaN(parsedColetaLat) ? parsedColetaLat : fallbackLat;
  const coletaLng = !isNaN(parsedColetaLng) ? parsedColetaLng : fallbackLng;
  const entregaLat = !isNaN(parsedEntregaLat) ? parsedEntregaLat : fallbackLat;
  const entregaLng = !isNaN(parsedEntregaLng) ? parsedEntregaLng : fallbackLng;
  
  const trocaLat = pedido.troca_lat ? (typeof pedido.troca_lat === 'string' ? parseFloat(pedido.troca_lat) : Number(pedido.troca_lat)) : undefined;
  const trocaLng = pedido.troca_lng ? (typeof pedido.troca_lng === 'string' ? parseFloat(pedido.troca_lng) : Number(pedido.troca_lng)) : undefined;

  const pickupCoords: LocationCoordinates = { lat: coletaLat, lng: coletaLng };
  const deliveryCoords: LocationCoordinates = { lat: entregaLat, lng: entregaLng };
  const exchangeCoords: LocationCoordinates | undefined = trocaLat !== undefined && trocaLng !== undefined && !isNaN(trocaLat) && !isNaN(trocaLng)
    ? { lat: trocaLat, lng: trocaLng }
    : undefined;

  const etapaNormalized = (pedido.etapa || 'aprovado').toLowerCase().trim();

  const coletaLocalName = pedido.coleta_local || pedido.coleta_locais_name || pedido.local || 'Ponto de Coleta';
  const entregaLocalName = pedido.entrega_local || pedido.entrega_locais_name || 'Ponto de Entrega';
  const coletaFullAddress = pedido.coleta_endereco || (pedido.coleta_cidade ? `${coletaLocalName} - ${pedido.coleta_cidade}` : coletaLocalName);
  const entregaFullAddress = pedido.entrega_endereco || (pedido.entrega_cidade ? `${entregaLocalName} - ${pedido.entrega_cidade}` : entregaLocalName);

  let activeOperationType: OperationType = 'coleta';
  let activeStage: 'coleta' | 'troca' | 'entrega' | 'retorno' | 'concluido' = 'coleta';
  let activeCoords = pickupCoords;
  let activeAddress = coletaFullAddress;
  let activeName = coletaLocalName;

  if (etapaNormalized === 'entregue' || etapaNormalized === 'finalizado' || etapaNormalized === 'concluido' || etapaNormalized === 'cancelado') {
    // Pedido totalmente concluído
    activeStage = 'concluido';
    activeOperationType = isExchange ? 'troca' : 'entrega';
    activeCoords = isExchange ? pickupCoords : deliveryCoords;
    activeAddress = isExchange ? coletaFullAddress : entregaFullAddress;
    activeName = isExchange ? `Retorno: ${coletaLocalName}` : entregaLocalName;
  } else if (isExchange) {
    if (etapaNormalized === 'trocado' || etapaNormalized === 'retornando' || etapaNormalized === 'segunda_entrega' || etapaNormalized === 'retorno') {
      activeStage = 'retorno';
      activeOperationType = 'entrega';
      activeCoords = pickupCoords;
      activeAddress = coletaFullAddress;
      activeName = `2ª Entrega (Retorno à Coleta): ${coletaLocalName}`;
    } else if (etapaNormalized === 'coletado' || etapaNormalized === 'trocando') {
      activeStage = 'troca';
      activeOperationType = 'troca';
      activeCoords = exchangeCoords || deliveryCoords;
      activeAddress = entregaFullAddress;
      activeName = entregaLocalName;
    } else {
      activeStage = 'coleta';
      activeOperationType = 'coleta';
      activeCoords = pickupCoords;
      activeAddress = coletaFullAddress;
      activeName = coletaLocalName;
    }
  } else {
    if (etapaNormalized === 'coletado' || etapaNormalized === 'entregando') {
      activeStage = 'entrega';
      activeOperationType = 'entrega';
      activeCoords = deliveryCoords;
      activeAddress = entregaFullAddress;
      activeName = entregaLocalName;
    } else {
      activeStage = 'coleta';
      activeOperationType = 'coleta';
      activeCoords = pickupCoords;
      activeAddress = coletaFullAddress;
      activeName = coletaLocalName;
    }
  }

  const vType = pedido.tipo_veiculo === 'carro' ? 'carro' : pedido.tipo_veiculo === 'utilitario' ? 'utilitario' : 'moto';

  const pickupPhotos = extractPhotoUrls(pedido.coleta_foto, 'md');
  const deliveryPhotos = extractPhotoUrls(pedido.entrega_foto, 'md');
  const orderPhotos = activeOperationType === 'coleta'
    ? pickupPhotos.concat(extractPhotoUrls(pedido.mercadoria_foto, 'md'))
    : deliveryPhotos.concat(pickupPhotos);
  const uniquePhotos = Array.from(new Set(orderPhotos));

  const activeObsRaw = activeOperationType === 'coleta'
    ? (pedido.coleta_obs ?? pedido.detalhes)
    : activeOperationType === 'troca' 
    ? (pedido.troca_obs ?? pedido.detalhes)
    : (pedido.entrega_obs ?? pedido.detalhes);
  const activeObs = (activeObsRaw || '').trim() || undefined;

  const activeResp = (activeOperationType === 'coleta' 
    ? (pedido.coleta_responsavel || pedido.coleta_contato) 
    : activeOperationType === 'troca' 
    ? (pedido.troca_responsavel || pedido.troca_contato) 
    : (pedido.entrega_responsavel || pedido.entrega_contato)) || undefined;

  const activeRespPhoneRaw = activeOperationType === 'coleta' 
    ? (pedido.coleta_responsavel_phone || pedido.coleta_phone) 
    : activeOperationType === 'troca' 
    ? (pedido.troca_responsavel_phone || pedido.troca_phone) 
    : (pedido.entrega_responsavel_phone || pedido.entrega_phone);
  const activeRespPhone = activeRespPhoneRaw ? String(activeRespPhoneRaw) : undefined;
  const activePointKey: RoutePointKey = activeOperationType === 'coleta'
    ? 'pickup'
    : activeOperationType === 'troca'
      ? 'exchange'
      : 'delivery';
  const activePointMetadata = getRoutePointMetadata(pedido, activePointKey, true);
  const pickupMetadata = getRoutePointMetadata(pedido, 'pickup');
  const exchangeMetadata = getRoutePointMetadata(pedido, 'exchange');
  const deliveryMetadata = getRoutePointMetadata(pedido, 'delivery');
  const mapOrderDetails = persistedMapOrderDetails(pedido);

  return withCollectionOwner({
    id: `pedido-${pedido.id}-${activeOperationType}`,
    ...pedidoPaymentFields(pedido),
    ...mapOrderDetails,
    ...collectionOwnership(pedido),
    pickupPhotos,
    deliveryPhotos,
    orderCode: `EZ-${pedido.id}-GO`,
    name: activeName,
    address: activeAddress,
    coordinates: activeCoords,
    category: isExchange ? 'Troca de Mercadoria' : activeOperationType === 'coleta' ? 'Coleta Expressa' : 'Entrega Expressa',
    operationType: activeOperationType,
    orderStage: activeStage,
    isExchangeOrder: isExchange,
    pickupVisibility: pickupMetadata.visibility,
    pickupAssignedDriverId: pickupMetadata.driverId,
    pickupAssignedDriverPhone: pickupMetadata.driverPhone,
    pickupAssignedDriverName: pickupMetadata.driverName,
    pickupSellerName: pickupMetadata.sellerName,
    pickupSellerPhone: pickupMetadata.sellerPhone,
    exchangeVisibility: exchangeMetadata.visibility,
    exchangeAssignedDriverId: exchangeMetadata.driverId,
    exchangeAssignedDriverPhone: exchangeMetadata.driverPhone,
    exchangeAssignedDriverName: exchangeMetadata.driverName,
    exchangeSellerName: exchangeMetadata.sellerName,
    exchangeSellerPhone: exchangeMetadata.sellerPhone,
    deliveryVisibility: deliveryMetadata.visibility,
    deliveryAssignedDriverId: deliveryMetadata.driverId,
    deliveryAssignedDriverPhone: deliveryMetadata.driverPhone,
    deliveryAssignedDriverName: deliveryMetadata.driverName,
    deliverySellerName: deliveryMetadata.sellerName,
    deliverySellerPhone: deliveryMetadata.sellerPhone,
    customerName: pedido.cliente || '',
    customerPhone: pedido.phone ? String(pedido.phone) : undefined,
    originCity: pedido.coleta_cidade || pedido.cidade || 'Goiânia - GO',
    destinationCity: pedido.entrega_cidade || pedido.cidade || 'Goiânia - GO',
    vehicleType: vType,
    driverNotes: activeObs,
    observations: activeObs,
    responsibleName: activeResp,
    responsiblePhone: activeRespPhone,
    managerName: activeResp,
    managerPhone: activeRespPhone,
    sellerName: activePointMetadata.sellerName || activeResp,
    sellerPhone: activePointMetadata.sellerPhone || activeRespPhone,
    orderVisibility: activePointMetadata.visibility,
    assignedDriverId: activePointMetadata.driverId,
    assignedDriverName: activePointMetadata.driverName || extractDriverAssignmentFromPedido(pedido, activeOperationType).driverName,
    assignedDriverPhone: activePointMetadata.driverPhone || extractDriverAssignmentFromPedido(pedido, activeOperationType).driverPhone,
    imageUrl: uniquePhotos[0] || undefined,
    photos: uniquePhotos.length > 0 ? uniquePhotos : undefined,
    
    // Dados completos dos pontos da encomenda
    pickupName: coletaLocalName,
    pickupAddress: coletaFullAddress,
    pickupCoordinates: pickupCoords,
    pickupContact: pedido.coleta_contato,
    pickupPhone: pedido.coleta_phone,
    pickupNotes: pedido.coleta_obs,

    exchangeName: pedido.troca_nome || entregaLocalName,
    exchangeAddress: pedido.troca_endereco || entregaFullAddress,
    exchangeCoordinates: exchangeCoords || deliveryCoords,
    exchangeContact: pedido.troca_contato,
    exchangePhone: pedido.troca_phone,
    exchangeNotes: pedido.troca_obs,

    deliveryName: entregaLocalName,
    deliveryAddress: entregaFullAddress,
    deliveryCoordinates: deliveryCoords,
    deliveryContact: pedido.entrega_contato,
    deliveryPhone: pedido.entrega_phone,
    deliveryNotes: pedido.entrega_obs,
    orderDateBadge: getOrderDateBadgeFromDate(pedido.data || pedido.created_at || (pedido as any).coleta_data)
  }, pedido.coleta_user_nome);
}

/**
 * Converte um Pedido em todas as suas paradas ativas no mapa (Coleta e/ou Entrega/Troca)
 * - Se etapa for 'aprovado'/'coletando': gera parada de Coleta E parada de Entrega
 * - Se etapa for 'coletado'/'trocando': a coleta já acabou, gera apenas parada de Entrega/Troca
 * - Se etapa for 'trocado': gera parada de 2ª entrega (retorno à coleta)
 * - Se etapa for 'entregue'/'finalizado': não gera nada (já finalizado)
 */
export function backendPedidoToPlaces(pedido: BackendPedido): Place[] {
  const etapaNormalized = (pedido.etapa || 'aprovado').toLowerCase().trim();
  if (etapaNormalized === 'entregue' || etapaNormalized === 'finalizado' || etapaNormalized === 'concluido' || etapaNormalized === 'cancelado') {
    return [];
  }

  const isExchange = pedido.tipo_encomenda === 'troca' || Boolean(pedido.troca_lat);
  
  const rawColetaLat = pedido.coleta_locais_lat ?? pedido.coleta_lat;
  const rawColetaLng = pedido.coleta_locais_lng ?? pedido.coleta_lng;
  const rawEntregaLat = pedido.entrega_locais_lat ?? pedido.entrega_lat;
  const rawEntregaLng = pedido.entrega_locais_lng ?? pedido.entrega_lng;
  const rawTrocaLat = pedido.troca_lat;
  const rawTrocaLng = pedido.troca_lng;

  // 1. Tenta coordenadas explícitas nos campos do pedido
  let parsedColetaLat = typeof rawColetaLat === 'string' ? parseFloat(rawColetaLat) : Number(rawColetaLat);
  let parsedColetaLng = typeof rawColetaLng === 'string' ? parseFloat(rawColetaLng) : Number(rawColetaLng);
  let parsedEntregaLat = typeof rawEntregaLat === 'string' ? parseFloat(rawEntregaLat) : Number(rawEntregaLat);
  let parsedEntregaLng = typeof rawEntregaLng === 'string' ? parseFloat(rawEntregaLng) : Number(rawEntregaLng);
  const parsedTrocaLat = typeof rawTrocaLat === 'string' ? parseFloat(rawTrocaLat) : Number(rawTrocaLat);
  const parsedTrocaLng = typeof rawTrocaLng === 'string' ? parseFloat(rawTrocaLng) : Number(rawTrocaLng);

  // 2. Se coletaLat ou coletaLng estiver ausente, extrai do texto do endereço ou busca local conhecido
  if (isNaN(parsedColetaLat) || isNaN(parsedColetaLng) || parsedColetaLat === 0) {
    const extractedColeta = extractCoordsFromString(pedido.coleta_endereco) || 
                            extractCoordsFromString(pedido.coleta_local) || 
                            extractCoordsFromString(pedido.local) ||
                            resolveKnownAddressCoordinates(pedido.coleta_endereco) ||
                            resolveKnownAddressCoordinates(pedido.coleta_local) ||
                            resolveKnownAddressCoordinates(pedido.local);
    if (extractedColeta) {
      parsedColetaLat = extractedColeta.lat;
      parsedColetaLng = extractedColeta.lng;
    }
  }

  // 3. Se entregaLat ou entregaLng estiver ausente, extrai do texto do endereço ou busca local conhecido
  if (isNaN(parsedEntregaLat) || isNaN(parsedEntregaLng) || parsedEntregaLat === 0) {
    const extractedEntrega = extractCoordsFromString(pedido.entrega_endereco) || 
                             extractCoordsFromString(pedido.entrega_local) ||
                             resolveKnownAddressCoordinates(pedido.entrega_endereco) ||
                             resolveKnownAddressCoordinates(pedido.entrega_local);
    if (extractedEntrega) {
      parsedEntregaLat = extractedEntrega.lat;
      parsedEntregaLng = extractedEntrega.lng;
    }
  }

  // 4. Jitter determinístico para fallback de modo que cada pedido fique visível e individual no mapa
  const numId = typeof pedido.id === 'number' ? pedido.id : (parseInt(String(pedido.id).replace(/\D/g, '').slice(-6), 10) || 1234);
  const jitterLat = (((numId * 17) % 50) - 25) * 0.00035;
  const jitterLng = (((numId * 31) % 50) - 25) * 0.00035;
  const fallbackLat = -16.686891 + jitterLat;
  const fallbackLng = -49.264794 + jitterLng;

  const hasColetaAddressOrName = Boolean((pedido.coleta_endereco && pedido.coleta_endereco.trim()) || (pedido.coleta_local && pedido.coleta_local.trim()) || (pedido.coleta_locais_name && pedido.coleta_locais_name.trim()) || (pedido.local && pedido.local.trim()));
  const hasEntregaAddressOrName = Boolean((pedido.entrega_endereco && pedido.entrega_endereco.trim()) || (pedido.entrega_local && pedido.entrega_local.trim()) || (pedido.entrega_locais_name && pedido.entrega_locais_name.trim()) || (pedido.entrega_nome && pedido.entrega_nome.trim()));

  const hasRealColeta = !isNaN(parsedColetaLat) && !isNaN(parsedColetaLng) && parsedColetaLat !== 0 && hasColetaAddressOrName;
  const hasRealEntrega = !isNaN(parsedEntregaLat) && !isNaN(parsedEntregaLng) && parsedEntregaLat !== 0 && hasEntregaAddressOrName;
  const hasRealTroca = !isNaN(parsedTrocaLat) && !isNaN(parsedTrocaLng) && parsedTrocaLat !== 0;

  const coletaLat = hasRealColeta ? parsedColetaLat : (hasRealEntrega ? parsedEntregaLat : fallbackLat);
  const coletaLng = hasRealColeta ? parsedColetaLng : (hasRealEntrega ? parsedEntregaLng : fallbackLng);
  const entregaLat = hasRealEntrega ? parsedEntregaLat : (hasRealColeta ? parsedColetaLat : fallbackLat);
  const entregaLng = hasRealEntrega ? parsedEntregaLng : (hasRealColeta ? parsedColetaLng : fallbackLng);

  const pickupCoords: LocationCoordinates = { lat: coletaLat, lng: coletaLng };
  const deliveryCoords: LocationCoordinates = { lat: entregaLat, lng: entregaLng };
  const exchangeCoords: LocationCoordinates | undefined = hasRealTroca
    ? { lat: parsedTrocaLat, lng: parsedTrocaLng }
    : undefined;

  const rawColetaName = pedido.coleta_local || pedido.coleta_locais_name || pedido.local;
  const coletaLocalName = (rawColetaName && rawColetaName !== 'Ponto de Coleta')
    ? rawColetaName
    : (pedido.cliente ? `Coleta: ${pedido.cliente}` : (pedido.coleta_endereco?.slice(0, 30) || 'Ponto de Coleta'));

  const rawEntregaName = pedido.entrega_local || pedido.entrega_locais_name;
  const entregaLocalName = (rawEntregaName && rawEntregaName !== 'Ponto de Entrega')
    ? rawEntregaName
    : (pedido.cliente ? `Entrega: ${pedido.cliente}` : (pedido.entrega_endereco?.slice(0, 30) || 'Ponto de Entrega'));

  const coletaFullAddress = pedido.coleta_endereco || (pedido.coleta_cidade ? `${coletaLocalName} - ${pedido.coleta_cidade}` : coletaLocalName);
  const entregaFullAddress = pedido.entrega_endereco || (pedido.entrega_cidade ? `${entregaLocalName} - ${pedido.entrega_cidade}` : entregaLocalName);

  const vType: VehicleCollectionType = pedido.tipo_veiculo === 'carro' ? 'carro' : pedido.tipo_veiculo === 'utilitario' ? 'utilitario' : 'moto';
  const dateBadge = getOrderDateBadgeFromDate(pedido.data || pedido.created_at);
  const cleanOrderDate = String(pedido.data || pedido.created_at || '').slice(0, 10) || undefined;
  const pickupMetadata = getRoutePointMetadata(pedido, 'pickup');
  const exchangeMetadata = getRoutePointMetadata(pedido, 'exchange');
  const deliveryMetadata = getRoutePointMetadata(pedido, 'delivery');
  const mapOrderDetails = persistedMapOrderDetails(pedido);

  const baseShared = {
    ...pedidoPaymentFields(pedido),
    ...mapOrderDetails,
    ...collectionOwnership(pedido),
    pickupPhotos: extractPhotoUrls(pedido.coleta_foto, 'md'),
    deliveryPhotos: extractPhotoUrls(pedido.entrega_foto, 'md'),
    id: `pedido-${pedido.id}`,
    orderId: String(pedido.id),
    pedido_id: pedido.id,
    orderCode: `EZ-${pedido.id}-GO`,
    customerName: pedido.cliente || '',
    customerPhone: pedido.phone ? String(pedido.phone) : undefined,
    originCity: pedido.coleta_cidade || pedido.cidade || 'Goiânia - GO',
    destinationCity: pedido.entrega_cidade || pedido.cidade || 'Goiânia - GO',
    vehicleType: vType,
    openNow: true,
    isExchangeOrder: isExchange,
    orderDateBadge: dateBadge,
    acceptedByDriver: pickupMetadata.acceptedByDriver,
    scheduledDate: cleanOrderDate,
    data: cleanOrderDate,
    orderDate: cleanOrderDate,
    driverNotes: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
    observations: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
    pickupVisibility: pickupMetadata.visibility,
    pickupAssignedDriverId: pickupMetadata.driverId,
    pickupAssignedDriverPhone: pickupMetadata.driverPhone,
    pickupAssignedDriverName: pickupMetadata.driverName,
    pickupSellerName: pickupMetadata.sellerName,
    pickupSellerPhone: pickupMetadata.sellerPhone,
    exchangeVisibility: exchangeMetadata.visibility,
    exchangeAssignedDriverId: exchangeMetadata.driverId,
    exchangeAssignedDriverPhone: exchangeMetadata.driverPhone,
    exchangeAssignedDriverName: exchangeMetadata.driverName,
    exchangeSellerName: exchangeMetadata.sellerName,
    exchangeSellerPhone: exchangeMetadata.sellerPhone,
    deliveryVisibility: deliveryMetadata.visibility,
    deliveryAssignedDriverId: deliveryMetadata.driverId,
    deliveryAssignedDriverPhone: deliveryMetadata.driverPhone,
    deliveryAssignedDriverName: deliveryMetadata.driverName,
    deliverySellerName: deliveryMetadata.sellerName,
    deliverySellerPhone: deliveryMetadata.sellerPhone,
    pickupName: coletaLocalName,
    pickupAddress: coletaFullAddress,
    pickupCoordinates: hasRealColeta ? pickupCoords : undefined,
    pickupContact: pedido.coleta_contato,
    pickupPhone: pedido.coleta_phone,
    pickupNotes: pedido.coleta_obs ?? pedido.detalhes,
    deliveryName: entregaLocalName,
    deliveryAddress: entregaFullAddress,
    deliveryCoordinates: hasRealEntrega ? deliveryCoords : undefined,
    deliveryContact: pedido.entrega_contato,
    deliveryPhone: pedido.entrega_phone,
    deliveryNotes: pedido.entrega_obs ?? pedido.detalhes,
    exchangeName: pedido.troca_nome || entregaLocalName,
    exchangeAddress: pedido.troca_endereco || entregaFullAddress,
    exchangeCoordinates: isExchange ? exchangeCoords || (hasRealEntrega ? deliveryCoords : undefined) : undefined,
    exchangeContact: pedido.troca_contato,
    exchangePhone: pedido.troca_phone,
    exchangeNotes: pedido.troca_obs ?? pedido.detalhes,
  };

  const coletaDriver = extractDriverAssignmentFromPedido(pedido, 'coleta');
  const entregaDriver = extractDriverAssignmentFromPedido(pedido, 'entrega');
  const trocaDriver = extractDriverAssignmentFromPedido(pedido, 'troca');

  const coletaPhotos = Array.from(new Set(extractPhotoUrls(pedido.coleta_foto, 'md').concat(extractPhotoUrls(pedido.mercadoria_foto, 'md'))));
  const entregaPhotos = extractPhotoUrls(pedido.entrega_foto, 'md');

  const places: Place[] = [];

  const isColetaAtiva = etapaNormalized === 'aprovado' || etapaNormalized === 'pendente' || etapaNormalized === 'coletando';
  const isColetado = etapaNormalized === 'coletado' || etapaNormalized === 'trocando' || etapaNormalized === 'trocado' || etapaNormalized === 'retornando' || etapaNormalized === 'entregando';
  const isTrocado = etapaNormalized === 'trocado' || etapaNormalized === 'retornando' || etapaNormalized === 'segunda_entrega' || etapaNormalized === 'retorno';

  // REGRA 1: "se nao tiver local de coleta so aparece o local de entrega ou troca"
  if (!hasRealColeta) {
    if (isExchange) {
      if (!isTrocado && etapaNormalized !== 'entregue' && etapaNormalized !== 'finalizado') {
        places.push({
          ...baseShared,
          id: `pedido-${pedido.id}-troca`,
          name: entregaLocalName,
          address: entregaFullAddress,
          coordinates: deliveryCoords,
          imageUrl: undefined,
          photos: undefined,
          category: 'Troca de Mercadoria',
          operationType: 'troca',
          orderStage: 'troca',
          assignedDriverId: exchangeMetadata.driverId,
          assignedDriverName: exchangeMetadata.driverName,
          assignedDriverPhone: exchangeMetadata.driverPhone,
          orderVisibility: exchangeMetadata.visibility,
          sellerName: exchangeMetadata.sellerName,
          sellerPhone: exchangeMetadata.sellerPhone,
          observations: (pedido.troca_obs ?? pedido.detalhes ?? '').trim() || undefined,
          driverNotes: (pedido.troca_obs ?? pedido.detalhes ?? '').trim() || undefined,
          responsibleName: pedido.troca_responsavel || pedido.troca_contato || undefined,
          responsiblePhone: (pedido.troca_responsavel_phone || pedido.troca_phone) ? String(pedido.troca_responsavel_phone || pedido.troca_phone) : undefined,
          managerName: pedido.troca_responsavel || pedido.troca_contato || undefined,
          managerPhone: (pedido.troca_responsavel_phone || pedido.troca_phone) ? String(pedido.troca_responsavel_phone || pedido.troca_phone) : undefined,
        });
      }
    } else {
      if (etapaNormalized !== 'entregue' && etapaNormalized !== 'finalizado') {
        places.push({
          ...baseShared,
          id: `pedido-${pedido.id}-entrega`,
          name: entregaLocalName,
          address: entregaFullAddress,
          coordinates: deliveryCoords,
          imageUrl: entregaPhotos[0] || coletaPhotos[0] || undefined,
          photos: [...entregaPhotos, ...coletaPhotos],
          category: 'Entrega Expressa',
          operationType: 'entrega',
          orderStage: 'entrega',
          assignedDriverId: deliveryMetadata.driverId,
          assignedDriverName: deliveryMetadata.driverName,
          assignedDriverPhone: deliveryMetadata.driverPhone,
          orderVisibility: deliveryMetadata.visibility,
          sellerName: deliveryMetadata.sellerName,
          sellerPhone: deliveryMetadata.sellerPhone,
          observations: (pedido.entrega_obs ?? pedido.detalhes ?? '').trim() || undefined,
          driverNotes: (pedido.entrega_obs ?? pedido.detalhes ?? '').trim() || undefined,
          responsibleName: pedido.entrega_responsavel || pedido.entrega_contato || undefined,
          responsiblePhone: (pedido.entrega_responsavel_phone || pedido.entrega_phone) ? String(pedido.entrega_responsavel_phone || pedido.entrega_phone) : undefined,
          managerName: pedido.entrega_responsavel || pedido.entrega_contato || undefined,
          managerPhone: (pedido.entrega_responsavel_phone || pedido.entrega_phone) ? String(pedido.entrega_responsavel_phone || pedido.entrega_phone) : undefined,
        });
      }
    }
    return places.map(place => withCollectionOwner(place, pedido.coleta_user_nome));
  }

  // REGRA 2: "primeiro aparece o local de coleta, se nao tiver local de entrega ela some"
  if (!hasRealEntrega && !isExchange) {
    if (isColetado) {
      // Ao coletar, como não tem entrega, ELA SOME!
      return [];
    }
    places.push({
      ...baseShared,
      id: `pedido-${pedido.id}-coleta`,
      name: coletaLocalName,
      address: coletaFullAddress,
      coordinates: pickupCoords,
      imageUrl: coletaPhotos[0] || undefined,
      photos: coletaPhotos.length > 0 ? coletaPhotos : undefined,
      category: 'Coleta Expressa',
      operationType: 'coleta',
      orderStage: 'coleta',
      assignedDriverId: pickupMetadata.driverId,
      assignedDriverName: pickupMetadata.driverName,
      assignedDriverPhone: pickupMetadata.driverPhone,
      orderVisibility: pickupMetadata.visibility,
      sellerName: pickupMetadata.sellerName,
      sellerPhone: pickupMetadata.sellerPhone,
      observations: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
      driverNotes: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
      responsibleName: pedido.coleta_responsavel || pedido.coleta_contato || undefined,
      responsiblePhone: (pedido.coleta_responsavel_phone || pedido.coleta_phone) ? String(pedido.coleta_responsavel_phone || pedido.coleta_phone) : undefined,
      managerName: pedido.coleta_responsavel || pedido.coleta_contato || undefined,
      managerPhone: (pedido.coleta_responsavel_phone || pedido.coleta_phone) ? String(pedido.coleta_responsavel_phone || pedido.coleta_phone) : undefined,
    });
    return places.map(place => withCollectionOwner(place, pedido.coleta_user_nome));
  }

  // REGRAS 3 e 4: Tem Coleta E Entrega (ou Troca):
  // "se tiver os dois deve seguir assim:
  // primeiro aparece so o local de coleta ao coletar aparece o local de entrega
  // se for troca primeiro e coleta, depois e local de troca, por ultimo o local de coleta vira o local de entrega"
  if (isColetaAtiva) {
    // 1ª Etapa: aparece SÓ o local de coleta
    places.push({
      ...baseShared,
      id: `pedido-${pedido.id}-coleta`,
      name: coletaLocalName,
      address: coletaFullAddress,
      coordinates: pickupCoords,
      imageUrl: coletaPhotos[0] || undefined,
      photos: coletaPhotos.length > 0 ? coletaPhotos : undefined,
      category: isExchange ? 'Troca de Mercadoria' : 'Coleta Expressa',
      operationType: 'coleta',
      orderStage: 'coleta',
      assignedDriverId: pickupMetadata.driverId,
      assignedDriverName: pickupMetadata.driverName,
      assignedDriverPhone: pickupMetadata.driverPhone,
      orderVisibility: pickupMetadata.visibility,
      sellerName: pickupMetadata.sellerName,
      sellerPhone: pickupMetadata.sellerPhone,
      observations: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
      driverNotes: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
      responsibleName: pedido.coleta_responsavel || pedido.coleta_contato || undefined,
      responsiblePhone: (pedido.coleta_responsavel_phone || pedido.coleta_phone) ? String(pedido.coleta_responsavel_phone || pedido.coleta_phone) : undefined,
      managerName: pedido.coleta_responsavel || pedido.coleta_contato || undefined,
      managerPhone: (pedido.coleta_responsavel_phone || pedido.coleta_phone) ? String(pedido.coleta_responsavel_phone || pedido.coleta_phone) : undefined,
    });
  } else if (isExchange) {
    // Pedido com Troca:
    if (isTrocado) {
      // 3ª Etapa: Troca já feita! "por ultimo o local de coleta vira o local de entrega"
      places.push({
        ...baseShared,
        id: `pedido-${pedido.id}-retorno`,
        name: `2ª Entrega (Retorno à Coleta): ${coletaLocalName}`,
        address: coletaFullAddress,
        coordinates: pickupCoords,
        imageUrl: coletaPhotos[0] || undefined,
        photos: coletaPhotos,
        category: 'Troca de Mercadoria',
        operationType: 'entrega',
        orderStage: 'retorno',
        assignedDriverId: deliveryMetadata.driverId,
        assignedDriverName: deliveryMetadata.driverName,
        assignedDriverPhone: deliveryMetadata.driverPhone,
        orderVisibility: deliveryMetadata.visibility || pickupMetadata.visibility,
        sellerName: deliveryMetadata.sellerName || pickupMetadata.sellerName,
        sellerPhone: deliveryMetadata.sellerPhone || pickupMetadata.sellerPhone,
        observations: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
        driverNotes: (pedido.coleta_obs ?? pedido.detalhes ?? '').trim() || undefined,
        responsibleName: pedido.coleta_responsavel || pedido.coleta_contato || undefined,
        responsiblePhone: (pedido.coleta_responsavel_phone || pedido.coleta_phone) ? String(pedido.coleta_responsavel_phone || pedido.coleta_phone) : undefined,
      });
    } else if (isColetado) {
      // 2ª Etapa: Coleta já foi feita! "depois e local de troca"
      places.push({
        ...baseShared,
        id: `pedido-${pedido.id}-troca`,
        name: entregaLocalName,
        address: entregaFullAddress,
        coordinates: deliveryCoords,
        imageUrl: coletaPhotos[0] || undefined,
        photos: coletaPhotos,
        category: 'Troca de Mercadoria',
        operationType: 'troca',
        orderStage: 'troca',
        assignedDriverId: exchangeMetadata.driverId,
        assignedDriverName: exchangeMetadata.driverName,
        assignedDriverPhone: exchangeMetadata.driverPhone,
        orderVisibility: exchangeMetadata.visibility,
        sellerName: exchangeMetadata.sellerName,
        sellerPhone: exchangeMetadata.sellerPhone,
        observations: (pedido.troca_obs ?? pedido.detalhes ?? '').trim() || undefined,
        driverNotes: (pedido.troca_obs ?? pedido.detalhes ?? '').trim() || undefined,
        responsibleName: pedido.troca_responsavel || pedido.troca_contato || undefined,
        responsiblePhone: (pedido.troca_responsavel_phone || pedido.troca_phone) ? String(pedido.troca_responsavel_phone || pedido.troca_phone) : undefined,
        managerName: pedido.troca_responsavel || pedido.troca_contato || undefined,
        managerPhone: (pedido.troca_responsavel_phone || pedido.troca_phone) ? String(pedido.troca_responsavel_phone || pedido.troca_phone) : undefined,
      });
    }
  } else {
    // Pedido normal: "ao coletar aparece o local de entrega"
    if (isColetado) {
      places.push({
        ...baseShared,
        id: `pedido-${pedido.id}-entrega`,
        name: entregaLocalName,
        address: entregaFullAddress,
        coordinates: deliveryCoords,
        imageUrl: entregaPhotos[0] || coletaPhotos[0] || undefined,
        photos: [...entregaPhotos, ...coletaPhotos],
        category: 'Entrega Expressa',
        operationType: 'entrega',
        orderStage: 'entrega',
        assignedDriverId: deliveryMetadata.driverId,
        assignedDriverName: deliveryMetadata.driverName,
        assignedDriverPhone: deliveryMetadata.driverPhone,
        orderVisibility: deliveryMetadata.visibility,
        sellerName: deliveryMetadata.sellerName,
        sellerPhone: deliveryMetadata.sellerPhone,
        observations: (pedido.entrega_obs ?? pedido.detalhes ?? '').trim() || undefined,
        driverNotes: (pedido.entrega_obs ?? pedido.detalhes ?? '').trim() || undefined,
        responsibleName: pedido.entrega_responsavel || pedido.entrega_contato || undefined,
        responsiblePhone: (pedido.entrega_responsavel_phone || pedido.entrega_phone) ? String(pedido.entrega_responsavel_phone || pedido.entrega_phone) : undefined,
        managerName: pedido.entrega_responsavel || pedido.entrega_contato || undefined,
        managerPhone: (pedido.entrega_responsavel_phone || pedido.entrega_phone) ? String(pedido.entrega_responsavel_phone || pedido.entrega_phone) : undefined,
      });
    }
  }

  return places.map(place => withCollectionOwner(place, pedido.coleta_user_nome));
}

/**
 * Converte um marcador retornado por POST /tracking/order_markers em um Place no mapa.
 * Garante que:
 * 1. Marcador com tipo === 'coleta' é SEMPRE Coleta (coordenadas, nome do local e operação da coleta)
 * 2. Marcador com tipo === 'entrega' é SEMPRE Entrega ou Troca (coordenadas, nome do local e operação de entrega)
 * 3. Nome do Local fica SEMPRE em destaque no topo do marcador
 */
export function backendOrderMarkerToPlace(
  marker: BackendOrderMarker,
  dateBadge: OrderDateBadgeType = 'hoje',
  fullPedido?: BackendPedido
): Place {
  const lat = typeof marker.lat === 'string' ? parseFloat(marker.lat) : marker.lat;
  const lng = typeof marker.lng === 'string' ? parseFloat(marker.lng) : marker.lng;
  const validLat = isNaN(lat) ? -16.686891 : lat;
  const validLng = isNaN(lng) ? -49.264794 : lng;

  const etapaNormalized = (fullPedido?.etapa || marker.etapa || 'aprovado').toLowerCase().trim();
  const isExchange = marker.tipo === 'troca' || fullPedido?.tipo_encomenda === 'troca' || Boolean(fullPedido?.troca_lat);

  // IDENTIFICAÇÃO ESTRITA DA OPERAÇÃO:
  // Se o marcador veio como 'coleta', ele é ESTRITAMENTE 'coleta'!
  // Se o marcador veio como 'entrega', se o pedido for 'troca' é 'troca', senão 'entrega'!
  // Para trocas: 1º Coleta -> 2º Troca -> 3º Entrega (retorno à coleta) -> Concluído (some do mapa)
  const isColetaMarker = marker.tipo === 'coleta';
  let activeOp: OperationType = isColetaMarker 
    ? 'coleta' 
    : (isExchange || marker.tipo === 'troca' ? 'troca' : 'entrega');

  let activeStage: 'coleta' | 'troca' | 'entrega' | 'retorno' | 'concluido' = isColetaMarker
    ? 'coleta'
    : (isExchange ? 'troca' : 'entrega');

  if (etapaNormalized === 'entregue' || etapaNormalized === 'finalizado' || etapaNormalized === 'concluido' || etapaNormalized === 'cancelado') {
    activeStage = 'concluido';
  } else if (isExchange && (etapaNormalized === 'trocado' || etapaNormalized === 'retornando' || etapaNormalized === 'segunda_entrega' || etapaNormalized === 'retorno')) {
    activeStage = 'retorno';
    activeOp = 'entrega'; // 3ª Etapa: Retorno ao ponto de coleta é uma Entrega!
  }

  // Nome do Local SEMPRE em cima (em todas as makers)
  const clientName = fullPedido?.cliente || marker.cliente || `Pedido #${marker.pedido_id}`;
  
  const localName = marker.local_name || 
    (isColetaMarker
      ? (fullPedido?.coleta_local || fullPedido?.coleta_locais_name || 'Ponto de Coleta')
      : (fullPedido?.entrega_local || fullPedido?.entrega_locais_name || 'Ponto de Entrega'));

  const city = isColetaMarker
    ? (fullPedido?.coleta_cidade || fullPedido?.coleta_locais_cidade || fullPedido?.cidade)
    : (fullPedido?.entrega_cidade || fullPedido?.entrega_locais_cidade || fullPedido?.cidade);

  const fullAddress = city && !localName.toLowerCase().includes(city.toLowerCase())
    ? `${localName} - ${city}`
    : localName;

  // Mantém a foto da coleta disponível também nas etapas seguintes.
  let photoUrl: string | undefined = undefined;
  let markerPhotos: string[] = [];
  if (fullPedido) {
    const rawPhotos = isColetaMarker
      ? extractPhotoUrls(fullPedido.coleta_foto, 'md').concat(extractPhotoUrls(fullPedido.mercadoria_foto, 'md'))
      : extractPhotoUrls(fullPedido.entrega_foto, 'md').concat(extractPhotoUrls(fullPedido.coleta_foto, 'md'));
    markerPhotos = Array.from(new Set(rawPhotos));
    photoUrl = markerPhotos[0] || undefined;
  }

  const vType = fullPedido?.tipo_veiculo === 'carro' ? 'carro' : fullPedido?.tipo_veiculo === 'utilitario' ? 'utilitario' : 'moto';

  // Coordenadas dos pontos de coleta e entrega (para cálculo de rota e detalhes)
  const rawColetaLat = fullPedido?.coleta_locais_lat ?? fullPedido?.coleta_lat ?? (isColetaMarker ? validLat : undefined);
  const rawColetaLng = fullPedido?.coleta_locais_lng ?? fullPedido?.coleta_lng ?? (isColetaMarker ? validLng : undefined);
  const rawEntregaLat = fullPedido?.entrega_locais_lat ?? fullPedido?.entrega_lat ?? (!isColetaMarker ? validLat : undefined);
  const rawEntregaLng = fullPedido?.entrega_locais_lng ?? fullPedido?.entrega_lng ?? (!isColetaMarker ? validLng : undefined);

  const parsedColetaLat = typeof rawColetaLat === 'string' ? parseFloat(rawColetaLat) : Number(rawColetaLat);
  const parsedColetaLng = typeof rawColetaLng === 'string' ? parseFloat(rawColetaLng) : Number(rawColetaLng);
  const parsedEntregaLat = typeof rawEntregaLat === 'string' ? parseFloat(rawEntregaLat) : Number(rawEntregaLat);
  const parsedEntregaLng = typeof rawEntregaLng === 'string' ? parseFloat(rawEntregaLng) : Number(rawEntregaLng);

  const coletaLat = !isNaN(parsedColetaLat) ? parsedColetaLat : (isColetaMarker ? validLat : -16.686891);
  const coletaLng = !isNaN(parsedColetaLng) ? parsedColetaLng : (isColetaMarker ? validLng : -49.264794);
  const entregaLat = !isNaN(parsedEntregaLat) ? parsedEntregaLat : (!isColetaMarker ? validLat : coletaLat);
  const entregaLng = !isNaN(parsedEntregaLng) ? parsedEntregaLng : (!isColetaMarker ? validLng : coletaLng);

  const pickupName = fullPedido?.coleta_local || fullPedido?.coleta_locais_name || (isColetaMarker ? localName : 'Ponto de Coleta');
  const deliveryName = fullPedido?.entrega_local || fullPedido?.entrega_locais_name || (!isColetaMarker ? localName : 'Ponto de Entrega');

  // Se for o retorno da troca (3ª etapa), o ponto de destino é o retorno ao ponto de coleta
  const isRetornoStage = activeStage === 'retorno';
  const finalCoords = isRetornoStage ? { lat: coletaLat, lng: coletaLng } : { lat: validLat, lng: validLng };
  const finalName = isRetornoStage ? `2ª Entrega (Retorno à Coleta): ${pickupName}` : localName;
  const finalAddress = isRetornoStage 
    ? (fullPedido?.coleta_cidade ? `${pickupName} - ${fullPedido.coleta_cidade}` : pickupName)
    : fullAddress;
  const activePointKey: RoutePointKey = activeOp === 'coleta' ? 'pickup' : activeOp === 'troca' ? 'exchange' : 'delivery';
  const markerAcceptedByDriver = marker.accepted_by_driver === true ||
    marker.accepted_by_driver === 1 ||
    marker.accepted_by_driver === '1' ||
    marker.accepted_by_driver === 'true';
  const markerVisibility = marker.order_visibility === 'privado' || marker.order_visibility === 'publico'
    ? marker.order_visibility
    : markerAcceptedByDriver ? 'privado' : undefined;
  const markerPointMetadata = {
    visibility: markerVisibility,
    driverId: marker.assigned_driver_id == null ? undefined : String(marker.assigned_driver_id),
    driverName: marker.assigned_driver_name,
    driverPhone: marker.assigned_driver_phone,
    acceptedByDriver: markerAcceptedByDriver,
    sellerName: undefined,
    sellerPhone: undefined
  };
  const pointMetadata = fullPedido
    ? getRoutePointMetadata(fullPedido, activePointKey, true)
    : markerPointMetadata;
  const pickupMetadata = fullPedido
    ? getRoutePointMetadata(fullPedido, 'pickup')
    : activeOp === 'coleta' ? markerPointMetadata : undefined;
  const exchangeMetadata = fullPedido
    ? getRoutePointMetadata(fullPedido, 'exchange')
    : activeOp === 'troca' ? markerPointMetadata : undefined;
  const deliveryMetadata = fullPedido
    ? getRoutePointMetadata(fullPedido, 'delivery')
    : activeOp === 'entrega' ? markerPointMetadata : undefined;
  const legacyDriver = extractDriverAssignmentFromPedido(
    fullPedido || { id: marker.pedido_id },
    isColetaMarker ? 'coleta' : activeOp === 'troca' ? 'troca' : 'entrega'
  );
  const activeNotes = isColetaMarker
    ? (fullPedido?.coleta_obs ?? fullPedido?.detalhes)
    : activeOp === 'troca'
      ? (fullPedido?.troca_obs ?? fullPedido?.detalhes)
      : (fullPedido?.entrega_obs ?? fullPedido?.detalhes);
  const activeResponsible = activeOp === 'coleta'
    ? (fullPedido?.coleta_responsavel || fullPedido?.coleta_contato)
    : activeOp === 'troca'
      ? (fullPedido?.troca_responsavel || fullPedido?.troca_contato)
      : (fullPedido?.entrega_responsavel || fullPedido?.entrega_contato);
  const activeResponsiblePhone = activeOp === 'coleta'
    ? (fullPedido?.coleta_responsavel_phone || fullPedido?.coleta_phone)
    : activeOp === 'troca'
      ? (fullPedido?.troca_responsavel_phone || fullPedido?.troca_phone)
      : (fullPedido?.entrega_responsavel_phone || fullPedido?.entrega_phone);
  const acceptedByDriver = Boolean(pointMetadata.acceptedByDriver || markerAcceptedByDriver);

  return withCollectionOwner({
    id: `pedido-${marker.pedido_id}-${marker.tipo}`,
    ...pedidoPaymentFields(fullPedido),
    ...(marker.collection_restricted ? {
      collectionRestricted: true,
      collectionOwnerId: marker.collection_owner_id ? String(marker.collection_owner_id) : undefined
    } : fullPedido ? collectionOwnership(fullPedido) : {
      collectionRestricted: Boolean(marker.collection_restricted),
      collectionOwnerId: marker.collection_owner_id ? String(marker.collection_owner_id) : undefined
    }),
    orderId: String(marker.pedido_id),
    pedido_id: marker.pedido_id,
    orderCode: `EZ-${marker.pedido_id}-GO`,
    name: finalName,
    address: finalAddress,
    coordinates: finalCoords,
    category: isExchange ? 'Troca de Mercadoria' : activeOp === 'coleta' ? 'Coleta Expressa' : 'Entrega Expressa',
    operationType: activeOp,
    orderStage: activeStage,
    orderDateBadge: dateBadge,
    scheduledDate: (fullPedido?.data ? String(fullPedido.data).slice(0, 10) : (marker as any).data ? String((marker as any).data).slice(0, 10) : undefined),
    data: (fullPedido?.data ? String(fullPedido.data).slice(0, 10) : (marker as any).data ? String((marker as any).data).slice(0, 10) : undefined),
    orderDate: (fullPedido?.data ? String(fullPedido.data).slice(0, 10) : (marker as any).data ? String((marker as any).data).slice(0, 10) : undefined),
    isExchangeOrder: isExchange,
    customerName: clientName,
    customerPhone: fullPedido?.phone ? String(fullPedido.phone) : undefined,
    originCity: fullPedido?.coleta_cidade || fullPedido?.cidade || 'Goiânia - GO',
    destinationCity: fullPedido?.entrega_cidade || fullPedido?.cidade || 'Goiânia - GO',
    vehicleType: vType,
    packageType: 'caixa',
    openNow: true,
    imageUrl: photoUrl,
    photos: markerPhotos.length > 0 ? markerPhotos : undefined,
    pickupPhotos: extractPhotoUrls(fullPedido?.coleta_foto, 'md'),
    deliveryPhotos: extractPhotoUrls(fullPedido?.entrega_foto, 'md'),
    assignedDriverId: pointMetadata.driverId || ((marker as any).assigned_driver_id ? String((marker as any).assigned_driver_id) : (marker as any).motorista_id ? String((marker as any).motorista_id) : undefined),
    assignedDriverName: pointMetadata.driverName || (marker as any).assigned_driver_name || undefined,
    assignedDriverPhone: pointMetadata.driverPhone || (marker as any).assigned_driver_phone || undefined,
    acceptedByDriver,
    orderVisibility: (acceptedByDriver || pointMetadata.driverId || (marker as any).assigned_driver_id || (marker as any).motorista_id) ? 'privado' : (pointMetadata.visibility || (marker as any).order_visibility || 'publico'),
    sellerName: pointMetadata.sellerName || activeResponsible || undefined,
    sellerPhone: pointMetadata.sellerPhone || (activeResponsiblePhone ? String(activeResponsiblePhone) : undefined),
    responsibleName: activeResponsible || undefined,
    responsiblePhone: activeResponsiblePhone ? String(activeResponsiblePhone) : undefined,
    managerName: activeResponsible || undefined,
    managerPhone: activeResponsiblePhone ? String(activeResponsiblePhone) : undefined,
    pickupVisibility: pickupMetadata?.visibility,
    pickupAssignedDriverId: pickupMetadata?.driverId,
    pickupAssignedDriverName: pickupMetadata?.driverName,
    pickupAssignedDriverPhone: pickupMetadata?.driverPhone,
    pickupSellerName: pickupMetadata?.sellerName,
    pickupSellerPhone: pickupMetadata?.sellerPhone,
    exchangeVisibility: exchangeMetadata?.visibility,
    exchangeAssignedDriverId: exchangeMetadata?.driverId,
    exchangeAssignedDriverName: exchangeMetadata?.driverName,
    exchangeAssignedDriverPhone: exchangeMetadata?.driverPhone,
    exchangeSellerName: exchangeMetadata?.sellerName,
    exchangeSellerPhone: exchangeMetadata?.sellerPhone,
    deliveryVisibility: deliveryMetadata?.visibility,
    deliveryAssignedDriverId: deliveryMetadata?.driverId,
    deliveryAssignedDriverName: deliveryMetadata?.driverName,
    deliveryAssignedDriverPhone: deliveryMetadata?.driverPhone,
    deliverySellerName: deliveryMetadata?.sellerName,
    deliverySellerPhone: deliveryMetadata?.sellerPhone,
    observations: (activeNotes ?? (marker as any).obs ?? (marker as any).observacao ?? (marker as any).detalhes ?? '').trim() || undefined,
    driverNotes: (activeNotes ?? (marker as any).obs ?? (marker as any).detalhes ?? '').trim() || undefined,
    pickupName,
    pickupAddress: fullPedido?.coleta_cidade ? `${pickupName} - ${fullPedido.coleta_cidade}` : pickupName,
    pickupCoordinates: { lat: coletaLat, lng: coletaLng },
    pickupContact: fullPedido?.coleta_contato,
    pickupPhone: fullPedido?.coleta_phone,
    pickupNotes: fullPedido?.coleta_obs ?? fullPedido?.detalhes,
    exchangeName: fullPedido?.troca_nome,
    exchangeAddress: fullPedido?.troca_endereco,
    exchangeCoordinates: fullPedido?.troca_lat && fullPedido?.troca_lng
      ? { lat: Number(fullPedido.troca_lat), lng: Number(fullPedido.troca_lng) }
      : undefined,
    exchangeContact: fullPedido?.troca_contato,
    exchangePhone: fullPedido?.troca_phone,
    exchangeNotes: fullPedido?.troca_obs ?? fullPedido?.detalhes,
    deliveryName,
    deliveryAddress: fullPedido?.entrega_cidade ? `${deliveryName} - ${fullPedido.entrega_cidade}` : deliveryName,
    deliveryCoordinates: { lat: entregaLat, lng: entregaLng },
    deliveryContact: fullPedido?.entrega_contato,
    deliveryPhone: fullPedido?.entrega_phone,
    deliveryNotes: fullPedido?.entrega_obs ?? fullPedido?.detalhes
  }, fullPedido?.coleta_user_nome);
}
