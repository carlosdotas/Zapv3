import { getApiBaseUrl } from '../httpClient';
import { getImageServerUrl } from '../imageServerConfig';

export type PhotoVariantSize = 'icon' | 'thumb' | 'md' | 'lg';

/**
 * Retorna o sufixo de tamanho de acordo com a documentação do servidor:
 * - icon: _icon.jpg (48 x 48 px, q=60)
 * - thumb: _thumb.jpg (200 x 200 px, q=70)
 * - md: _md.jpg (400 x 400 px, q=80 - exibição padrão)
 * - lg: _lg.jpg (800 x 800 px, q=85 - ampliação / fullscreen)
 */
export function getVariantSuffix(size: PhotoVariantSize = 'md'): string {
  switch (size) {
    case 'icon': return '_icon.jpg';
    case 'thumb': return '_thumb.jpg';
    case 'lg': return '_lg.jpg';
    case 'md':
    default:
      return '_md.jpg';
  }
}

/**
 * Normaliza um caminho ou URL de foto para a variante de tamanho especificada:
 * - icon: _icon.jpg (48 x 48 px)
 * - thumb: _thumb.jpg (200 x 200 px)
 * - md: _md.jpg (400 x 400 px - exibição padrão)
 * - lg: _lg.jpg (800 x 800 px - ampliação / fullscreen)
 * 
 * Trata tanto caminhos relativos (/uploads/pedidos/mercadoria/...),
 * URLs completas (https://host/uploads/pedidos/mercadoria/..._lg.jpg),
 * caminhos sem sufixo, e URLs legadas base64 data:.
 */
export function normalizePhotoPath(item: any, size: PhotoVariantSize = 'md'): string {
  if (!item || typeof item !== 'string') return '';
  const trimmed = item.trim();
  if (
    !trimmed || 
    trimmed === 'null' || 
    trimmed === 'undefined' || 
    trimmed === '[]' || 
    trimmed.startsWith('[{') || 
    trimmed.startsWith('{"') ||
    trimmed.includes('maps.app.goo.gl') ||
    trimmed.includes('google.com/maps')
  ) {
    return '';
  }

  // Imagem legada data: URL (base64)
  if (trimmed.startsWith('data:')) return trimmed;

  // O servidor Node grava apenas o arquivo original, sem variantes redimensionadas.
  if (/^(?:https?:\/\/[^/]+)?\/uploads\/pedidos\/(?:coleta|entrega|mercadoria)\//i.test(trimmed) &&
      /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(trimmed) &&
      !/_(?:icon|thumb|md|lg)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(trimmed)) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${getApiBaseUrl().replace(/\/+$/, '')}${trimmed}`;
  }

  // 1. OBTÉM O LINK DO SERVIDOR DE IMAGENS CADASTRADO NAS CONFIGURAÇÕES
  const configuredServer = getImageServerUrl();
  const cleanServerEndpoint = (configuredServer || 'http://localhost/imagens/images.php')
    .split('?')[0]
    .trim()
    .replace(/\/+$/, '');
  const phpEndpoint = cleanServerEndpoint.endsWith('.php') 
    ? cleanServerEndpoint 
    : `${cleanServerEndpoint}/images.php`;
  let resolvedPhpEndpoint = phpEndpoint;
  const defaultImageServer = 'http://localhost/imagens/images.php';
  const hasConfiguredImageServer = Boolean(cleanServerEndpoint && cleanServerEndpoint !== defaultImageServer);

  try {
    const sourceUrl = new URL(trimmed);
    if (/^https?:$/.test(sourceUrl.protocol) && sourceUrl.pathname.toLowerCase().endsWith('.php')) {
      resolvedPhpEndpoint = `${sourceUrl.origin}${sourceUrl.pathname}`;
    }
  } catch {}

  // 2. DETECTA SE A FOTO PERTENCE AO SERVIDOR PHP DE IMAGENS
  const isPhpImageServer = 
    trimmed.includes('images.php') ||
    /[?&](?:f|file|img)=/i.test(trimmed) ||
    trimmed.includes('/uploads/images/') ||
    trimmed.includes('uploads/images/') ||
    trimmed.includes('/uploads/cache/') ||
    trimmed.includes('_perfil_') ||
    /^\d{9,12}_[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(trimmed) ||
    (cleanServerEndpoint && trimmed.startsWith(cleanServerEndpoint));

  if (isPhpImageServer) {
    // Extrai o nome do arquivo limpo (ex: 1793541270_perfil_86f90433.png)
    let filename = '';
    const paramMatch = trimmed.match(/[?&](?:f|file|img)=([^&#]+)/i);
    if (paramMatch) {
      filename = decodeURIComponent(paramMatch[1]);
    } else if (trimmed.includes('/uploads/images/')) {
      filename = trimmed.split('/uploads/images/').pop()?.split(/[?&#]/)[0] || '';
    } else if (trimmed.includes('/uploads/cache/')) {
      const rawCacheName = trimmed.split('/uploads/cache/').pop()?.split(/[?&#]/)[0] || '';
      const parts = rawCacheName.split('_');
      filename = parts.length > 4 ? parts.slice(4).join('_') : rawCacheName;
    } else if (trimmed.includes('/')) {
      filename = trimmed.split('/').pop()?.split(/[?&#]/)[0] || '';
    } else {
      filename = trimmed.split(/[?&#]/)[0];
    }
    filename = decodeURIComponent(filename.trim());

    if (filename && filename.length >= 3 && filename.includes('.')) {
      const sizeParam = size === 'icon' ? '&w=64&h=64&fit=crop'
                      : size === 'thumb' ? '&w=200&h=200&fit=crop'
                      : size === 'md' ? '&w=480'
                      : '&w=1200';

      return `${resolvedPhpEndpoint}?f=${encodeURIComponent(filename)}${sizeParam}`;
    }
  }

  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const suffix = getVariantSuffix(size);

  // Fotos de usuário enviadas ao servidor PHP devem usar o endpoint configurado.
  if (trimmed.includes('/uploads/users/') || trimmed.includes('/avatar')) {
    if (hasConfiguredImageServer) {
      const filename = trimmed.split('/').pop()?.split(/[?&#]/)[0] || '';
      const sizeParam = size === 'icon' ? '&w=64&h=64&fit=crop'
        : size === 'thumb' ? '&w=200&h=200&fit=crop'
          : size === 'md' ? '&w=480'
            : '&w=1200';
      if (filename) {
        return `${phpEndpoint}?f=${encodeURIComponent(decodeURIComponent(filename))}${sizeParam}`;
      }
    }

    // Fallback para fotos armazenadas diretamente no servidor Node.
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
  }

  // Se for URL externa completa que NÃO é do servidor de uploads (ex: Google, Unsplash, CDN externa)
  if (!trimmed.includes('/uploads/')) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Se for apenas o identificador da foto do dotas legado (ex: 1792778632832_be079bf20802)
    const cleanId = trimmed.replace(/^\/+/, '');
    if (!cleanId || cleanId.length < 5) return '';
    return `${baseUrl}/uploads/pedidos/mercadoria/${cleanId}${suffix}`;
  }

  // Remove qualquer sufixo e extensão existente (_icon, _thumb, _md, _lg, .jpg, .jpeg, .png, etc.)
  let cleaned = trimmed
    .replace(/_(icon|thumb|md|lg)\.(jpe?g|png|webp)$/i, '')
    .replace(/_(icon|thumb|md|lg)$/i, '')
    .replace(/\.(jpe?g|png|webp)$/i, '');

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return `${cleaned}${suffix}`;
  }

  const cleanPath = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return `${baseUrl}${cleanPath}${suffix}`;
}

/**
 * Converte um campo de foto retornado pelo backend em URL pública resolvida no tamanho desejado:
 * https://<API_BASE_URL><caminho-base>_<sufixo>.jpg
 */
export function formatPhotoUrl(rawPhoto: any, size: PhotoVariantSize = 'md'): string | null {
  if (!rawPhoto) return null;
  const urls = extractPhotoUrls(rawPhoto, size);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Extrai todos os caminhos-base ou fotos de um campo (string, array ou JSON serializado)
 * e devolve a lista de URLs completas prontas para exibição no tamanho solicitado.
 */
export function extractPhotoUrls(rawPhoto: any, size: PhotoVariantSize = 'md'): string[] {
  if (!rawPhoto) return [];

  let rawList: string[] = [];

  if (Array.isArray(rawPhoto)) {
    rawList = rawPhoto.map(p => String(p).trim()).filter(Boolean);
  } else if (typeof rawPhoto === 'string') {
    const trimmed = rawPhoto.trim();
    if (
      !trimmed || 
      trimmed === '[]' || 
      trimmed === 'null' || 
      trimmed === 'undefined' ||
      trimmed.includes('maps.app.goo.gl')
    ) {
      return [];
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawList = parsed.map(p => {
            if (typeof p === 'string') return p.trim();
            if (p && typeof p === 'object' && p.url) return String(p.url).trim();
            return '';
          }).filter(Boolean);
        }
      } catch {
        const cleaned = trimmed.replace(/[\[\]"']/g, '').split(',');
        rawList = cleaned.map(p => p.trim()).filter(Boolean);
      }
    } else {
      rawList = [trimmed];
    }
  }

  const results: string[] = [];
  for (const item of rawList) {
    const normalized = normalizePhotoPath(item, size);
    if (normalized && !results.includes(normalized)) {
      results.push(normalized);
    }
  }

  return results;
}
