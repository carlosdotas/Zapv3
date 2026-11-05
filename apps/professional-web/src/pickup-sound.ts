import { useCallback, useEffect, useRef } from 'react';
import soundUrl from './assets/chamada-zap.mp3';

// The Android foreground service plays its own notification sound.
export function usePickupSound(active: boolean, native: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const enableSound = useCallback(() => {
    if (native) return;
    const player = audio.current ?? new Audio(soundUrl);
    audio.current = player;
    player.muted = true;
    void player.play().then(() => { player.pause(); player.currentTime = 0; player.muted = false; }).catch(() => { player.muted = false; });
  }, [native]);

  useEffect(() => {
    if (!active || native) return;
    const ring = () => {
      const player = audio.current;
      if (!player || document.visibilityState !== 'visible') return;
      player.currentTime = 0;
      void player.play().catch(() => {});
    };
    ring();
    const timer = window.setInterval(ring, 8000);
    return () => { window.clearInterval(timer); if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; } };
  }, [active, native]);

  useEffect(() => () => { audio.current?.pause(); }, []);
  return enableSound;
}
