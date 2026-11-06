import L from 'leaflet';
import { Zap } from 'lucide-react';

const getMotoMascotSvg = (color: string) => `
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Guidão e Retrovisores -->
  <path d="M 6 15 C 6 12 12 13 17 13 C 22 13 28 12 28 15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
  <circle cx="5.5" cy="13.5" r="1.8" fill="${color}" stroke="#FFFFFF" stroke-width="1" />
  <circle cx="28.5" cy="13.5" r="1.8" fill="${color}" stroke="#FFFFFF" stroke-width="1" />

  <!-- Cabeça / Capacete do Mascote Entregador -->
  <ellipse cx="17" cy="8.5" rx="6.5" ry="6" fill="${color}" stroke="#FFFFFF" stroke-width="1.6" />
  <!-- Viseira do Capacete com brilho espelhado -->
  <path d="M 12 7.5 C 13.5 5.5 20.5 5.5 22 7.5 C 22 10.5 12 10.5 12 7.5 Z" fill="#0f172a" stroke="#FFFFFF" stroke-width="1" />
  <path d="M 13.5 7.5 C 14.5 6.5 18 6.5 19 7" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" />
  
  <!-- Carenagem / Frente da Moto -->
  <path d="M 11 15 L 23 15 L 21 24 L 17 27 L 13 24 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
  
  <!-- Farol da Moto Iluminado em Amarelo/Branco -->
  <circle cx="17" cy="19" r="3.2" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1.2" />
  <circle cx="17" cy="19" r="1.6" fill="#FFFFFF" />
  
  <!-- Pneu Dianteiro e Paralama -->
  <rect x="15" y="24" width="4" height="6.5" rx="2" fill="#1e293b" stroke="#FFFFFF" stroke-width="1" />
  <path d="M 13 24 C 13 22 21 22 21 24" stroke="#FFFFFF" stroke-width="1.2" />
</svg>
`;

// Mascote / Bichinho em Carro de Entrega Estilizado
const getCarMascotSvg = (color: string) => `
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Luz de Entrega / Antena no Teto -->
  <rect x="14.5" y="3" width="5" height="2.5" rx="1.2" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1" />
  
  <!-- Teto da Cabine -->
  <path d="M 9 11 L 11 5.5 L 23 5.5 L 25 11 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round" />
  
  <!-- Para-brisa com Motorista Mascote Visível Dentro -->
  <path d="M 10 11.5 L 12 6.8 L 22 6.8 L 24 11.5 Z" fill="#0f172a" stroke="#FFFFFF" stroke-width="1" />
  <!-- Capacete/Mascote no volante acenando -->
  <circle cx="15.5" cy="9.5" r="2.2" fill="${color}" stroke="#FFFFFF" stroke-width="0.8" />
  <path d="M 14.5 9 C 15 8.5 16.5 8.5 17 9" stroke="#38bdf8" stroke-width="0.8" />
  <!-- Volante visível -->
  <ellipse cx="19.5" cy="10.8" rx="1.8" ry="1" fill="#334155" stroke="#FFFFFF" stroke-width="0.6" />
  
  <!-- Capô e Carroceria do Carro -->
  <path d="M 5 12 C 5 11.5 29 11.5 29 12 L 28 23 C 28 24.5 6 24.5 6 23 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
  
  <!-- Faróis Dianteiros Brilhantes -->
  <circle cx="9" cy="15.5" r="2.5" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1.2" />
  <circle cx="9" cy="15.5" r="1.1" fill="#FFFFFF" />
  <circle cx="25" cy="15.5" r="2.5" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1.2" />
  <circle cx="25" cy="15.5" r="1.1" fill="#FFFFFF" />
  
  <!-- Grade Frontal com Raio Zap ⚡ -->
  <rect x="13" y="14" width="8" height="4" rx="1.2" fill="#0f172a" stroke="#FFFFFF" stroke-width="0.9" />
  <path d="M 17 14.5 L 15.8 16.2 H 17.5 L 17 17.8" stroke="#FDE047" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- Para-choque e Pneus -->
  <rect x="7" y="22" width="20" height="3" rx="1.5" fill="#1e293b" stroke="#FFFFFF" stroke-width="1" />
  <rect x="4" y="19" width="3" height="6.5" rx="1.5" fill="#0f172a" />
  <rect x="27" y="19" width="3" height="6.5" rx="1.5" fill="#0f172a" />
</svg>
`;

// Mascote / Bichinho em Utilitário / Furgão de Carga Estilizado
const getUtilitarioMascotSvg = (color: string) => `
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Luz de Carga / Sirene no Teto -->
  <rect x="13" y="2" width="8" height="2.5" rx="1.2" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1" />
  
  <!-- Baú de Carga Alto -->
  <rect x="5" y="4.5" width="24" height="18.5" rx="2" fill="${color}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round" />
  
  <!-- Faixa Lateral com Raio Zap ⚡ -->
  <path d="M 5 13 H 29" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.8" />
  
  <!-- Cabine Dianteira e Para-brisa com Motorista Mascote -->
  <rect x="9" y="6.5" width="16" height="5.5" rx="1.5" fill="#0f172a" stroke="#FFFFFF" stroke-width="1" />
  <circle cx="14" cy="9.2" r="2.2" fill="${color}" stroke="#FFFFFF" stroke-width="0.8" />
  <path d="M 13 8.5 C 14 8 15.5 8 16 8.5" stroke="#38bdf8" stroke-width="0.8" />
  <ellipse cx="19" cy="10.2" rx="1.8" ry="1" fill="#334155" stroke="#FFFFFF" stroke-width="0.6" />

  <!-- Faróis Dianteiros de Carga -->
  <circle cx="8.5" cy="17" r="2.4" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1.2" />
  <circle cx="8.5" cy="17" r="1.1" fill="#FFFFFF" />
  <circle cx="25.5" cy="17" r="2.4" fill="#FEF08A" stroke="#FFFFFF" stroke-width="1.2" />
  <circle cx="25.5" cy="17" r="1.1" fill="#FFFFFF" />

  <!-- Grade Frontal e Raio ⚡ -->
  <rect x="13" y="15.5" width="8" height="4" rx="1" fill="#0f172a" stroke="#FFFFFF" stroke-width="0.9" />
  <path d="M 17 16 L 15.8 17.5 H 17.5 L 17 19" stroke="#FDE047" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Pneus Robustos e Para-choque -->
  <rect x="6" y="22" width="22" height="3.5" rx="1.5" fill="#1e293b" stroke="#FFFFFF" stroke-width="1" />
  <rect x="3.5" y="19" width="3.5" height="7" rx="1.5" fill="#0f172a" />
  <rect x="27" y="19" width="3.5" height="7" rx="1.5" fill="#0f172a" />
</svg>
`;

// Helper para converter cor hexadecimal ou rgb em rgba com transparência suave
export const hexToRgba = (hexOrRgb: string, alpha = 0.85): string => {
  if (!hexOrRgb) return `rgba(11, 81, 135, ${alpha})`;
  if (hexOrRgb.startsWith('rgba')) {
    return hexOrRgb.replace(/[\d\.]+\)$/g, `${alpha})`);
  }
  if (hexOrRgb.startsWith('rgb')) {
    return hexOrRgb.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  let c = hexOrRgb.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const r = parseInt(c.substring(0, 2), 16) || 11;
  const g = parseInt(c.substring(2, 4), 16) || 81;
  const b = parseInt(c.substring(4, 6), 16) || 135;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper para extrair o tipo de veículo do perfil do usuário
export const getUserVehicleType = (userObj?: any): 'moto' | 'carro' | 'utilitario' => {
  if (!userObj) return 'moto';
  if (userObj.vehicleType) {
    const vt = String(userObj.vehicleType).toLowerCase();
    if (vt.includes('carro')) return 'carro';
    if (vt.includes('util') || vt.includes('van') || vt.includes('fiorino') || vt.includes('caminh')) return 'utilitario';
    return 'moto';
  }
  const combined = `${userObj.role || ''} ${userObj.name || ''} ${userObj.vehicle || ''}`.toLowerCase();
  if (combined.includes('utilit') || combined.includes('van') || combined.includes('fiorino') || combined.includes('caminh')) {
    return 'utilitario';
  }
  if (combined.includes('carro')) {
    return 'carro';
  }
  return 'moto';
};

// Gerador de SVG 3D para veículos no mapa (Moto, Carro, Utilitário) com rotação suave de rumo (Heading)
export const get3DVehicleSvg = (
  vehicleType: 'moto' | 'carro' | 'utilitario' = 'moto',
  heading: number = 0,
  accentColor: string = '#FF5E00',
  uid: string = 'v'
): string => {
  const currentAngle = typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : 0;
  const safeColor = accentColor || '#FF5E00';

  if (vehicleType === 'moto') {
    return `
      <div class="vehicle-3d-rotating-disc" style="transform: translate(-50%, -50%) rotate(${currentAngle}deg);">
        <svg width="54" height="54" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="moto-shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1" dy="4" stdDeviation="3" flood-color="rgba(0, 0, 0, 0.42)" />
            </filter>
            <linearGradient id="moto-headlight-${uid}" x1="32" y1="18" x2="32" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="rgba(255, 245, 180, 0.55)" />
              <stop offset="100%" stop-color="rgba(255, 245, 180, 0)" />
            </linearGradient>
            <radialGradient id="moto-helmet-${uid}" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#475569" />
              <stop offset="70%" stop-color="#1E293B" />
              <stop offset="100%" stop-color="#0F172A" />
            </radialGradient>
            <linearGradient id="moto-box-${uid}" x1="21" y1="37" x2="43" y2="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="${safeColor}" />
              <stop offset="100%" stop-color="#C2410C" />
            </linearGradient>
          </defs>

          <!-- Feixe do Farol iluminando para frente -->
          <polygon points="32,16 16,0 48,0" fill="url(#moto-headlight-${uid})" />

          <!-- Corpo 3D da Moto com Sombra -->
          <g filter="url(#moto-shadow-${uid})">
            <!-- Sombra do Chassi no Solo -->
            <ellipse cx="32" cy="35" rx="7.5" ry="17" fill="rgba(0,0,0,0.28)" />

            <!-- Roda e Para-lama Dianteiro -->
            <rect x="29.5" y="10" width="5" height="12" rx="2.5" fill="#0F172A" stroke="#CBD5E1" stroke-width="0.8" />
            <rect x="30.5" y="12" width="3" height="7" rx="1.5" fill="#64748B" />

            <!-- Pneu traseiro aparecendo sob o baú -->
            <rect x="29.5" y="52" width="5" height="11" rx="2.5" fill="#0F172A" stroke="#CBD5E1" stroke-width="0.8" />

            <!-- Guidão, punhos e braços do piloto -->
            <path d="M 20 22 L 44 22" stroke="#1E293B" stroke-width="3" stroke-linecap="round" />
            <circle cx="19" cy="20" r="2.4" fill="#CBD5E1" stroke="#1E293B" stroke-width="1" />
            <circle cx="45" cy="20" r="2.4" fill="#CBD5E1" stroke="#1E293B" stroke-width="1" />
            <path d="M 25 29 L 20.5 22 M 39 29 L 43.5 22" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" />
            <path d="M 25 29 L 20.5 22 M 39 29 L 43.5 22" stroke="#1E293B" stroke-width="1.8" stroke-linecap="round" />
            <!-- Farol Central -->
            <circle cx="32" cy="18" r="3" fill="#FEF08A" stroke="#F59E0B" stroke-width="1.2" />

            <!-- Chassi / Tanque -->
            <path d="M 27 23 L 37 23 L 36 34 L 28 34 Z" fill="#334155" stroke="#FFFFFF" stroke-width="1" />

            <!-- Piloto (Ombros, mochila e Capacete com viseira) -->
            <ellipse cx="32" cy="30" rx="9" ry="4.5" fill="#1E293B" stroke="#FFFFFF" stroke-width="1.2" />
            <circle cx="32" cy="28" r="6.2" fill="${safeColor}" stroke="#FFFFFF" stroke-width="1.6" />
            <path d="M 32 21.8 L 32 34" stroke="#FFFFFF" stroke-width="1.6" opacity="0.9" />
            <path d="M 28.6 25.2 Q 32 23.6 35.4 25.2" stroke="#0F172A" stroke-width="2.2" stroke-linecap="round" />

            <!-- Baú de Carga Traseiro (3D) -->
            <rect x="21" y="37" width="22" height="16" rx="3.5" fill="url(#moto-box-${uid})" stroke="#FFFFFF" stroke-width="1.8" />
            <line x1="21" y1="41.5" x2="43" y2="41.5" stroke="rgba(255,255,255,0.7)" stroke-width="1" />
            <text x="32" y="50" font-size="8.5" font-weight="900" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif">EZ</text>
            <rect x="29" y="52.4" width="6" height="2" rx="1" fill="#EF4444" />
          </g>
        </svg>
      </div>
    `;
  }

  if (vehicleType === 'carro') {
    return `
      <div class="vehicle-3d-rotating-disc" style="transform: translate(-50%, -50%) rotate(${currentAngle}deg);">
        <svg width="54" height="54" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="car-shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1" dy="4" stdDeviation="3.5" flood-color="rgba(0, 0, 0, 0.45)" />
            </filter>
            <linearGradient id="car-headlight-l-${uid}" x1="24" y1="14" x2="16" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="rgba(255, 245, 180, 0.5)" />
              <stop offset="100%" stop-color="rgba(255, 245, 180, 0)" />
            </linearGradient>
            <linearGradient id="car-headlight-r-${uid}" x1="40" y1="14" x2="48" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="rgba(255, 245, 180, 0.5)" />
              <stop offset="100%" stop-color="rgba(255, 245, 180, 0)" />
            </linearGradient>
            <linearGradient id="car-body-${uid}" x1="18" y1="12" x2="46" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#38BDF8" />
              <stop offset="50%" stop-color="${safeColor}" />
              <stop offset="100%" stop-color="#0F172A" />
            </linearGradient>
            <linearGradient id="car-glass-${uid}" x1="22" y1="20" x2="42" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#E0F2FE" />
              <stop offset="60%" stop-color="#7DD3FC" />
              <stop offset="100%" stop-color="#0284C7" />
            </linearGradient>
          </defs>

          <!-- Feixes dos Faróis Dianteiros -->
          <polygon points="23,12 10,0 26,0" fill="url(#car-headlight-l-${uid})" />
          <polygon points="41,12 38,0 54,0" fill="url(#car-headlight-r-${uid})" />

          <!-- Carro 3D com Sombra no Solo -->
          <g filter="url(#car-shadow-${uid})">
            <!-- Rodas e Pneus -->
            <rect x="15" y="16" width="4" height="9" rx="2" fill="#0F172A" />
            <rect x="45" y="16" width="4" height="9" rx="2" fill="#0F172A" />
            <rect x="15" y="42" width="4" height="9" rx="2" fill="#0F172A" />
            <rect x="45" y="42" width="4" height="9" rx="2" fill="#0F172A" />

            <!-- Retrovisores Laterais -->
            <rect x="14" y="24" width="4.5" height="3" rx="1.5" fill="${safeColor}" stroke="#FFFFFF" stroke-width="0.8" />
            <rect x="45.5" y="24" width="4.5" height="3" rx="1.5" fill="${safeColor}" stroke="#FFFFFF" stroke-width="0.8" />

            <!-- Chassi / Carroceria do Carro -->
            <path d="M 22 10 C 26 9, 38 9, 42 10 C 45 11, 46 15, 46 22 L 46 48 C 46 54, 43 57, 39 57 L 25 57 C 21 57, 18 54, 18 48 L 18 22 C 18 15, 19 11, 22 10 Z" fill="url(#car-body-${uid})" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" />

            <!-- Nervuras do Capô -->
            <path d="M 26 12 L 26 18 M 38 12 L 38 18" stroke="#BAE6FD" stroke-width="1" stroke-linecap="round" />

            <!-- Para-brisa Dianteiro Curvo com Reflexo -->
            <path d="M 22 21 C 26 19, 38 19, 42 21 L 43 28 L 21 28 Z" fill="url(#car-glass-${uid})" stroke="#0C4A6E" stroke-width="0.8" />
            <line x1="24" y1="23" x2="33" y2="27" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.75" />

            <!-- Teto e Frisos -->
            <rect x="23" y="28.5" width="18" height="15" rx="2" fill="${safeColor}" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
            <rect x="26" y="31" width="12" height="10" rx="1.5" fill="rgba(0,0,0,0.15)" stroke="#BAE6FD" stroke-width="0.6" opacity="0.7" />

            <!-- Vidro Traseiro -->
            <path d="M 22 45 L 42 45 L 41 50 C 37 51, 27 51, 23 50 Z" fill="url(#car-glass-${uid})" stroke="#0C4A6E" stroke-width="0.8" />

            <!-- Lâmpadas dos Faróis -->
            <ellipse cx="22" cy="11.5" rx="2.5" ry="1.5" fill="#FEF08A" stroke="#F59E0B" stroke-width="0.8" />
            <ellipse cx="42" cy="11.5" rx="2.5" ry="1.5" fill="#FEF08A" stroke="#F59E0B" stroke-width="0.8" />

            <!-- Lanternas Traseiras Vermelhas -->
            <rect x="20" y="55.5" width="4" height="2" rx="1" fill="#EF4444" />
            <rect x="40" y="55.5" width="4" height="2" rx="1" fill="#EF4444" />
          </g>
        </svg>
      </div>
    `;
  }

  // Utilitário / Furgão / Fiorino / Carga
  return `
    <div class="vehicle-3d-rotating-disc" style="transform: translate(-50%, -50%) rotate(${currentAngle}deg);">
      <svg width="54" height="54" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="van-shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1" dy="4.5" stdDeviation="4" flood-color="rgba(0, 0, 0, 0.48)" />
          </filter>
          <linearGradient id="van-headlight-l-${uid}" x1="24" y1="12" x2="14" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="rgba(255, 245, 180, 0.55)" />
            <stop offset="100%" stop-color="rgba(255, 245, 180, 0)" />
          </linearGradient>
          <linearGradient id="van-headlight-r-${uid}" x1="40" y1="12" x2="50" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="rgba(255, 245, 180, 0.55)" />
            <stop offset="100%" stop-color="rgba(255, 245, 180, 0)" />
          </linearGradient>
          <linearGradient id="van-cabin-${uid}" x1="20" y1="8" x2="44" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="100%" stop-color="#E2E8F0" />
          </linearGradient>
          <linearGradient id="van-box-${uid}" x1="16" y1="24" x2="48" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#F8FAFC" />
            <stop offset="50%" stop-color="#E2E8F0" />
            <stop offset="100%" stop-color="#CBD5E1" />
          </linearGradient>
          <linearGradient id="van-glass-${uid}" x1="22" y1="15" x2="42" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#E0F2FE" />
            <stop offset="100%" stop-color="#38BDF8" />
          </linearGradient>
        </defs>

        <!-- Faróis iluminando para frente -->
        <polygon points="23,10 8,0 26,0" fill="url(#van-headlight-l-${uid})" />
        <polygon points="41,10 38,0 56,0" fill="url(#van-headlight-r-${uid})" />

        <!-- Furgão Utilitário 3D com Sombra no Solo -->
        <g filter="url(#van-shadow-${uid})">
          <!-- Pneus -->
          <rect x="14" y="16" width="4.5" height="10" rx="2" fill="#0F172A" />
          <rect x="45.5" y="16" width="4.5" height="10" rx="2" fill="#0F172A" />
          <rect x="14" y="44" width="4.5" height="10" rx="2" fill="#0F172A" />
          <rect x="45.5" y="44" width="4.5" height="10" rx="2" fill="#0F172A" />

          <!-- Retrovisores Grandes de Utilitário -->
          <rect x="13" y="19" width="5" height="3" rx="1.5" fill="#1E293B" stroke="#FFFFFF" stroke-width="0.8" />
          <rect x="46" y="19" width="5" height="3" rx="1.5" fill="#1E293B" stroke="#FFFFFF" stroke-width="0.8" />

          <!-- Cabine Dianteira -->
          <path d="M 22 8 C 26 7, 38 7, 42 8 C 45 9, 46 12, 46 17 L 46 23 L 18 23 L 18 17 C 18 12, 19 9, 22 8 Z" fill="url(#van-cabin-${uid})" stroke="#94A3B8" stroke-width="1.2" />

          <!-- Para-brisa da Cabine -->
          <path d="M 21 16 C 26 14, 38 14, 43 16 L 43 22 L 21 22 Z" fill="url(#van-glass-${uid})" stroke="#0284C7" stroke-width="0.8" />
          <line x1="24" y1="18" x2="34" y2="21" stroke="#FFFFFF" stroke-width="1.2" opacity="0.8" />

          <!-- Baú Traseiro de Carga Volumosa -->
          <rect x="17" y="23" width="30" height="35" rx="3" fill="url(#van-box-${uid})" stroke="#94A3B8" stroke-width="1.4" />

          <!-- Nervuras Estruturais no Teto do Baú -->
          <line x1="22" y1="25" x2="22" y2="55" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
          <line x1="27" y1="25" x2="27" y2="55" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
          <line x1="32" y1="25" x2="32" y2="55" stroke="#94A3B8" stroke-width="1.4" stroke-linecap="round" opacity="0.7" />
          <line x1="37" y1="25" x2="37" y2="55" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
          <line x1="42" y1="25" x2="42" y2="55" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />

          <!-- Divisão das Portas Traseiras Duplas -->
          <line x1="32" y1="53" x2="32" y2="58" stroke="#475569" stroke-width="1.6" />
          <circle cx="30" cy="55.5" r="1" fill="#475569" />
          <circle cx="34" cy="55.5" r="1" fill="#475569" />

          <!-- Faróis Dianteiros -->
          <circle cx="21" cy="9.5" r="2.2" fill="#FEF08A" stroke="#F59E0B" stroke-width="0.8" />
          <circle cx="43" cy="9.5" r="2.2" fill="#FEF08A" stroke="#F59E0B" stroke-width="0.8" />

          <!-- Lanternas Traseiras -->
          <rect x="18" y="56.5" width="4.5" height="2" rx="1" fill="#EF4444" />
          <rect x="41.5" y="56.5" width="4.5" height="2" rx="1" fill="#EF4444" />
        </g>
      </svg>
    </div>
  `;
};

// Gerador da Seta 3D de Navegação Estilo Google Maps (para Admin, Atendente e Terminal)
export const get3DGmapsArrowSvg = (
  heading: number = 0,
  isTracking: boolean = false,
  uid: string = 'arrow'
): string => {
  const currentAngle = typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : 0;

  return `
    <div class="vehicle-3d-rotating-disc" style="transform: translate(-50%, -50%) rotate(${currentAngle}deg);">
      <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="gmaps-shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="rgba(0, 30, 80, 0.45)" />
          </filter>
          <linearGradient id="gmaps-left-${uid}" x1="16" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4285F4" />
            <stop offset="100%" stop-color="#1A73E8" />
          </linearGradient>
          <linearGradient id="gmaps-right-${uid}" x1="48" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#1A73E8" />
            <stop offset="100%" stop-color="#1557B0" />
          </linearGradient>
          <radialGradient id="gmaps-glow-${uid}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(66, 133, 244, 0.35)" />
            <stop offset="100%" stop-color="rgba(66, 133, 244, 0)" />
          </radialGradient>
        </defs>

        <!-- Seta de Navegação 3D com Borda Branca e Facetas em Gradiente -->
        <g filter="url(#gmaps-shadow-${uid})">
          <!-- Asa Esquerda (Face Iluminada) -->
          <path d="M 32 8 L 13 48 L 32 38 Z" fill="url(#gmaps-left-${uid})" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" />
          <!-- Asa Direita (Face em Sombra) -->
          <path d="M 32 8 L 51 48 L 32 38 Z" fill="url(#gmaps-right-${uid})" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" />
          <!-- Friso Central de Relevo -->
          <line x1="32" y1="9" x2="32" y2="38" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.8" />
          <!-- Brilho no Topo da Ponta -->
          <circle cx="32" cy="9.5" r="1.8" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  `;
};

// Marcador do Motorista na tela do Admin / Atendente / Terminal (Mostra o Veículo 3D com a tag do motorista no centro da bola que pulsa)
