import React, { useCallback } from 'react';
import { Customer } from '../../types/customer';
import { resolveCustomerCity } from '../../utils/addressUtils';
import { normalizeCustomerId } from '../../utils/customerIdentity';
import { api } from '../../services/api';
import type { MapContextType } from '../mapStoreTypes';

interface Dependencies {
  customerMutationVersion: React.MutableRefObject<number>;
  lastCustomersSyncAt: React.MutableRefObject<number>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  customers: MapContextType['customers'];
}

export function useCustomerActions({ customerMutationVersion, lastCustomersSyncAt, setCustomers, customers }: Dependencies) {
const persistCustomer = useCallback(async (customer: Customer): Promise<Customer | null> => {
    const normalizedId = customer.id.trim().replace(/^db-user-/, '');
    const serverId = /^\d+$/.test(normalizedId) ? normalizedId : undefined;
    const phone = customer.phone?.trim();
    if (!serverId && !phone && !customer.fullName?.trim()) {
      console.warn('[Customers] Não foi possível salvar um cliente sem nome.');
      return null;
    }

    try {
      const city = resolveCustomerCity(customer);
      const result = await api.saveUser({
        ...(serverId ? { id: serverId } : {}),
        name: customer.contactName?.trim() || customer.fullName,
        full_name: customer.fullName?.trim() || customer.contactName,
        name_completo: customer.fullName?.trim() || customer.contactName,
        phone,
        cpf: customer.cpf,
        cnpj: customer.cnpj,
        person_type: customer.personType,
        email: customer.email,
        notes: customer.notes,
        companyId: customer.companyId,
        address: customer.address || '',
        endereco: customer.address || '',
        coordinates: customer.coordinates || null,
        additionalAddresses: customer.additionalAddresses || [],
        additional_addresses: customer.additionalAddresses || [],
        ...(city ? { city, cidade: city } : {}),
        access_level: 'cliente'
      });
      if (!result.success) {
        console.warn('[Customers] O servidor recusou salvar o cliente:', result.message);
        return null;
      }

      const responseId = result.id ?? result.data?.id ?? serverId;
      if (responseId == null || String(responseId).trim() === '') {
        console.warn('[Customers] O servidor confirmou o salvamento sem retornar o ID do cliente.');
        return null;
      }
      const savedId = String(responseId);
      const persistedCustomer: Customer = {
        ...customer,
        id: savedId,
        ...(city ? { city, cidade: city } : {})
      };
      customerMutationVersion.current += 1;
      lastCustomersSyncAt.current = 0;
      setCustomers(prev => {
        const normalizedCustomerId = customer.id.replace(/^db-user-/, '');
        const matchingIds = prev
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.id.replace(/^db-user-/, '') === normalizedCustomerId);
        const phoneDigits = phone?.replace(/\D/g, '') || '';
        const phoneMatches = phoneDigits
          ? prev.map((item, index) => ({ item, index })).filter(({ item }) => item.phone.replace(/\D/g, '') === phoneDigits)
          : [];
        const matchIndex = matchingIds[0]?.index ?? (phoneMatches.length === 1 ? phoneMatches[0].index : -1);
        const savedCustomer = {
          ...(matchIndex >= 0 ? prev[matchIndex] : {}),
          ...persistedCustomer,
          id: matchIndex >= 0 && !prev[matchIndex].id.replace(/^db-user-/, '').startsWith('cust-')
            ? prev[matchIndex].id.replace(/^db-user-/, '')
            : savedId,
          ...(city ? { city, cidade: city } : {})
        };
        const next = [...prev];
        if (matchIndex >= 0) next[matchIndex] = savedCustomer;
        else next.unshift(savedCustomer);
        return next;
      });
      return persistedCustomer;
    } catch (error) {
      console.warn('[Customers] Falha ao persistir cliente:', error);
      return null;
    }
  }, []);

  const addCustomer = useCallback((customerData: Omit<Customer, 'id' | 'createdAt'>, options?: { persist?: boolean }): Customer => {
    const city = resolveCustomerCity(customerData);
    const newCustomer: Customer = {
      ...customerData,
      ...(city ? { city, cidade: city } : {}),
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now()
    };
    customerMutationVersion.current += 1;
    setCustomers(prev => [newCustomer, ...prev]);

    if (options?.persist !== false) {
      void persistCustomer(newCustomer);
    }

    return newCustomer;
  }, [persistCustomer]);

  const updateCustomer = useCallback(async (id: string, partial: Partial<Customer>): Promise<boolean> => {
    const existingCustomer = customers.find(customer => customer.id === id);
    const addressChanged = partial.address !== undefined && partial.address !== existingCustomer?.address;
    const cityChanged = partial.city !== undefined && partial.city !== existingCustomer?.city;
    const legacyCityChanged = partial.cidade !== undefined && partial.cidade !== existingCustomer?.cidade;
    const cityFromAddress = addressChanged ? resolveCustomerCity({ address: partial.address }) : undefined;
    const cityFromFields = cityChanged || legacyCityChanged
      ? resolveCustomerCity({ city: partial.city, cidade: partial.cidade })
      : undefined;
    const city = cityFromAddress || cityFromFields || resolveCustomerCity(existingCustomer || {}) || resolveCustomerCity(partial);
    const normalizedPartial = city ? { ...partial, city, cidade: city } : partial;

    const customerToPersist = {
      ...(existingCustomer || {}),
      ...normalizedPartial,
      id
    } as Customer;
    const saved = await persistCustomer(customerToPersist);
    if (!saved) return false;

    return true;
  }, [customers, persistCustomer]);

  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    const normalizedId = normalizeCustomerId(id);
    if (!/^\d+$/.test(normalizedId)) return false;

    const result = await api.deleteUser(normalizedId);
    if (!result.success) return false;

    setCustomers(prev => {
      return prev.filter(customer => normalizeCustomerId(customer.id) !== normalizedId);
    });
    return true;
  }, []);
  return { persistCustomer, addCustomer, updateCustomer, deleteCustomer };
}
