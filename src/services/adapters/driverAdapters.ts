import type { Driver } from '../../types/map';
import type { BackendMotorista, BackendLiveLocation } from '../apiTypes';
import { formatPhotoUrl } from './photoAdapters';

/**
 * Converte um Motorista retornado por POST /motoristas/list com localização em tempo real
 */
export function backendMotoristaToDriver(motorista: BackendMotorista, liveLocation?: BackendLiveLocation): Driver {
  const vType = motorista.tipo_veiculo === 'carro' ? 'carro' : motorista.tipo_veiculo === 'utilitario' ? 'utilitario' : 'moto';
  
  return {
    id: String(motorista.id),
    name: motorista.nome,
    phone: motorista.telefone,
    vehicleType: vType,
    vehicleModel: motorista.modelo_veiculo || (vType === 'moto' ? 'Honda CG 160 Cargo' : vType === 'carro' ? 'Fiat Strada' : 'Renault Master Utilitário'),
    vehiclePlate: motorista.placa || 'BRA-2026',
    avatarUrl: (motorista.foto ? formatPhotoUrl(motorista.foto, 'thumb') : null) || motorista.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    color: '#0B5187',
    rating: 4.9,
    status: motorista.status === 'ativo' ? (liveLocation?.speed && liveLocation.speed > 5 ? 'em_rota' : 'disponivel') : 'em_pausa',
    deliveriesCompleted: 120,
    coordinates: liveLocation ? { lat: liveLocation.lat, lng: liveLocation.lng } : { lat: -16.686891, lng: -49.264794 },
    speedKmH: liveLocation?.speed ?? undefined,
    heading: liveLocation?.heading ?? undefined,
    lastSeenTimestamp: liveLocation?.updated_at ? new Date(liveLocation.updated_at).getTime() : Date.now(),
    signalStrength: liveLocation ? 'excelente' : 'bom'
  };
}
