let imageServerUrl = 'http://localhost/imagens/images.php';
let imageServerConfigPromise: Promise<void> | null = null;

export function initializeImageServerConfig(): Promise<void> {
  if (imageServerConfigPromise) return imageServerConfigPromise;
  imageServerConfigPromise = fetch('/api/image-server-config')
    .then(async response => {
      if (!response.ok) return;
      const result = await response.json();
      if (result?.success && result.data) {
        if (typeof result.data.url === 'string') imageServerUrl = result.data.url.trim().replace(/\/+$/, '');
      }
    })
    .catch(error => {
      console.warn('[Image Server] Não foi possível carregar a configuração do backend:', error);
    });
  return imageServerConfigPromise;
}

export function getImageServerUrl(): string {
  return imageServerUrl;
}
