import { Driver, Place } from '../types/map';
import { getApiUrl, getApiWebSocketUrl, getAuthToken, request } from './httpClient';

export interface UrgentDriverOffer {
  offerId: string;
  expiresAt: number;
  distanceKm?: number;
  place: Place;
}

export const MAX_OFFLINE_MINUTES = 30;
export const MAX_OFFLINE_MS = MAX_OFFLINE_MINUTES * 60 * 1000;

/**
 * Retorna true se o motorista está inativo/offline há mais de 30 minutos
 */
export function isDriverStale(driver: Driver, maxMs: number = MAX_OFFLINE_MS): boolean {
  if (!driver.lastSeenTimestamp) return true;
  return (Date.now() - driver.lastSeenTimestamp) > maxMs;
}

/**
 * Formata o horário da última atualização para exibição nos marcadores e cards
 * Ex: "14:32:10 (há 2 min)" ou "Agora mesmo"
 */
export function formatDriverLastSeen(timestamp?: number, fallbackStr?: string): string {
  if (!timestamp) return fallbackStr || 'Sem registro recente';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  const timeStr = new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  if (elapsedSeconds < 20) {
    return `Agora mesmo (${timeStr})`;
  }
  if (elapsedSeconds < 60) {
    return `Há ${elapsedSeconds}s (${timeStr})`;
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes === 1) {
    return `Há 1 min (${timeStr})`;
  }
  if (elapsedMinutes < 60) {
    return `Há ${elapsedMinutes} min (${timeStr})`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `Há ${elapsedHours}h (${timeStr})`;
}

type DriverUpdateCallback = (driver: Driver) => void;
type DriversInitCallback = (drivers: Driver[]) => void;
type DriverRemoveCallback = (driverId: string) => void;
type UrgentOfferCallback = (offer: UrgentDriverOffer) => void;
type UrgentCancelCallback = (offerId: string) => void;

export class DriverTrackingClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isConnecting: boolean = false;
  private onUpdateCallbacks: Set<DriverUpdateCallback> = new Set();
  private onInitCallbacks: Set<DriversInitCallback> = new Set();
  private onRemoveCallbacks: Set<DriverRemoveCallback> = new Set();
  private onUrgentOfferCallbacks: Set<UrgentOfferCallback> = new Set();
  private onUrgentCancelCallbacks: Set<UrgentCancelCallback> = new Set();
  private activeUrgentOffers = new Map<string, UrgentDriverOffer>();

  private nativeListenersAttached = false;
  private shouldReconnect = false;
  private readonly nativeSync = () => this.syncNativeOffers();
  private readonly visibilitySync = () => {
    if (document.visibilityState === 'visible') this.syncNativeOffers();
  };

  constructor(options: { autoStart?: boolean } = {}) {
    if (options.autoStart !== false) this.start();
  }

  public start(): void {
    if (typeof window === 'undefined') return;
    if (!this.nativeListenersAttached) {
      window.addEventListener('zap:native-urgent-sync', this.nativeSync);
      document.addEventListener('visibilitychange', this.visibilitySync);
      this.nativeListenersAttached = true;
    }
    this.connect();
  }

  public dispose(): void {
    this.disconnect();
    if (!this.nativeListenersAttached) return;
    window.removeEventListener('zap:native-urgent-sync', this.nativeSync);
    document.removeEventListener('visibilitychange', this.visibilitySync);
    this.nativeListenersAttached = false;
  }

  public connect() {
    if (typeof window === 'undefined' || this.isConnecting || !getAuthToken()) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.isConnecting = true;
    try {
      const socket = new WebSocket(getApiWebSocketUrl('/ws/tracking'));
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        const token = getAuthToken();
        if (token) this.ws?.send(JSON.stringify({ type: 'auth', token }));
        console.log('[Tracking WS] Conectado ao servidor de telemetria em tempo real.');
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'drivers:init' && Array.isArray(msg.drivers)) {
            const freshDrivers = msg.drivers.filter((d: Driver) => !isDriverStale(d));
            this.onInitCallbacks.forEach(cb => cb(freshDrivers));
          } else if (msg.type === 'driver:update' && msg.driver) {
            if (!isDriverStale(msg.driver)) {
              this.onUpdateCallbacks.forEach(cb => cb(msg.driver));
            }
          } else if (msg.type === 'driver:offline' && msg.driver) {
            this.onUpdateCallbacks.forEach(cb => cb(msg.driver));
          } else if (msg.type === 'driver:remove' && msg.driverId) {
            this.onRemoveCallbacks.forEach(cb => cb(msg.driverId));
          } else if (msg.type === 'orders:changed') {
            window.dispatchEvent(new Event('zap:refresh-orders'));
          } else if (msg.type === 'urgent:offer' && msg.place) {
            const offer = msg as UrgentDriverOffer;
            if (this.isNativeOfferCancelled(offer)) return;
            this.receiveUrgentOffer(offer);
          } else if (msg.type === 'urgent:cancel' && msg.offerId) {
            const offerId = String(msg.offerId);
            this.activeUrgentOffers.delete(offerId);
            this.onUrgentCancelCallbacks.forEach(cb => cb(offerId));
          }
        } catch (e) {
          // Ignora mensagens mal formatadas
        }
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (typeof window !== 'undefined' && navigator.onLine) {
        this.connect();
      }
    }, 4000);
  }

  public onDriverUpdate(cb: DriverUpdateCallback) {
    this.onUpdateCallbacks.add(cb);
    return () => this.onUpdateCallbacks.delete(cb);
  }

  public onDriversInit(cb: DriversInitCallback) {
    this.onInitCallbacks.add(cb);
    return () => this.onInitCallbacks.delete(cb);
  }

  public onDriverRemove(cb: DriverRemoveCallback) {
    this.onRemoveCallbacks.add(cb);
    return () => this.onRemoveCallbacks.delete(cb);
  }

  public onUrgentOffer(cb: UrgentOfferCallback) {
    this.syncNativeOffers();
    this.onUrgentOfferCallbacks.add(cb);
    this.activeUrgentOffers.forEach((offer, id) => {
      if (offer.expiresAt > Date.now()) cb(offer);
      else this.activeUrgentOffers.delete(id);
    });
    return () => this.onUrgentOfferCallbacks.delete(cb);
  }

  private receiveUrgentOffer(offer: UrgentDriverOffer) {
    if (!offer.offerId || !Number.isFinite(offer.expiresAt) || offer.expiresAt <= Date.now()) return;
    const existing = this.activeUrgentOffers.get(offer.offerId);
    this.activeUrgentOffers.set(offer.offerId, offer);
    if (!existing || existing.expiresAt !== offer.expiresAt) {
      this.onUrgentOfferCallbacks.forEach(cb => cb(offer));
    }
  }

  private isNativeOfferCancelled(offer: UrgentDriverOffer): boolean {
    const readCancellations = window.AndroidApp?.getNativeUrgentCancellations;
    if (!readCancellations) return false;
    try {
      const cancellations: unknown = JSON.parse(readCancellations());
      if (!Array.isArray(cancellations)) throw new Error('Lista de cancelamentos inválida.');
      return cancellations.some(cancelled =>
        cancelled && cancelled.offerId === offer.offerId &&
        typeof cancelled.expiresAt === 'number' && cancelled.expiresAt >= offer.expiresAt
      );
    } catch (error) {
      console.error('[Tracking] Falha ao verificar cancelamentos nativos:', error);
      return false;
    }
  }

  private syncNativeOffers() {
    const native = window.AndroidApp?.getNativeUrgentOffers;
    if (!native) return;
    try {
      const readCancellations = window.AndroidApp?.getNativeUrgentCancellations;
      if (readCancellations) {
        const cancellations: unknown = JSON.parse(readCancellations());
        if (!Array.isArray(cancellations)) throw new Error('Lista de cancelamentos inválida.');
        for (const cancelled of cancellations) {
          if (!cancelled || typeof cancelled.offerId !== 'string' || typeof cancelled.expiresAt !== 'number') continue;
          const current = this.activeUrgentOffers.get(cancelled.offerId);
          if (current && current.expiresAt <= cancelled.expiresAt) {
            this.activeUrgentOffers.delete(cancelled.offerId);
            this.onUrgentCancelCallbacks.forEach(cb => cb(cancelled.offerId));
          }
        }
      }
      const offers: unknown = JSON.parse(native());
      if (!Array.isArray(offers)) throw new Error('Lista de convites inválida.');
      for (const offer of offers) {
        if (!offer || typeof offer.offerId !== 'string' || typeof offer.expiresAt !== 'number' ||
            offer.expiresAt <= Date.now() || !offer.place || typeof offer.place.name !== 'string' ||
            !Number.isFinite(offer.place.coordinates?.lat) || !Number.isFinite(offer.place.coordinates?.lng)) continue;
        this.receiveUrgentOffer(offer);
      }
    } catch (error) {
      console.error('[Tracking] Falha ao sincronizar convites nativos:', error);
    }
  }

  public onUrgentCancel(cb: UrgentCancelCallback) {
    this.onUrgentCancelCallbacks.add(cb);
    return () => this.onUrgentCancelCallbacks.delete(cb);
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.activeUrgentOffers.clear();
    this.ws?.close();
    this.ws = null;
    this.isConnecting = false;
  }

  public async respondToUrgentOffer(offerId: string, accepted: boolean): Promise<boolean> {
    const result = await request('/api/realtime/urgent-offer/respond', 'POST', { offerId, accepted });
    return result.success;
  }

  /**
   * Envia atualização de localização do motorista ativo
   */
  public async sendLocation(driver: Driver): Promise<void> {
    const payload = {
      type: 'driver:update_location',
      driver: {
        ...driver,
        lastSeenTimestamp: Date.now()
      }
    };

    // 1. Tenta enviar via WebSocket imediatamente
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return;
    }

    // 2. Fallback HTTP caso o socket esteja reconectando
    try {
      await fetch(getApiUrl('/api/tracking/update-driver'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(driver)
      });
    } catch (e) {
      // Ignora erro transitório
    }
  }

  /**
   * Busca lista de motoristas ativos via REST (filtra > 30 minutos inativos)
   */
  public async fetchLiveDrivers(): Promise<Driver[]> {
    try {
      const res = await fetch(getApiUrl(`/api/tracking/live-drivers?_t=${Date.now()}`), {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.filter((d: Driver) => !isDriverStale(d));
        }
      }
    } catch (err) {
      // ignore
    }
    return [];
  }
}

export const driverTrackingClient = new DriverTrackingClient({ autoStart: false });
