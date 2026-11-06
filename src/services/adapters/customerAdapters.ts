import type { Customer } from '../../types/customer';
import type { BackendUser } from '../apiTypes';
import { resolveCustomerCity } from '../../utils/addressUtils';

/**
 * Converte um User retornado por POST /users/list ou POST /pedidos/list_users em Customer
 */
export function backendUserToCustomer(user: BackendUser): Customer {
  const rawCoordinates = user.coordinates as { lat?: unknown; lng?: unknown } | undefined;
  const lat = Number(rawCoordinates?.lat);
  const lng = Number(rawCoordinates?.lng);
  const coordinates = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    ? { lat, lng }
    : undefined;
  const additionalAddresses = Array.isArray(user.additionalAddresses)
    ? user.additionalAddresses
    : Array.isArray(user.additional_addresses)
      ? user.additional_addresses
      : [];
  const city = resolveCustomerCity({
    city: user.city,
    cidade: user.cidade,
    address: user.address || user.endereco
  });
  return {
    id: String(user.id),
    fullName: user.full_name || user.name_completo || user.name,
    contactName: user.name,
    phone: user.phone,
    cpf: user.cpf || (user as any).cnpj || '',
    cnpj: (user as any).cnpj,
    personType: (user as any).person_type,
    city,
    cidade: city,
    address: user.address || user.endereco || '',
    coordinates,
    additionalAddresses,
    email: user.email,
    notes: user.notes || (user.cliente_especial ? 'Cliente Especial' : undefined),
    companyId: user.companyId,
    orderCount: Number(user.orderCount ?? user.order_count ?? user.pedidos_count ?? 0),
    createdAt: user.created_at ? new Date(user.created_at).getTime() : Date.now()
  };
}
