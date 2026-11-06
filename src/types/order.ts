import type { LocationCoordinates, OperationType, VehicleCollectionType } from './map';

export interface PastOrderRecord {
  id: string;
  orderCode: string;
  dateStr: string;
  placeName?: string;
  operationType: OperationType;
  pickupAddress: string;
  pickupCoords: LocationCoordinates;
  exchangeAddress?: string;
  exchangeCoords?: LocationCoordinates;
  deliveryAddress: string;
  deliveryCoords: LocationCoordinates;
  vehicleType: VehicleCollectionType;
  packageType: string;
  volumesCount: string;
  responsibleName: string;
  responsiblePhone: string;
  sellerName?: string;
  sellerPhone?: string;
  observations: string;
  price: number;
  executionCount?: number;
  isFragile?: boolean;
  weightKg?: string;
  dimensions?: string;
  distanceKm?: number;
}
