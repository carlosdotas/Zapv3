/** Entrada compatível dos adaptadores; as implementações ficam separadas por responsabilidade. */
export { getOrderDateBadgeFromDate } from './adapters/orderDates';
export { extractCoordsFromString, resolveKnownAddressCoordinates } from './adapters/orderCoordinates';
export { getVariantSuffix, normalizePhotoPath, formatPhotoUrl, extractPhotoUrls } from './adapters/photoAdapters';
export type { PhotoVariantSize } from './adapters/photoAdapters';
export { backendLocalToPlace } from './adapters/placeAdapters';
export { extractDriverAssignmentFromPedido } from './adapters/orderAssignments';
export type { ExtractedDriverAssignment } from './adapters/orderAssignments';
export { pedidoPaymentFields } from './adapters/orderDetails';
export { backendPedidoToPlace, backendPedidoToPlaces, backendOrderMarkerToPlace } from './adapters/orderAdapters';
export { backendUserToCustomer } from './adapters/customerAdapters';
export { backendMotoristaToDriver } from './adapters/driverAdapters';
