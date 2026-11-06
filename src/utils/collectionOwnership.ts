import type { Place } from '../types/map';
export { isAfterPickupStage, canAssignCollectedOrder, collectionOwnership } from '../../shared/collectionOwnership';
export type { CollectionOwnership } from '../../shared/collectionOwnership';

export function withCollectionOwner(place: Place, ownerName?: string | null): Place {
  if (!place.collectionRestricted) return place;
  return {
    ...place,
    orderVisibility: 'privado',
    assignedDriverId: place.collectionOwnerId,
    assignedDriverName: ownerName || undefined,
    assignedDriverPhone: undefined
  };
}
