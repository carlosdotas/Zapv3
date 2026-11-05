const paths = { company: 'empresa', professional: 'profissional', admin: 'admin' } as const;
type Portal = keyof typeof paths;
const subdomain = /^(empresa|profissional|admin)\./;

export function portalUrl(portal: Portal) {
  if (!subdomain.test(window.location.hostname)) return `/${paths[portal]}/`;
  const url = new URL(window.location.origin);
  url.hostname = url.hostname.replace(subdomain, `${paths[portal]}.`);
  return `${url.origin}/`;
}

export function homeUrl() {
  if (!subdomain.test(window.location.hostname)) return '/';
  const url = new URL(window.location.origin);
  url.hostname = url.hostname.replace(subdomain, '');
  return `${url.origin}/`;
}

export function registrationUrl(professionalUrl = portalUrl('professional')) {
  const url = new URL(professionalUrl, window.location.origin);
  url.hash = 'cadastro';
  return url.href;
}
