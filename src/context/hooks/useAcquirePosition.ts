import React, { useCallback } from 'react';
import { LocationCoordinates } from '../../types/map';


interface Dependencies {
  setGpsError: React.Dispatch<React.SetStateAction<{
    type: 'permission_denied' | 'insecure_context' | 'iframe_blocked' | 'timeout' | 'unavailable';
    message: string;
    canOpenStandalone?: boolean;
  } | null>>;
  setHasRealGpsFix: React.Dispatch<React.SetStateAction<boolean>>;
  setGpsAccuracy: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useAcquirePosition({ setGpsError, setHasRealGpsFix, setGpsAccuracy }: Dependencies) {
const acquireBestPosition = useCallback((
    onPosition: (coords: LocationCoordinates) => void,
    onError?: (errInfo: { type: 'permission_denied' | 'insecure_context' | 'iframe_blocked' | 'timeout' | 'unavailable'; message: string; canOpenStandalone?: boolean }) => void
  ) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const msg = 'Geolocalização requer conexão segura HTTPS. Acesse este site via HTTPS.';
      const info = { type: 'insecure_context' as const, message: msg };
      setGpsError(info);
      if (onError) onError(info);
      return;
    }

    if (!navigator.geolocation) {
      const msg = 'Geolocalização não é suportada por este navegador.';
      const info = { type: 'unavailable' as const, message: msg };
      setGpsError(info);
      if (onError) onError(info);
      return;
    }

    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    let hasReceivedPosition = false;

    // Se o serviço nativo Android estiver disponível, utiliza as coordenadas nativas em tempo real
    if (typeof window !== 'undefined' && window.AndroidApp?.getLatitude && window.AndroidApp?.getLongitude) {
      try {
        const nativeLat = window.AndroidApp.getLatitude();
        const nativeLng = window.AndroidApp.getLongitude();
        if (typeof nativeLat === 'number' && typeof nativeLng === 'number' && !isNaN(nativeLat) && !isNaN(nativeLng) && nativeLat !== 0 && nativeLng !== 0) {
          hasReceivedPosition = true;
          setGpsError(null);
          setHasRealGpsFix(true);
          onPosition({ lat: nativeLat, lng: nativeLng, timestamp: Date.now() });
        }
      } catch {}
    }

    // 1. TENTATIVA RÁPIDA (Cellular / Wi-Fi / Cache do OS) - Responde em < 400ms sem timeout
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        hasReceivedPosition = true;
        setGpsError(null);
        setHasRealGpsFix(true);
        if (typeof pos.coords.accuracy === 'number') {
          setGpsAccuracy(Math.round(pos.coords.accuracy));
        }
        const fastCoords: LocationCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          timestamp: pos.timestamp || Date.now()
        };
        onPosition(fastCoords);

        // 2. Refina logo após com alta precisão (satélite) com timeout generoso (25s) sem travar o app
        navigator.geolocation.getCurrentPosition(
          (highPos) => {
            setHasRealGpsFix(true);
            if (typeof highPos.coords.accuracy === 'number') {
              setGpsAccuracy(Math.round(highPos.coords.accuracy));
            }
            const highCoords: LocationCoordinates = {
              lat: highPos.coords.latitude,
              lng: highPos.coords.longitude,
              heading: highPos.coords.heading ?? undefined,
              speed: highPos.coords.speed ?? undefined,
              timestamp: highPos.timestamp || Date.now()
            };
            onPosition(highCoords);
          },
          () => {
            // Falha silenciosa no refinamento pois já temos as coordenadas rápidas
          },
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 5000 }
        );
      },
      (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          if (isInIframe) {
            const msg = 'Acesso ao GPS bloqueado pelo iframe. Para funcionar dentro do site, adicione allow="geolocation" na tag <iframe>.';
            const info = { type: 'iframe_blocked' as const, message: msg, canOpenStandalone: true };
            setGpsError(info);
            if (onError) onError(info);
          } else {
            const msg = 'Permissão de GPS negada. Permita a localização nas configurações do seu navegador.';
            const info = { type: 'permission_denied' as const, message: msg };
            setGpsError(info);
            if (onError) onError(info);
          }
          return;
        }

        // Se a primeira tentativa rápida falhou por timeout ou indisponibilidade, tentar com alta precisão
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            hasReceivedPosition = true;
            setGpsError(null);
            setHasRealGpsFix(true);
            if (typeof pos.coords.accuracy === 'number') {
              setGpsAccuracy(Math.round(pos.coords.accuracy));
            }
            const accurateCoords: LocationCoordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading ?? undefined,
              speed: pos.coords.speed ?? undefined,
              timestamp: pos.timestamp || Date.now()
            };
            onPosition(accurateCoords);
          },
          (highErr) => {
            if (!hasReceivedPosition) {
              const msg = highErr.code === 3
                ? 'Sinal de GPS demorou a responder. Verifique se o GPS do aparelho está ativo.'
                : 'Não foi possível obter sinal de satélite GPS no momento.';
              const info = { type: (highErr.code === 3 ? 'timeout' : 'unavailable') as 'timeout' | 'unavailable', message: msg };
              setGpsError(info);
              if (onError) onError(info);
            }
          },
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);
  return { acquireBestPosition };
}
