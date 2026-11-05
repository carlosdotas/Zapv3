import { useCallback, useEffect, useRef } from 'react';

// Browsers and WebViews require a user gesture to enable audio.
export function usePickupSound(active: boolean) {
  const audio = useRef<AudioContext | null>(null);
  const enableSound = useCallback(() => {
    if (typeof AudioContext === 'undefined') return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch { /* Sound is optional when the browser or device does not allow it. */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    const ring = () => {
      const context = audio.current;
      if (!context || context.state !== 'running' || document.visibilityState !== 'visible') return;
      for (const [offset, frequency] of [[0, 660], [0.24, 880]]) {
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        const start = context.currentTime + offset;
        oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(0.001, start);
        volume.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        oscillator.connect(volume); volume.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.21);
      }
    };
    ring();
    const timer = window.setInterval(ring, 3500);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => () => { if (audio.current) void audio.current.close(); }, []);
  return enableSound;
}
