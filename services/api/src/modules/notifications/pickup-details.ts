export type PickupDetails = { pickupName: string | null; pickupAddress: string | null; latitude: number | null; longitude: number | null };

export function validatePickupDetails(input: unknown): PickupDetails {
  if (input === undefined || input === null) return { pickupName: null, pickupAddress: null, latitude: null, longitude: null };
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_DETAILS');
  const value = input as Record<string, unknown>;
  const text = (item: unknown, max: number) => {
    if (item === undefined || item === null || item === '') return null;
    if (typeof item !== 'string') throw new Error('INVALID_DETAILS');
    const clean = item.trim();
    if (clean.length > max || /[\u0000-\u001f\u007f]/.test(clean)) throw new Error('INVALID_DETAILS');
    return clean || null;
  };
  const pickupName = text(value.pickupName, 160);
  const pickupAddress = text(value.pickupAddress, 300);
  const latitude = value.latitude ?? null;
  const longitude = value.longitude ?? null;
  if ((latitude === null) !== (longitude === null)) throw new Error('INVALID_DETAILS');
  if (latitude !== null && (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180)) throw new Error('INVALID_DETAILS');
  return { pickupName, pickupAddress, latitude: latitude as number | null, longitude: longitude as number | null };
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * radians / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lon2 - lon1) * radians / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) * 100) / 100;
}
