import React from 'react';
import { resolveCommercialClosingTime, resolveCommercialOpeningTime } from '../../utils/placeUtils';
import { usePresenceMap, useWaitSeconds, formatDuration } from '../../services/presenceService';
import { Place } from '../../types/map';

export const LIMITE_BAIXA_DISTANTE_M = 1000;

export const formatPhoneDisplay = (raw?: string): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else if (digits.length > 11 && digits.startsWith('55')) {
    const sub = digits.slice(2);
    if (sub.length === 11) return `(${sub.slice(0, 2)}) ${sub.slice(2, 7)}-${sub.slice(7)}`;
    if (sub.length === 10) return `(${sub.slice(0, 2)}) ${sub.slice(2, 6)}-${sub.slice(6)}`;
  }
  return raw;
};

export const getClosingTime = (place: Place, now: Date = new Date()): string => {
  return resolveCommercialClosingTime(place, now);
};

export const getOpeningTime = (place: Place): string => {
  return resolveCommercialOpeningTime(place);
};

export interface TimeUntilClosing {
  text: string;
  isUrgent: boolean;
  isClosingSoon: boolean;
  diffMinutes: number;
}

export const getTimeUntilClosing = (
  closingTimeStr: string,
  now: Date = new Date()
): TimeUntilClosing | null => {
  if (!closingTimeStr) return null;
  const match = closingTimeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const closeH = parseInt(match[1], 10);
  const closeM = parseInt(match[2], 10);
  if (isNaN(closeH) || isNaN(closeM) || closeH < 0 || closeH > 24 || closeM < 0 || closeM > 59) {
    return null;
  }

  const currentH = now.getHours();
  const currentM = now.getMinutes();

  let diffMinutes = (closeH * 60 + closeM) - (currentH * 60 + currentM);

  // Se o fechamento for na madrugada do dia seguinte (ex: fecha às 01:00 ou 02:00 e agora é tarde da noite)
  if (diffMinutes < 0 && closeH <= 5 && currentH >= 12) {
    diffMinutes += 24 * 60;
  }

  if (diffMinutes < 0) {
    if (diffMinutes >= -15) {
      return {
        text: 'fechando agora',
        isUrgent: true,
        isClosingSoon: true,
        diffMinutes
      };
    }
    return {
      text: 'fechado',
      isUrgent: true,
      isClosingSoon: true,
      diffMinutes
    };
  }

  if (diffMinutes === 0) {
    return {
      text: 'fechando agora',
      isUrgent: true,
      isClosingSoon: true,
      diffMinutes: 0
    };
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  let text = '';
  if (hours > 0 && minutes > 0) {
    text = `em ${hours}h ${minutes}min`;
  } else if (hours > 0) {
    text = `em ${hours}h`;
  } else {
    text = `em ${minutes} min`;
  }

  return {
    text,
    isUrgent: diffMinutes <= 30,
    isClosingSoon: diffMinutes <= 60,
    diffMinutes
  };
};

export const formatDistance = (km: number): string => {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  return `${km.toFixed(1).replace('.', ',')} km`;
};

export const ArrivalInfo: React.FC<{ placeId: string }> = ({ placeId }) => {
  const entry = usePresenceMap()[placeId];
  const waitS = useWaitSeconds(entry);
  if (!entry || !entry.chegadaEm) return null;
  const arrivedAt = new Date(entry.chegadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const counting = entry.since !== null;
  return (
    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] font-black">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
        Chegou às {arrivedAt}
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${counting ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
        Espera: {formatDuration(waitS)}{counting ? '' : ' (pausado)'}
      </span>
    </div>
  );
};
