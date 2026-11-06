export interface LiveDriverData {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  avatarUrl?: string;
  vehicleType: 'moto' | 'carro' | 'utilitario';
  vehicleModel?: string;
  vehiclePlate?: string;
  color: string;
  coordinates: { lat: number; lng: number; heading?: number | null; speed?: number | null; timestamp?: number };
  heading?: number;
  speedKmH?: number;
  batteryLevel?: number;
  status: 'em_rota' | 'disponivel' | 'em_pausa' | 'offline';
  isOnline: boolean;
  lastSeenTimestamp: number;
  lastUpdatedStr: string;
}

export interface OrderAssignmentData {
  orderId: string;
  driverId: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  assignedAt: number;
  enRoute?: boolean;
  acceptedByDriver?: boolean;
}

export interface UrgentOfferState {
  orderKey: string;
  orderId: string;
  place: Record<string, unknown>;
  attemptedDriverIds: Set<string>;
  currentDriverId?: string;
  currentDriverKey?: string;
  expiresAt?: number;
  timeout?: ReturnType<typeof setTimeout>;
}


import type { WebSocket } from 'ws';
import type { Response } from 'express';
import type { serializeByKey } from '../assignmentKeys';

export interface RealtimeServices {
  activeDrivers: Map<string, LiveDriverData>;
  activeAssignments: Map<string, OrderAssignmentData>;
  lastHistoryWrite: Map<string, number>;
  authenticatedSockets: Map<WebSocket, { id: number; role: string; phone: string }>;
  socketsByUserId: Map<number, Set<WebSocket>>;
  urgentOffers: Map<string, UrgentOfferState>;
  serializeAssignment: ReturnType<typeof serializeByKey>;
  validDrivers: () => LiveDriverData[];
  upsertDriver: (data: any) => LiveDriverData;
  sendToUser: (userId: number, data: unknown) => void;
  broadcast: (data: any, except?: WebSocket) => void;
  resendUrgentOffers: (userId: number, socket: WebSocket) => void;
  cancelUrgentOffer: (orderId: string) => void;
  sendNextUrgentOffer: (state: UrgentOfferState, radiusKm: number) => void;
  dispatchUrgentOrders: () => Promise<void>;
  noCache: (res: Response) => void;
  persistAssignment: (key: string, data: OrderAssignmentData) => Promise<unknown>;
  deps?: { notifyOrdersChanged?: () => void };
}
