export interface RouteDeps {
  saveBase64Image: (dataUrl: string, subfolder?: string) => string | null;
  uploadToPhpServer: (dataUrl: string, tipo?: string) => Promise<string | null>;
  imageServerConfigured: () => boolean;
  notifyOrdersChanged?: () => void;
}
