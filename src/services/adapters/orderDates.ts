import type { OrderDateBadgeType } from '../../types/map';

export function getOrderDateBadgeFromDate(dateStr?: string): OrderDateBadgeType {
  if (!dateStr) return 'hoje';
  
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const cleanDate = dateStr.slice(0, 10);
  if (cleanDate === todayStr) return 'hoje';
  if (cleanDate === yesterdayStr) return 'ontem';
  
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (cleanDate === twoDaysAgo) return '2_dias_atras';
  
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (cleanDate === threeDaysAgo) return '3_dias_atras';

  if (cleanDate < threeDaysAgo) {
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return '3_dias_atras';
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (cleanDate === tomorrowStr) return 'amanha';

  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }

  return 'hoje';
}
