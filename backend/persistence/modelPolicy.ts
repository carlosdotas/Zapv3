/** Modelos que já exigem MySQL; os demais mantêm a política de compatibilidade existente. */
export const requiresPersistentDatabase = (model: string): boolean =>
  model === 'orders' || model === 'transportadoras';
