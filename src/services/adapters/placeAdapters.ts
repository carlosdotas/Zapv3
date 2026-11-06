import type { Place } from '../../types/map';
import type { BackendLocal } from '../apiTypes';
import { isStreetOrAddress, resolveCommercialClosingTime } from '../../utils/placeUtils';

/**
 * Converte um Local retornado pelo endpoint GET /locais em um Place do mapa
 */
export function backendLocalToPlace(local: BackendLocal): Place {
  const lat = typeof local.lat === 'string' ? parseFloat(local.lat) : local.lat;
  const lng = typeof local.lng === 'string' ? parseFloat(local.lng) : local.lng;

  const validLat = isNaN(lat) ? -16.686891 : lat;
  const validLng = isNaN(lng) ? -49.264794 : lng;

  const fullAddress = local.endereco || 
    (local.rua ? `${local.rua}${local.numero ? `, ${local.numero}` : ''}${local.setor ? ` - ${local.setor}` : ''}${local.cidade ? `, ${local.cidade}` : ''}` : local.name);

  // Somente usa imageUrl se for uma imagem real válida (ex: .png ou .jpg), NUNCA link web do Google Maps
  const validImage = (local.icon && typeof local.icon === 'string' && local.icon.startsWith('http') && !local.icon.includes('maps.app.goo.gl')) 
    ? local.icon 
    : undefined;

  const isStreet = isStreetOrAddress({
    name: local.name,
    category: local.setor,
    address: fullAddress
  });

  // Extrai ou calcula horário de fechamento para estabelecimento comercial
  const extractedClosing = isStreet ? undefined : resolveCommercialClosingTime({
    name: local.name,
    category: local.setor,
    address: fullAddress,
    horario: local.horario
  });

  return {
    id: `local-${local.id}`,
    name: local.name,
    category: isStreet ? 'Via pública / Endereço' : (local.central_coletas ? 'Central de Coletas' : 'Ponto Comercial'),
    address: fullAddress,
    coordinates: { lat: validLat, lng: validLng },
    phone: local.telefone,
    website: local.site,
    openNow: isStreet ? undefined : true,
    closingTime: isStreet ? undefined : extractedClosing,
    description: `Ponto cadastrado na rede EncomendasZap${local.cidade ? ` • ${local.cidade}` : ''}${local.setor ? ` (${local.setor})` : ''}`,
    imageUrl: validImage,
    originCity: local.cidade || 'Goiânia - GO',
    destinationCity: local.cidade || 'Goiânia - GO',
    operationType: 'coleta',
    orderStage: 'coleta',
    pickupName: local.name,
    pickupAddress: fullAddress,
    pickupCoordinates: { lat: validLat, lng: validLng }
  };
}
