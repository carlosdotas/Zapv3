import { useMemo } from 'react';
import { useState, useCallback } from 'react';
import { Place, DateRangeFilter } from '../../types/map';

export function useMapUiState() {
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  // O sistema exige login ao ser aberto; se ainda não houver sessão ativa, solicita o login imediatamente
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('encomendaszap_is_authenticated') !== 'true'
        || !localStorage.getItem('encomendaszap_logged_account');
    } catch {
      return true;
    }
  });
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState<boolean>(false);
  const [isAdminUsersOpen, setIsAdminUsersOpen] = useState<boolean>(false);
  const [adminUsersRoleFilter, setAdminUsersRoleFilter] = useState<'todos' | 'motorista' | 'atendente'>('todos');
  const [isCustomerListOpen, setIsCustomerListOpen] = useState<boolean>(false);
  const openCustomerList = useCallback(() => setIsCustomerListOpen(true), []);
  const closeCustomerList = useCallback(() => setIsCustomerListOpen(false), []);

  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState<boolean>(false);

  // Passar rota: admin/atendente seleciona vários locais e depois escolhe o motorista
  const [routeSelectMode, setRouteSelectMode] = useState<boolean>(false);
  const [routeSelectedIds, setRouteSelectedIds] = useState<string[]>([]);
  const [isRoutePickerOpen, setIsRoutePickerOpen] = useState<boolean>(false);
  const startRouteSelection = useCallback(() => {
    setRouteSelectedIds([]);
    setRouteSelectMode(true);
  }, []);
  const cancelRouteSelection = useCallback(() => {
    setRouteSelectMode(false);
    setRouteSelectedIds([]);
    setIsRoutePickerOpen(false);
  }, []);
  const toggleRouteSelection = useCallback((ids: string[]) => {
    setRouteSelectedIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      return allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]));
    });
  }, []);
  const openOrdersModal = useCallback(() => setIsOrdersModalOpen(true), []);
  const closeOrdersModal = useCallback(() => setIsOrdersModalOpen(false), []);

  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState<boolean>(false);
  const [financialInitialTab, setFinancialInitialTab] = useState<'pagar' | 'receber'>('pagar');
  const openFinancialModal = useCallback((tab?: 'pagar' | 'receber') => {
    if (tab) setFinancialInitialTab(tab);
    setIsFinancialModalOpen(true);
  }, []);
  const closeFinancialModal = useCallback(() => setIsFinancialModalOpen(false), []);

  const [dateRangeFilter, setDateRangeFilterState] = useState<DateRangeFilter>({
    startDate: null,
    endDate: null,
    preset: null
  });
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const openCalendarModal = useCallback(() => setIsCalendarModalOpen(true), []);
  const closeCalendarModal = useCallback(() => setIsCalendarModalOpen(false), []);

  const setDateRangeFilter = useCallback((filter: DateRangeFilter) => {
    setDateRangeFilterState(filter);
  }, []);

  const clearDateRangeFilter = useCallback(() => {
    setDateRangeFilterState({
      startDate: null,
      endDate: null,
      preset: null
    });
  }, []);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [newOrderInitialPlace, setNewOrderInitialPlace] = useState<Partial<Place> | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [viewingPhotoPlace, setViewingPhotoPlace] = useState<Place | null>(null);

  const openPhotoViewer = useCallback((photoUrl: string, place?: Place | null) => {
    setViewingPhotoUrl(photoUrl);
    setViewingPhotoPlace(place || null);
  }, []);

  const closePhotoViewer = useCallback(() => {
    setViewingPhotoUrl(null);
    setViewingPhotoPlace(null);
  }, []);


  return useMemo(() => ({ showTraffic, setShowTraffic, isSidebarOpen, setIsSidebarOpen, isProfileOpen, setIsProfileOpen, isLoginModalOpen, setIsLoginModalOpen, isRegisterModalOpen, setIsRegisterModalOpen, isAdminSettingsOpen, setIsAdminSettingsOpen, isAdminUsersOpen, setIsAdminUsersOpen, adminUsersRoleFilter, setAdminUsersRoleFilter, isCustomerListOpen, setIsCustomerListOpen, openCustomerList, closeCustomerList, isOrdersModalOpen, setIsOrdersModalOpen, routeSelectMode, setRouteSelectMode, routeSelectedIds, setRouteSelectedIds, isRoutePickerOpen, setIsRoutePickerOpen, startRouteSelection, cancelRouteSelection, toggleRouteSelection, openOrdersModal, closeOrdersModal, isFinancialModalOpen, setIsFinancialModalOpen, financialInitialTab, setFinancialInitialTab, openFinancialModal, closeFinancialModal, dateRangeFilter, setDateRangeFilterState, isCalendarModalOpen, setIsCalendarModalOpen, openCalendarModal, closeCalendarModal, setDateRangeFilter, clearDateRangeFilter, isNewOrderModalOpen, setIsNewOrderModalOpen, newOrderInitialPlace, setNewOrderInitialPlace, viewingPhotoUrl, setViewingPhotoUrl, viewingPhotoPlace, setViewingPhotoPlace, openPhotoViewer, closePhotoViewer }), [showTraffic, setShowTraffic, isSidebarOpen, setIsSidebarOpen, isProfileOpen, setIsProfileOpen, isLoginModalOpen, setIsLoginModalOpen, isRegisterModalOpen, setIsRegisterModalOpen, isAdminSettingsOpen, setIsAdminSettingsOpen, isAdminUsersOpen, setIsAdminUsersOpen, adminUsersRoleFilter, setAdminUsersRoleFilter, isCustomerListOpen, setIsCustomerListOpen, openCustomerList, closeCustomerList, isOrdersModalOpen, setIsOrdersModalOpen, routeSelectMode, setRouteSelectMode, routeSelectedIds, setRouteSelectedIds, isRoutePickerOpen, setIsRoutePickerOpen, startRouteSelection, cancelRouteSelection, toggleRouteSelection, openOrdersModal, closeOrdersModal, isFinancialModalOpen, setIsFinancialModalOpen, financialInitialTab, setFinancialInitialTab, openFinancialModal, closeFinancialModal, dateRangeFilter, setDateRangeFilterState, isCalendarModalOpen, setIsCalendarModalOpen, openCalendarModal, closeCalendarModal, setDateRangeFilter, clearDateRangeFilter, isNewOrderModalOpen, setIsNewOrderModalOpen, newOrderInitialPlace, setNewOrderInitialPlace, viewingPhotoUrl, setViewingPhotoUrl, viewingPhotoPlace, setViewingPhotoPlace, openPhotoViewer, closePhotoViewer]);
}
