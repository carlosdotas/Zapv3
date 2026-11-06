// Pedidos criados no app nascem com id temporário (pedido-<timestamp>) até o servidor devolver o id real.
export const tempPedidoIdMap = new Map<string, string>();
export const resolvePlaceId = (id: string): string => {
  let current = id;
  for (let i = 0; i < 5 && tempPedidoIdMap.has(current); i++) current = tempPedidoIdMap.get(current)!;
  return current;
};
// Id numérico que não cabe no banco (timestamp) = pedido ainda sem id real do servidor
export const isTempPedidoNumber = (num?: string | null): boolean => !num || Number(num) > 2147483647;

