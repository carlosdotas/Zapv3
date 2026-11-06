import type { LocationCoordinates, UserProfile } from '../types/map';

export const DEFAULT_COORDS: LocationCoordinates = {
  lat: -16.686891,
  lng: -49.264794 // Goiânia - GO (Região Metropolitana)
};

export const DEFAULT_USER: UserProfile = {
  id: 'usr-1',
  name: 'EncomendasZap Operações',
  email: 'encomendaszap@gmail.com',
  avatarUrl: '/logo.svg',
  phone: '(62) 98765-4321',
  role: 'Gestor Logístico & Entregas',
  document: '42.123.456/0001-89',
  company: 'EncomendasZap Logística Express',
  city: 'Goiânia - GO',
  rating: 4.9,
  totalDeliveries: 154,
  savedPlacesCount: 3,
  contributionsCount: 28
};

