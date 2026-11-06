export const opOfKey = (key: string) => key.match(/coleta|entrega|troca|retorno/i)?.[0]?.toLowerCase() || '';
export const numOfKey = (key: string) => key.match(/\d+/)?.[0] || '';
