/**
 * financialService.ts
 * Serviço de comunicação da Área Financeira para Contas a Pagar e Contas a Receber.
 */

import type { PayableAccount, ReceivableAccount } from '../utils/financialUtils';
import { request } from './httpClient';

const FINANCIAL_TIMEOUT_MS = 30000;

export interface FetchPayableParams {
  driver_id?: string;
  paid?: boolean | 'all';
  from?: string;
  to?: string;
  busca?: string;
}

export interface FetchReceivableParams {
  client_id?: number | string;
  client_name?: string;
  status?: 'unpaid' | 'paid' | 'all';
  from?: string;
  to?: string;
  busca?: string;
}

export interface FinancialApiResponse<T> {
  success: boolean;
  data: T[];
  subtotal_unpaid?: number;
  subtotal_paid?: number;
  total_count?: number;
  message?: string;
}

class FinancialService {
  // 1. Contas a Pagar (Motoristas)
  async getPayableAccounts(params: FetchPayableParams = {}): Promise<FinancialApiResponse<PayableAccount>> {
    try {
      const res = await request<PayableAccount[]>('/api/financial/payable/list', 'POST', params, FINANCIAL_TIMEOUT_MS, { requireHttpOk: true });
      if (!res.success) {
        return { success: false, data: [], subtotal_unpaid: 0, subtotal_paid: 0, total_count: 0, message: res.message };
      }
      return { ...res, data: res.data ?? [] };
    } catch (err) {
      console.warn('[FinancialService] Falha ao carregar Contas a Pagar:', err);
      return { success: false, data: [], subtotal_unpaid: 0, subtotal_paid: 0, total_count: 0 };
    }
  }

  async settlePayableAccount(ids: number | number[], paid: boolean = true): Promise<boolean> {
    try {
      const payload = Array.isArray(ids) ? { ids, paid } : { id: ids, paid };
      const res = await request('/api/financial/payable/settle', 'POST', payload, FINANCIAL_TIMEOUT_MS, { requireHttpOk: true });
      return Boolean(res.success);
    } catch (err) {
      console.warn('[FinancialService] Falha ao dar baixa em Conta a Pagar:', err);
      return false;
    }
  }

  // 2. Contas a Receber (Pedidos de Clientes)
  async getReceivableAccounts(params: FetchReceivableParams = {}): Promise<FinancialApiResponse<ReceivableAccount>> {
    try {
      const res = await request<ReceivableAccount[]>('/api/financial/receivable/list', 'POST', params, FINANCIAL_TIMEOUT_MS, { requireHttpOk: true });
      if (!res.success) {
        return { success: false, data: [], subtotal_unpaid: 0, subtotal_paid: 0, total_count: 0, message: res.message };
      }
      return { ...res, data: res.data ?? [] };
    } catch (err) {
      console.warn('[FinancialService] Falha ao carregar Contas a Receber:', err);
      return { success: false, data: [], subtotal_unpaid: 0, subtotal_paid: 0, total_count: 0 };
    }
  }

  async settleReceivableAccount(ids: number | number[], paid: boolean = true, paymentMethod?: string): Promise<boolean> {
    try {
      const payload = Array.isArray(ids)
        ? { ids, paid, payment_method: paymentMethod }
        : { id: ids, paid, payment_method: paymentMethod };

      const res = await request('/api/financial/receivable/settle', 'POST', payload, FINANCIAL_TIMEOUT_MS, { requireHttpOk: true });
      return Boolean(res.success);
    } catch (err) {
      console.warn('[FinancialService] Falha ao dar baixa em Conta a Receber:', err);
      return false;
    }
  }
}

export const financialService = new FinancialService();
