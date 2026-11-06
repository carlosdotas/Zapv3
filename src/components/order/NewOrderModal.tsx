import React from 'react';
import { X, Package, MapPin, User, Bike, Car, Truck, Check, Search, AlertCircle, Plus, ArrowRight, ArrowLeft, FileText, DollarSign, Tag, Route, UserCheck, History, Layers, ChevronDown, BookUser, AlertTriangle, Scale, Minus, Database, Loader2, CheckCircle2, Compass, Trash2, Globe, Lock } from 'lucide-react';
import { MapLocationPickerModal } from '../map/MapLocationPickerModal';
import { EmbeddedLocationMapStep } from './EmbeddedLocationMapStep';
import { PhoneAgendaModal } from '../customer/PhoneAgendaModal';
import { Place } from '../../types/map';
import { CustomerSelectorDrawer } from '../customer/CustomerSelectorDrawer';
import { CurrencyCentsInput } from '../common/CurrencyCentsInput';
import { PricingItemAddMenu } from '../common/PricingItemAddMenu';
import { CustomerFormFullScreen } from '../customer/CustomerFormFullScreen';
import { CustomerOrderHistoryFullScreen } from './CustomerOrderHistoryFullScreen';
import { Customer } from '../../types/customer';
import { SellerResponsibleModal } from '../place/SellerResponsibleModal';
import { reverseGeocode } from '../../services/geocodingService';
import { checkUserCompleteness, formatTaxId } from '../../utils/userCompleteness';
import { customerOrderStatsService } from '../../services/customerOrderStatsService';
import { normalizeCityName, resolveCustomerCity } from '../../utils/addressUtils';
import L from 'leaflet';
import { extractCityFromAddress, DEFAULT_PICKUP_COORDS } from './newOrderHelpers';
import { useNewOrderForm } from './useNewOrderForm';
export type { PastOrderRecord } from '../../types/order';

export const NewOrderModal: React.FC = () => {
  const model = useNewOrderForm();
  if (!model) return null;
  const { currentStep, orderCode, setCurrentStep, canSeeOrderPrice, selectedCustomer, finalPrice, setIsNewOrderModalOpen, isSearchingDb, clientSearchTerm, setClientSearchTerm, setPhoneAgendaTarget, setIsPhoneAgendaOpen, setRegistrationInitialData, setSelectorTargetField, setIsRegistrationFullScreenOpen, databaseScrollRef, loadMoreDatabaseCustomers, clientValidation, setPastOrdersCustomer, setIsPastOrdersModalOpen, openCustomerLocationModal, updateCustomer, setSelectedCustomer, operationType, setDeliveryAddress, setDeliveryCoords, setDeliveryContact, setDeliveryPhone, setPickupAddress, setPickupCoords, setPickupContact, setPickupPhone, filteredCustomers, handleSelectClientFromList, dbCustomers, hasMoreDbCustomers, isLoadingMoreDbCustomers, databaseSentinelRef, stepErrors, handleSelectOperationType, setMapPickerTarget, pickupAddress, pickupCoords, pickupContact, pickupPhone, pickupNotes, pickupDate, pickupTime, pickupTimeMode, setPickupNotes, setPickupDate, setPickupTime, setPickupTimeMode, deliveryAddress, deliveryCoords, deliveryContact, deliveryPhone, deliveryNotes, deliveryDate, deliveryTime, deliveryTimeMode, setDeliveryNotes, setDeliveryDate, setDeliveryTime, setDeliveryTimeMode, exchangeAddress, exchangeCoords, exchangeContact, exchangePhone, exchangeNotes, exchangeDate, exchangeTime, exchangeTimeMode, setExchangeAddress, setExchangeCoords, setExchangeContact, setExchangePhone, setExchangeNotes, setExchangeDate, setExchangeTime, setExchangeTimeMode, setStepErrors, routePointConfigs, updateRoutePointConfig, CARGO_SIZE_PRESETS, packageSize, handleSelectPackageSize, toggleCargoAccordion, selectedPackageType, openCargoAccordions, setIsMultiTypeMode, isMultiTypeMode, setIsAddingNewPackageType, isAddingNewPackageType, newPackageTypeInput, setNewPackageTypeInput, handleSaveNewPackageType, packageTypeList, selectedPackageTypes, handleTogglePackageType, handleSelectPackageType, volumeQuantity, volumesCount, isFragile, handleUpdateVolumeQuantity, volumeQuantityInput, handleVolumeInputChange, handleVolumeInputBlur, setIsFragile, weightKg, lengthCm, widthCm, heightCm, handleResetMeasurementsToDefault, handleClearMeasurements, setWeightKg, setLengthCm, setWidthCm, setHeightCm, observations, setObservations, distanceKm, durationMin, miniMapContainerRef, isCalculatingRoute, miniMapInstanceRef, calculatedRoute, routeStops, drivers, setSellerEditPoint, vehicleType, pricingSettings, priceItems, handleUpdatePriceItem, handleRemovePriceItem, handleAddPriceItem, totalDiscounts, discountItems, handleUpdateDiscountItem, handleRemoveDiscountItem, handleAddDiscountItem, totalPrices, handleProceedToStep2, handleProceedToStep3, handleProceedToStep4, handleFinalizeOrder, isPastOrdersModalOpen, pastOrdersCustomer, customerPastOrdersList, handleRepeatPastOrder, isCustomerSelectorOpen, setIsCustomerSelectorOpen, setResponsibleName, setResponsiblePhone, isRegistrationFullScreenOpen, handleSaveCustomerFromRegistration, registrationInitialData, selectorTargetField, mapPickerTarget, isPhoneAgendaOpen, phoneAgendaTarget, handleSelectPhoneAgendaContact, sellerEditPoint } = model;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      
      {/* CONTAINER OTIMIZADO: APROVEITA O ESPAÇO HORIZONTAL E VERTICAL TOTALMENTE */}
      <div className={`bg-white w-full h-full ${currentStep === 2 ? 'sm:h-[94vh] sm:max-h-[96vh] sm:max-w-6xl xl:max-w-7xl' : 'sm:h-[88vh] sm:max-h-[92vh] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl'} sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150`}>
        
        {/* CABEÇALHO COMPACTO COM LINHA DO TEMPO SIMPLIFICADA NA BARRA DE TÍTULO */}
        <header className="bg-[#0B5187] text-white shrink-0 shadow-sm">
          
          {/* LINHA PRINCIPAL DA BARRA DE TÍTULO: ÍCONE + TÍTULO + LINHA DO TEMPO SIMPLIFICADA + FECHAR */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-3 border-b border-white/10">
            {/* Lado Esquerdo: Ícone + Título */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white font-black shrink-0">
                <Package className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-black tracking-tight leading-tight">
                  Nova Encomenda
                </h1>
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#FF5E00] text-white px-1.5 py-0.2 rounded-full">
                  {orderCode}
                </span>
              </div>
            </div>

            {/* CENTRO: LINHA DO TEMPO SIMPLIFICADA DAS ETAPAS NA PRÓPRIA BARRA DE TÍTULO */}
            <nav aria-label="Linha do tempo das etapas" className="flex items-center gap-1 sm:gap-2">
              {[
                { step: 1, label: 'Clientes' },
                { step: 2, label: 'Tipo & Local' },
                { step: 3, label: 'Carga' },
                { step: 4, label: 'Finalizar' }
              ].map((s, index, arr) => {
                const isPast = currentStep > s.step;
                const isCurrent = currentStep === s.step;

                return (
                  <React.Fragment key={s.step}>
                    <button
                      type="button"
                      disabled={!isPast && !isCurrent}
                      onClick={() => {
                        if (isPast) setCurrentStep(s.step as 1 | 2 | 3 | 4);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black transition-all ${
                        isCurrent 
                          ? 'bg-[#FF5E00] text-white shadow-xs' 
                          : isPast 
                          ? 'bg-white/20 text-emerald-300 hover:bg-white/30 cursor-pointer' 
                          : 'text-white/40 cursor-not-allowed'
                      }`}
                    >
                      <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        isCurrent 
                          ? 'bg-white text-[#FF5E00]' 
                          : isPast 
                          ? 'bg-emerald-400 text-[#0B5187]' 
                          : 'bg-white/20 text-white/50'
                      }`}>
                        {isPast ? '✓' : s.step}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>

                    {index < arr.length - 1 && (
                      <div className={`w-2.5 sm:w-4 h-0.5 rounded-full transition-colors ${
                        currentStep > s.step ? 'bg-emerald-400' : 'bg-white/20'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Lado Direito: Fechar X */}
            <div className="flex items-center gap-1.5 shrink-0">
              {canSeeOrderPrice && selectedCustomer && (
                <span
                  className="px-2 py-1 rounded-lg bg-emerald-400 text-[#0B5187] text-xs sm:text-sm font-black whitespace-nowrap"
                  title="Valor calculado pela tabela de preços"
                >
                  R$ {finalPrice.toFixed(2).replace('.', ',')}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer"
                title="Fechar formulário"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* LINHA 2 DA BARRA DE TÍTULO: QUANDO NA ETAPA 1 (BUSCANDO CLIENTE), INPUT DE BUSCA + NOVO CLIENTE */}
          {currentStep === 1 && (
            <div className="px-3 sm:px-4 py-2 flex items-center gap-2 bg-[#08426E]">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/70">
                  {isSearchingDb ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-amber-300" />
                  ) : (
                    <Search className="w-4.5 h-4.5" />
                  )}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  placeholder="Buscar no banco de dados, sistema ou agenda (nome, tel, CPF)..."
                  className="w-full pl-10 pr-9 py-2 bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-slate-900 placeholder:text-white/75 focus:placeholder:text-slate-400 border border-white/25 focus:border-white rounded-xl text-sm sm:text-base font-bold shadow-inner focus:outline-none transition-all"
                />
                {clientSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setClientSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/75 hover:text-white focus:text-slate-600 cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Botão de Busca Rápida na Agenda de Contatos (com texto completo) */}
              <button
                type="button"
                onClick={() => {
                  setPhoneAgendaTarget('coleta');
                  if (typeof window !== 'undefined' && window.AndroidApp && window.AndroidApp.pickContact) {
                    window.AndroidApp.pickContact();
                  } else {
                    setIsPhoneAgendaOpen(true);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 border border-sky-400/40"
                title="Buscar contato na agenda de contatos do celular"
              >
                <BookUser className="w-4 h-4 stroke-[2.5]" />
                <span>Buscar na Agenda</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegistrationInitialData(null);
                  setSelectorTargetField('client');
                  setIsRegistrationFullScreenOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Cadastrar novo cliente"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Novo Cliente</span>
                <span className="sm:hidden">Novo</span>
              </button>
            </div>
          )}

        </header>

        {/* ========================================================
            CORPO DO FORMULÁRIO: APROVEITA O ESPAÇO TOTAL (NA ETAPA 2 MAPA OCUPA 100% SEM BORDAS)
            ======================================================== */}
        <div
          ref={currentStep === 1 ? databaseScrollRef : null}
          onScroll={currentStep === 1 ? (event) => {
            const element = event.currentTarget;
            if (element.scrollHeight - element.scrollTop - element.clientHeight < 180) {
              void loadMoreDatabaseCustomers();
            }
          } : undefined}
          className={`flex-1 min-h-0 ${currentStep === 2 ? 'overflow-hidden p-0 relative flex flex-col' : 'overflow-y-auto p-3 sm:p-4 md:p-5'}`}
        >
          
          {/* ====================================================
              ETAPA 1: LISTA CHEIA DE CLIENTES (GRID MULTI-COLUNA)
              ==================================================== */}
          {currentStep === 1 && (
            <div className="flex flex-col h-full space-y-2">
              
              {/* CARD DE CLIENTE SELECIONADO: LINHA COMPACTA SEM DESPERDÍCIO */}
              {selectedCustomer && (
                <div className={`px-3.5 py-2 rounded-xl border shrink-0 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs ${
                  clientValidation.isValid 
                    ? 'bg-emerald-50/90 border-emerald-300' 
                    : 'bg-amber-50/90 border-amber-300'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ${
                      clientValidation.isValid ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}>
                      {selectedCustomer.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {selectedCustomer.fullName}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-800 font-bold">
                        📞 {selectedCustomer.phone}
                      </span>
                      <span className="text-xs text-slate-700 font-semibold font-mono">
                        {(() => {
                          const docInfo = formatTaxId(selectedCustomer.cpf);
                          return docInfo.clean ? `${docInfo.type}: ${docInfo.formatted}` : 'Sem CPF/CNPJ';
                        })()}
                      </span>
                      {selectedCustomer.address && (
                        <span className="text-xs text-slate-600 font-medium truncate max-w-xs hidden lg:inline">
                          📍 {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    {/* Validações inline */}
                    <div className="flex items-center gap-2.5 text-xs font-bold mr-1 hidden sm:flex">
                      <span className={clientValidation.hasName ? 'text-emerald-700' : 'text-red-600'}>
                        {clientValidation.hasName ? '✓' : '✗'} Nome
                      </span>
                      <span className={clientValidation.hasCpf ? 'text-emerald-700' : 'text-red-600'}>
                        {clientValidation.hasCpf ? '✓' : '✗'} CPF
                      </span>
                      <span className={clientValidation.hasLocation ? 'text-emerald-700' : 'text-red-600'}>
                        {clientValidation.hasLocation ? '✓' : '✗'} Local
                      </span>
                    </div>

                    {/* BOTÃO ÚLTIMAS ENCOMENDAS (DISPONÍVEL PARA TODOS OS CLIENTES E AGENDA) */}
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          setPastOrdersCustomer(selectedCustomer);
                          setIsPastOrdersModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#0B5187] hover:bg-[#083D66] active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver histórico de encomendas deste cliente"
                      >
                        <History className="w-4 h-4" />
                        <span>Histórico</span>
                        {customerOrderStatsService.getOrderCount(selectedCustomer) > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black text-[10.5px]">
                            {customerOrderStatsService.getOrderCount(selectedCustomer)}
                          </span>
                        )}
                      </button>
                    )}

                    {!clientValidation.hasLocation && (
                      <button
                        type="button"
                        onClick={() => {
                          openCustomerLocationModal({
                            customerId: selectedCustomer.id,
                            customerName: selectedCustomer.fullName,
                            customerPhone: selectedCustomer.phone,
                            place: (selectedCustomer.coordinates && selectedCustomer.address) ? {
                              id: `temp-${selectedCustomer.id}`,
                              name: selectedCustomer.fullName,
                              address: selectedCustomer.address,
                              coordinates: selectedCustomer.coordinates
                            } as Place : undefined,
                            onLocationSelected: async (newAddr, newCoords, newCity) => {
                              const updated: Customer = {
                                ...selectedCustomer,
                                address: newAddr,
                                coordinates: newCoords,
                                ...(newCity ? { city: newCity, cidade: newCity } : {})
                              };
                              const saved = await updateCustomer(selectedCustomer.id, updated);
                              if (!saved) {
                                window.alert('Não foi possível salvar o endereço do cliente. Verifique a conexão e tente novamente.');
                                return;
                              }
                              setSelectedCustomer(updated);
                              if (operationType === 'coleta') {
                                setDeliveryAddress(newAddr);
                                setDeliveryCoords(newCoords);
                                setDeliveryContact(updated.fullName);
                                setDeliveryPhone(updated.phone);
                              } else if (operationType === 'entrega') {
                                setPickupAddress(newAddr);
                                setPickupCoords(newCoords);
                                setPickupContact(updated.fullName);
                                setPickupPhone(updated.phone);
                              } else if (operationType === 'troca') {
                                setPickupAddress(newAddr);
                                setPickupCoords(newCoords);
                                setDeliveryAddress(newAddr);
                                setDeliveryCoords(newCoords);
                                setPickupContact(updated.fullName);
                                setDeliveryContact(updated.fullName);
                              }
                            }
                          });
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                        title="Setar localização do cliente no mapa"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Setar Local</span>
                      </button>
                    )}

                    {clientValidation.isValid ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Avançar com este cliente"
                      >
                        <span>Avançar</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRegistrationInitialData(selectedCustomer);
                          setSelectorTargetField('client');
                          setIsRegistrationFullScreenOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#FF5E00] hover:bg-[#E05300] active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-xs transition-all cursor-pointer"
                      >
                        Completar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* LISTA CHEIA EM GRID RESPONSIVO (APROVEITA A TELA INTEIRA) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
                
                {/* 1. CLIENTES CADASTRADOS NO SISTEMA (PRIMEIRO NO TOPO, NA COR VERDINHA) */}
                {filteredCustomers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-700" />
                        <span>Cadastros do Sistema ({filteredCustomers.length})</span>
                      </span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                        ✓ Cadastrados no Topo
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {filteredCustomers.map(cust => {
                        const isSelected = selectedCustomer?.id === cust.id;
                        const extraAddrCount = cust.additionalAddresses?.length || 0;
                        const city = extractCityFromAddress(cust.address);

                        const completeness = checkUserCompleteness({
                          name: cust.fullName,
                          phone: cust.phone,
                          cpf: cust.cpf
                        });
                        const orderCount = customerOrderStatsService.getOrderCount(cust);

                        return (
                          <div
                            key={cust.id}
                            onClick={() => handleSelectClientFromList(cust)}
                            title={`${cust.fullName} • Clique para avançar para a próxima etapa`}
                            className={`px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 shadow-2xs group cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-100/90 border-emerald-600 ring-2 ring-emerald-500/25 shadow-xs' 
                                : completeness.isComplete
                                  ? 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/90 active:bg-emerald-200/90'
                                  : 'border-amber-300 bg-amber-50/80 hover:bg-amber-100/90 active:bg-amber-200/90'
                            }`}
                          >
                            {/* Lado Esquerdo: Avatar com 'v' no topo + Nome e Embaixo Cidade e Telefone */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`relative w-9 h-9 rounded-lg text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
                                completeness.isComplete ? 'bg-emerald-600' : 'bg-amber-600'
                              }`}>
                                {cust.fullName.charAt(0).toUpperCase()}
                                <span className={`absolute -top-1.5 -right-1.5 w-4.5 h-4.5 text-white rounded-full flex items-center justify-center text-xs font-black border-2 border-white shadow-2xs ${
                                  completeness.isComplete ? 'bg-emerald-700' : 'bg-amber-700'
                                }`} title={completeness.isComplete ? 'Cadastro Completo' : 'Cadastro Incompleto'}>
                                  {completeness.isComplete ? '✓' : '!'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <span className={`font-extrabold text-sm sm:text-base truncate tracking-tight ${
                                    completeness.isComplete ? 'text-slate-900 group-hover:text-emerald-950' : 'text-slate-900 group-hover:text-amber-950'
                                  }`}>
                                    {cust.fullName}
                                  </span>
                                  {completeness.isComplete ? (
                                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Completo
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                                      <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                      Falta: {completeness.missingFields.join(', ')}
                                    </span>
                                  )}
                                  {extraAddrCount > 0 && (
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                                      +{extraAddrCount} locais
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs sm:text-[13px] font-semibold flex items-center gap-2 flex-wrap truncate mt-0.5 text-slate-600">
                                  <span className="text-slate-900 font-bold">{city}</span>
                                  <span className="text-slate-400 font-bold">•</span>
                                  <span className="text-slate-700 font-bold">{cust.phone || 'Sem telefone'}</span>
                                  {cust.cpf && (
                                    <>
                                      <span className="text-slate-400 font-bold">•</span>
                                      {(() => {
                                        const doc = formatTaxId(cust.cpf);
                                        return (
                                          <span className="text-emerald-800 font-bold font-mono">
                                            {doc.type}: {doc.formatted}
                                          </span>
                                        );
                                      })()}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Lado Direito: Botãozinho de histórico com quantidade de pedidos */}
                            <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPastOrdersCustomer(cust);
                                  setIsPastOrdersModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                                title={orderCount > 0 ? `Histórico: ${orderCount} ${orderCount === 1 ? 'pedido' : 'pedidos'}` : "Histórico de encomendas deste cliente"}
                              >
                                <History className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>Histórico</span>
                                {orderCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] border border-emerald-200">
                                    {orderCount}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. CLIENTES DO BANCO DE DADOS (BUSCA DINÂMICA E OTIMIZADA NO BANCO) */}
                {dbCustomers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1 mt-2.5">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-amber-700" />
                        <span>Banco de Dados Central ({dbCustomers.length})</span>
                      </span>
                      <span className="text-xs font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                        🏢 Banco
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dbCustomers.map(cust => {
                        const isSelected = selectedCustomer?.id === cust.id || (selectedCustomer?.phone && cust.phone && selectedCustomer.phone.replace(/\D/g, '') === cust.phone.replace(/\D/g, ''));
                        const city = extractCityFromAddress(cust.address);
                        const completeness = checkUserCompleteness({
                          name: cust.fullName,
                          phone: cust.phone,
                          cpf: cust.cpf
                        });
                        const orderCount = customerOrderStatsService.getOrderCount(cust);

                        return (
                          <div
                            key={cust.id}
                            onClick={() => {
                              handleSelectClientFromList(cust);
                            }}
                            title={`${cust.fullName} • Clique para selecionar este cliente do banco de dados`}
                            className={`px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 shadow-2xs group cursor-pointer ${
                              isSelected 
                                ? 'bg-amber-100/90 border-amber-600 ring-2 ring-amber-500/25 shadow-xs' 
                                : completeness.isComplete
                                  ? 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/90 active:bg-emerald-200/90'
                                  : 'border-amber-300 bg-amber-50/80 hover:bg-amber-100/90 active:bg-amber-200/90'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`relative w-9 h-9 rounded-lg text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
                                completeness.isComplete ? 'bg-emerald-600' : 'bg-amber-600'
                              }`}>
                                {cust.fullName.charAt(0).toUpperCase()}
                                <span className={`absolute -top-1.5 -right-1.5 w-4.5 h-4.5 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-2xs ${
                                  completeness.isComplete ? 'bg-emerald-700' : 'bg-amber-700'
                                }`} title={completeness.isComplete ? 'Cadastro Completo' : 'Cadastro Incompleto'}>
                                  {completeness.isComplete ? '✓' : '!'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <span className={`font-extrabold text-sm sm:text-base truncate tracking-tight ${
                                    completeness.isComplete ? 'text-slate-900 group-hover:text-emerald-950' : 'text-slate-900 group-hover:text-amber-950'
                                  }`}>
                                    {cust.fullName}
                                  </span>
                                  {completeness.isComplete ? (
                                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Completo
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                                      <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                      Falta: {completeness.missingFields.join(', ')}
                                    </span>
                                  )}
                                  {cust.cpf && (
                                    <span className="text-[11px] font-bold bg-amber-200/80 text-amber-950 px-1.5 py-0.2 rounded border border-amber-300 shrink-0 font-mono">
                                      {formatTaxId(cust.cpf).displayLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs sm:text-[13px] font-semibold flex items-center gap-2 flex-wrap truncate mt-0.5 text-slate-600">
                                  <span className="text-slate-900 font-bold">{city}</span>
                                  {cust.phone && (
                                    <>
                                      <span className="text-slate-400 font-bold">•</span>
                                      <span className="text-slate-700 font-bold">{cust.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPastOrdersCustomer(cust);
                                  setIsPastOrdersModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                                title={orderCount > 0 ? `Histórico: ${orderCount} ${orderCount === 1 ? 'pedido' : 'pedidos'}` : "Histórico de encomendas deste cliente"}
                              >
                                <History className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Histórico</span>
                                {orderCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] border border-amber-200">
                                    {orderCount}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* INDICADOR DE CARREGAMENTO DO BANCO DE DADOS */}
                {isSearchingDb && (
                  <div className="py-2.5 px-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-amber-900 text-xs font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    <span>Buscando no banco de dados em tempo real...</span>
                  </div>
                )}

                {filteredCustomers.length === 0 && dbCustomers.length === 0 && !isSearchingDb && !hasMoreDbCustomers && (
                  <div className="py-12 text-center text-slate-400">
                    <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-sm text-slate-600">Nenhum cliente cadastrado encontrado com esse termo.</p>
                    <p className="text-xs text-slate-400 mt-1">Experimente buscar por outro nome, telefone ou CPF.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneAgendaTarget('coleta');
                        if (typeof window !== 'undefined' && window.AndroidApp && window.AndroidApp.pickContact) {
                          window.AndroidApp.pickContact();
                        } else {
                          setIsPhoneAgendaOpen(true);
                        }
                      }}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-800 border border-sky-300 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-xs"
                    >
                      <BookUser className="w-4 h-4 text-sky-600" />
                      <span>Buscar na Agenda de Contatos</span>
                    </button>
                  </div>
                )}

                {isLoadingMoreDbCustomers && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-amber-800">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando mais clientes do banco...
                  </div>
                )}
                <div ref={databaseSentinelRef} className={hasMoreDbCustomers ? 'h-3' : 'h-0'} aria-hidden="true" />

              </div>

              {stepErrors.client && (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{stepErrors.client}</span>
                </p>
              )}
            </div>
          )}

          {/* ====================================================
              ETAPA 2: LOCAIS COM O MAPA INTEGRADO DIRETO NA TELA
              ==================================================== */}
          {currentStep === 2 && (
            <EmbeddedLocationMapStep
              selectedCustomer={selectedCustomer}
              operationType={operationType}
              onSelectOperationType={handleSelectOperationType}
              onOpenFullScreenMap={() => setMapPickerTarget(operationType)}

              pickupAddress={pickupAddress}
              pickupCoords={pickupCoords}
              pickupContact={pickupContact}
              pickupPhone={pickupPhone}
              pickupNotes={pickupNotes}
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              pickupTimeMode={pickupTimeMode}
              onUpdatePickup={(data) => {
                if (data.address !== undefined) setPickupAddress(data.address);
                if (data.coords !== undefined) setPickupCoords(data.coords);
                if (data.contact !== undefined) setPickupContact(data.contact);
                if (data.phone !== undefined) setPickupPhone(data.phone);
                if (data.notes !== undefined) setPickupNotes(data.notes);
                if (data.date !== undefined) setPickupDate(data.date);
                if (data.time !== undefined) setPickupTime(data.time);
                if (data.timeMode !== undefined) setPickupTimeMode(data.timeMode);
              }}

              deliveryAddress={deliveryAddress}
              deliveryCoords={deliveryCoords}
              deliveryContact={deliveryContact}
              deliveryPhone={deliveryPhone}
              deliveryNotes={deliveryNotes}
              deliveryDate={deliveryDate}
              deliveryTime={deliveryTime}
              deliveryTimeMode={deliveryTimeMode}
              onUpdateDelivery={(data) => {
                if (data.address !== undefined) setDeliveryAddress(data.address);
                if (data.coords !== undefined) setDeliveryCoords(data.coords);
                if (data.contact !== undefined) setDeliveryContact(data.contact);
                if (data.phone !== undefined) setDeliveryPhone(data.phone);
                if (data.notes !== undefined) setDeliveryNotes(data.notes);
                if (data.date !== undefined) setDeliveryDate(data.date);
                if (data.time !== undefined) setDeliveryTime(data.time);
                if (data.timeMode !== undefined) setDeliveryTimeMode(data.timeMode);
              }}

              exchangeAddress={exchangeAddress}
              exchangeCoords={exchangeCoords}
              exchangeContact={exchangeContact}
              exchangePhone={exchangePhone}
              exchangeNotes={exchangeNotes}
              exchangeDate={exchangeDate}
              exchangeTime={exchangeTime}
              exchangeTimeMode={exchangeTimeMode}
              onUpdateExchange={(data) => {
                if (data.address !== undefined) setExchangeAddress(data.address);
                if (data.coords !== undefined) setExchangeCoords(data.coords);
                if (data.contact !== undefined) setExchangeContact(data.contact);
                if (data.phone !== undefined) setExchangePhone(data.phone);
                if (data.notes !== undefined) setExchangeNotes(data.notes);
                if (data.date !== undefined) setExchangeDate(data.date);
                if (data.time !== undefined) setExchangeTime(data.time);
                if (data.timeMode !== undefined) setExchangeTimeMode(data.timeMode);
              }}

              stepErrors={stepErrors}
              onClearError={(field) => {
                setStepErrors(prev => {
                  const updated = { ...prev };
                  delete updated[field];
                  return updated;
                });
              }}
              onOpenPhoneAgenda={(target) => {
                setPhoneAgendaTarget(target);
                if (typeof window !== 'undefined' && window.AndroidApp && window.AndroidApp.pickContact) {
                  window.AndroidApp.pickContact();
                } else {
                  setIsPhoneAgendaOpen(true);
                }
              }}
              onChangeCustomer={() => setCurrentStep(1)}
              onUpdateCustomerLocation={async (address, coords) => {
                if (selectedCustomer) {
                  let city = resolveCustomerCity({ address });
                  if (!city) {
                    try {
                      city = resolveCustomerCity(await reverseGeocode(coords));
                    } catch {}
                  }
                  city = city || normalizeCityName(selectedCustomer.city || selectedCustomer.cidade);
                  const updatedCust: Customer = {
                    ...selectedCustomer,
                    address,
                    coordinates: coords,
                    ...(city ? { city, cidade: city } : {})
                  };
                  const saved = await updateCustomer(selectedCustomer.id, updatedCust);
                  if (!saved) {
                    window.alert('Não foi possível salvar o endereço do cliente. Verifique a conexão e tente novamente.');
                    return;
                  }
                  setSelectedCustomer(updatedCust);
                }
              }}
              routePointConfigs={routePointConfigs}
              onUpdateRoutePointConfig={updateRoutePointConfig}
              onSelectCustomer={handleSelectClientFromList}
            />
          )}

          {/* ====================================================
              ETAPA 3: TRANSPORTE, CARGA, VOLUMES E DETALHES (COM ACORDIONS)
              ==================================================== */}
          {currentStep === 3 && (
            <div className="space-y-3 animate-in fade-in duration-150">
              
              {/* ========================================================
                  1. TAMANHO DA CARGA & PORTE EM GRANDE EVIDÊNCIA (PRINCIPAL)
                  ======================================================== */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#0B5187] text-white flex items-center justify-center font-black shadow-2xs">
                      <Truck className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span>1. Tamanho da Carga & Porte do Veículo</span>
                        <span className="text-red-500">*</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        Selecione o tamanho para definir o veículo e capacidades recomendadas
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-black uppercase tracking-wider bg-blue-50 text-[#0B5187] px-2.5 py-1 rounded-full border border-blue-200">
                    Porte Ativo: {CARGO_SIZE_PRESETS[packageSize].label} ({CARGO_SIZE_PRESETS[packageSize].vehicle})
                  </span>
                </div>

                {/* BOTÕES DE TAMANHO EM GRANDE EVIDÊNCIA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      ...CARGO_SIZE_PRESETS.pequeno,
                      icon: Bike,
                      activeClass: 'border-amber-500 bg-linear-to-b from-amber-50/90 to-amber-100/50 text-amber-950 ring-3 ring-amber-400/50 shadow-md scale-[1.01]',
                      inactiveClass: 'bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-700',
                      badgeActive: 'bg-amber-500 text-white shadow-2xs',
                      badgeInactive: 'bg-amber-100 text-amber-900 border border-amber-200',
                      iconBg: 'bg-amber-500 text-white'
                    },
                    {
                      ...CARGO_SIZE_PRESETS.medio,
                      icon: Car,
                      activeClass: 'border-emerald-500 bg-linear-to-b from-emerald-50/90 to-emerald-100/50 text-emerald-950 ring-3 ring-emerald-400/50 shadow-md scale-[1.01]',
                      inactiveClass: 'bg-slate-50/70 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700',
                      badgeActive: 'bg-emerald-600 text-white shadow-2xs',
                      badgeInactive: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
                      iconBg: 'bg-emerald-600 text-white'
                    },
                    {
                      ...CARGO_SIZE_PRESETS.grande,
                      icon: Truck,
                      activeClass: 'border-indigo-500 bg-linear-to-b from-indigo-50/90 to-indigo-100/50 text-indigo-950 ring-3 ring-indigo-400/50 shadow-md scale-[1.01]',
                      inactiveClass: 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700',
                      badgeActive: 'bg-indigo-600 text-white shadow-2xs',
                      badgeInactive: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
                      iconBg: 'bg-indigo-600 text-white'
                    }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = packageSize === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPackageSize(item.id)}
                        className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 select-none relative ${
                          isSelected ? item.activeClass : item.inactiveClass
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                              isSelected ? `${item.iconBg} shadow-xs scale-105` : 'bg-white border border-slate-200 text-slate-600'
                            }`}>
                              <Icon className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                              <span className="text-sm font-black block leading-tight">{item.label}</span>
                              <span className="text-[10px] text-slate-500 font-semibold">{item.sublabel}</span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-xs shrink-0 font-black shadow-2xs">
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Veículo e Peso Máximo */}
                        <div className="flex items-center justify-between gap-1 w-full pt-1 border-t border-slate-200/60">
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg truncate ${
                            isSelected ? item.badgeActive : item.badgeInactive
                          }`}>
                            {item.vehicle}
                          </span>
                          <span className="text-[11px] font-black text-[#0B5187] truncate">
                            {item.maxWeightText}
                          </span>
                        </div>

                        {/* Dimensões padrão */}
                        <div className="text-[10px] text-slate-500 font-semibold truncate">
                          Dimensões: <strong className="text-slate-800 font-bold">{item.dimensionsText}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ========================================================
                  2. DEMAIS CONFIGURAÇÕES EM ACORDIONS FECHADOS POR PADRÃO
                  ======================================================== */}
              <div className="space-y-2.5">
                
                {/* ACORDION 1: TIPO DE ENCOMENDA & EMBALAGEM */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleCargoAccordion('types')}
                    className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0B5187] border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <Package className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            Tipo de Encomenda & Embalagem
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Defina a embalagem (Envelope, Caixa, Cilindro, etc.)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-blue-50 text-[#0B5187] border border-blue-200 max-w-[140px] sm:max-w-[220px] truncate">
                        {selectedPackageType || 'Envelope'}
                      </span>
                      <div className={`w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        openCargoAccordions.types ? 'rotate-180 bg-blue-50 text-[#0B5187]' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>

                  {openCargoAccordions.types && (
                    <div className="p-3.5 sm:p-4 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150 bg-slate-50/40">
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <span className="text-xs font-bold text-slate-600">
                          Escolha os tipos de itens para o transporte:
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsMultiTypeMode(!isMultiTypeMode)}
                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                              isMultiTypeMode 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Permite selecionar mais de um tipo de carga no mesmo pedido"
                          >
                            <Layers className="w-3 h-3 stroke-[2.5]" />
                            <span>{isMultiTypeMode ? '✓ Múltiplos tipos ativos' : '+ Selecionar mais de 1 tipo'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsAddingNewPackageType(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#0B5187] bg-white hover:bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>+ Novo Tipo</span>
                          </button>
                        </div>
                      </div>

                      {/* Input inline para adicionar novo tipo */}
                      {isAddingNewPackageType && (
                        <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center gap-2 flex-wrap animate-in fade-in duration-150">
                          <input
                            type="text"
                            autoFocus
                            value={newPackageTypeInput}
                            onChange={(e) => setNewPackageTypeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNewPackageType();
                              if (e.key === 'Escape') setIsAddingNewPackageType(false);
                            }}
                            placeholder="Nome do tipo (ex: Bolo, Vidro, Flores, Pneu)..."
                            className="flex-1 min-w-[140px] px-3 py-1.5 bg-white border border-slate-300 focus:border-[#0B5187] rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleSaveNewPackageType}
                            disabled={!newPackageTypeInput.trim()}
                            className="px-3 py-1.5 bg-[#0B5187] hover:bg-blue-900 disabled:opacity-50 text-white font-black text-xs rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewPackageType(false);
                              setNewPackageTypeInput('');
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Chips compactos e organizados */}
                      <div className="flex items-center gap-1.5 flex-wrap max-h-[160px] overflow-y-auto pr-0.5 custom-scrollbar">
                        {packageTypeList.map((type) => {
                          const isSelected = selectedPackageTypes.includes(type);
                          const isFrg = type.toLowerCase().includes('frágil') || type.toLowerCase().includes('fragil');
                          const isCil = type.toLowerCase().includes('cilindro');
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                if (isMultiTypeMode) {
                                  handleTogglePackageType(type);
                                } else {
                                  handleSelectPackageType(type);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                                isSelected
                                  ? isCil
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400'
                                    : isFrg
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400'
                                    : 'bg-[#0B5187] text-white border-[#0B5187] shadow-xs ring-2 ring-blue-300'
                                  : isCil
                                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                                  : isFrg
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              {isCil ? <span>🛢️</span> : isFrg ? <AlertTriangle className="w-3.5 h-3.5 text-current shrink-0" /> : null}
                              <span>{type}</span>
                              {isSelected && <span className="font-black">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ACORDION 2: QUANTIDADE DE VOLUMES & CARGA FRÁGIL */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleCargoAccordion('volumes')}
                    className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <Layers className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            Quantidade de Volumes & Cuidado Especial
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Total de volumes e sinalização de frágil
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200">
                        {selectedPackageTypes.some(t => t.toLowerCase().includes('cilindro')) && selectedPackageTypes.length === 1
                          ? `${volumeQuantity} ${volumeQuantity === 1 ? 'cilindro' : 'cilindros'}`
                          : volumesCount}
                      </span>
                      {isFragile && (
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                          ⚠️ Frágil
                        </span>
                      )}
                      <div className={`w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        openCargoAccordions.volumes ? 'rotate-180 bg-purple-50 text-purple-700' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>

                  {openCargoAccordions.volumes && (
                    <div className="p-3.5 sm:p-4 border-t border-slate-100 space-y-3.5 animate-in fade-in duration-150 bg-slate-50/40">
                      
                      {/* CONTROLE DE VOLUME */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Total de Volumes:
                          </label>
                          <span className="text-xs font-black text-[#0B5187]">
                            {volumesCount}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateVolumeQuantity(volumeQuantity - 1)}
                            disabled={volumeQuantity <= 1}
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-slate-300 text-slate-800 flex items-center justify-center font-black transition-all cursor-pointer shadow-2xs shrink-0"
                            title="Diminuir volume (-1)"
                          >
                            <Minus className="w-5 h-5 stroke-[3]" />
                          </button>

                          <div className="relative flex-1">
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={volumeQuantityInput}
                              onChange={(e) => handleVolumeInputChange(e.target.value)}
                              onBlur={handleVolumeInputBlur}
                              className="w-full text-center py-2.5 px-3 bg-white border-2 border-slate-300 focus:border-[#0B5187] rounded-xl text-base sm:text-lg font-black text-slate-900 focus:outline-none transition-all shadow-inner"
                              placeholder="1"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none hidden sm:inline">
                              {selectedPackageTypes.some(t => t.toLowerCase().includes('cilindro')) && selectedPackageTypes.length === 1
                                ? (volumeQuantity === 1 ? 'cil' : 'cils')
                                : (volumeQuantity === 1 ? 'vol' : 'vols')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUpdateVolumeQuantity(volumeQuantity + 1)}
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0B5187] hover:bg-blue-900 active:scale-95 text-white flex items-center justify-center font-black transition-all cursor-pointer shadow-xs shrink-0"
                            title="Aumentar volume (+1)"
                          >
                            <Plus className="w-5 h-5 stroke-[3]" />
                          </button>
                        </div>

                        {/* Botões rápidos de volumes */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Atalhos:</span>
                          {[1, 2, 3, 4, 5, 8, 10, 20].map((num) => {
                            const isSelected = volumeQuantity === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => handleUpdateVolumeQuantity(num)}
                                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-[#0B5187] text-white border-[#0B5187] shadow-2xs ring-1 ring-blue-300'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {num} {num === 1 ? 'vol' : 'vols'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Alerta de Cilindro */}
                      {selectedPackageTypes.some(t => t.toLowerCase().includes('cilindro')) && (
                        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2 shadow-2xs">
                          <span className="text-base shrink-0">🛢️</span>
                          <div className="space-y-0.5">
                            <span className="font-black text-indigo-900">Cilindro com múltiplos volumes: {volumeQuantity} un.</span>
                            <p className="text-[11px] text-indigo-800 leading-snug">
                              Adequado para transporte seguro de cilindros sob pressão.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Toggle Carga Frágil */}
                      <div
                        onClick={() => setIsFragile(!isFragile)}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                          isFragile
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isFragile ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              ⚠️ Carga Frágil / Mercadoria Delicada
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block">
                              Avisa o entregador para ter cuidado redobrado no trajeto
                            </span>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isFragile ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300'
                        }`}>
                          {isFragile && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* ACORDION 3: DIMENSÕES E PESO PERSONALIZADOS */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleCargoAccordion('dimensions')}
                    className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <Scale className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            Dimensões e Peso da Carga
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Personalize o peso em kg e medidas em centímetros
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200">
                        {weightKg ? `${weightKg} kg` : 'Padrão'} • {lengthCm || '-'}×{widthCm || '-'}×{heightCm || '-'} cm
                      </span>
                      <div className={`w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        openCargoAccordions.dimensions ? 'rotate-180 bg-amber-50 text-amber-700' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>

                  {openCargoAccordions.dimensions && (
                    <div className="p-3.5 sm:p-4 border-t border-slate-100 space-y-3 animate-in fade-in duration-150 bg-slate-50/40">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          Limites do porte selecionado ({CARGO_SIZE_PRESETS[packageSize].label}):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleResetMeasurementsToDefault}
                            className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-50 text-[#0B5187] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Restaurar padrão e peso máximo do porte"
                          >
                            Restaurar Padrão
                          </button>
                          <button
                            type="button"
                            onClick={handleClearMeasurements}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Deixar sem medidas/peso"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {/* Banner informativo de padrão e peso máximo atual */}
                      <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[11px] shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <span className="text-[#0B5187] font-black">Porte {CARGO_SIZE_PRESETS[packageSize].label}:</span>
                          <span>Capacidade: <strong className="text-slate-900">{CARGO_SIZE_PRESETS[packageSize].maxWeightText}</strong></span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Espaço útil: <strong className="text-slate-700">{CARGO_SIZE_PRESETS[packageSize].dimensionsText}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                        {/* Peso Máximo */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-black text-slate-700 block truncate">
                            Peso (kg) <span className="text-[#0B5187] font-bold">• Máx</span>
                          </span>
                          <input
                            type="text"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            placeholder={CARGO_SIZE_PRESETS[packageSize].defaultWeight}
                            className="w-full px-2.5 py-1.5 bg-white border-2 border-[#0B5187] rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                          />
                          <span className="text-[10px] font-bold text-[#0B5187] block truncate">
                            Máx: {CARGO_SIZE_PRESETS[packageSize].maxWeightKg} kg
                          </span>
                        </div>

                        {/* Comp */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-600 block truncate">Comprimento (cm)</span>
                          <input
                            type="text"
                            value={lengthCm}
                            onChange={(e) => setLengthCm(e.target.value)}
                            placeholder={CARGO_SIZE_PRESETS[packageSize].defaultLength}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-[#0B5187] rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 block truncate">
                            Padrão: {CARGO_SIZE_PRESETS[packageSize].defaultLength} cm
                          </span>
                        </div>

                        {/* Larg */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-600 block truncate">Largura (cm)</span>
                          <input
                            type="text"
                            value={widthCm}
                            onChange={(e) => setWidthCm(e.target.value)}
                            placeholder={CARGO_SIZE_PRESETS[packageSize].defaultWidth}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-[#0B5187] rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 block truncate">
                            Padrão: {CARGO_SIZE_PRESETS[packageSize].defaultWidth} cm
                          </span>
                        </div>

                        {/* Alt */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-600 block truncate">Altura (cm)</span>
                          <input
                            type="text"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            placeholder={CARGO_SIZE_PRESETS[packageSize].defaultHeight}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-[#0B5187] rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 block truncate">
                            Padrão: {CARGO_SIZE_PRESETS[packageSize].defaultHeight} cm
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACORDION 4: INSTRUÇÕES & OBSERVAÇÕES DA CARGA */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleCargoAccordion('notes')}
                    className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <FileText className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            Instruções & Observações da Carga
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Orientações específicas de transporte para o entregador
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                        observations ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {observations ? 'Preenchido' : 'Opcional'}
                      </span>
                      <div className={`w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        openCargoAccordions.notes ? 'rotate-180 bg-slate-200 text-slate-800' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </div>
                  </button>

                  {openCargoAccordions.notes && (
                    <div className="p-3.5 sm:p-4 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150 bg-slate-50/40">
                      <textarea
                        rows={2}
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Instruções para o entregador, cuidados no manuseio, etc..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-[#0B5187] rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none transition-all shadow-2xs resize-none"
                      />

                      {/* Chips rápidos de texto para observações */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-slate-500">Sugestões:</span>
                        {[
                          'Cuidado no manuseio',
                          'Manter na vertical',
                          'Não molhar',
                          'Conferir lacre',
                          'Entregar em mãos'
                        ].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              const current = observations.trim();
                              const next = current ? `${current}, ${item}` : item;
                              setObservations(next);
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-[#0B5187] border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-2xs"
                          >
                            + {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ====================================================
              ETAPA 4: DASHBOARD FINAL (MAPA À ESQUERDA, PREÇO À DIREITA)
              ==================================================== */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 animate-in fade-in duration-150">
              
              {/* LADO ESQUERDO: MINI-MAPA + ROTA + ENDEREÇOS (7 COLUNAS) */}
              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Route className="w-4 h-4 text-[#0B5187]" />
                    <span>Traçado da Rota em Tempo Real</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0B5187] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      ⚡ {distanceKm} km
                    </span>
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      ⏱️ ~{durationMin} min
                    </span>
                  </div>
                </div>

                {/* MAPA INTERATIVO REAL DA ROTA LEAFLET */}
                <div className="relative w-full h-60 sm:h-72 md:h-80 rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md bg-slate-100">
                  <div 
                    ref={miniMapContainerRef} 
                    className="w-full h-full pointer-events-auto"
                  />

                  {/* Indicador de cálculo de rota em tempo real */}
                  {isCalculatingRoute && (
                    <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 pointer-events-none">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>Traçando rota nas ruas...</span>
                    </div>
                  )}

                  {/* Botão flutuante para enquadrar a rota inteira */}
                  <button
                    type="button"
                    onClick={() => {
                      const map = miniMapInstanceRef.current;
                      if (!map) return;
                      if (calculatedRoute && calculatedRoute.coordinates && calculatedRoute.coordinates.length > 0) {
                        const poly = L.polyline(calculatedRoute.coordinates.map(c => [c.lat, c.lng] as [number, number]));
                        map.fitBounds(poly.getBounds(), { padding: [55, 55], animate: true });
                      } else {
                        const pts: L.LatLngExpression[] = [];
                        if (pickupCoords?.lat) pts.push([pickupCoords.lat, pickupCoords.lng]);
                        if (operationType === 'troca' && exchangeCoords?.lat) pts.push([exchangeCoords.lat, exchangeCoords.lng]);
                        if (deliveryCoords?.lat) pts.push([deliveryCoords.lat, deliveryCoords.lng]);
                        if (pts.length >= 2) {
                          map.fitBounds(L.latLngBounds(pts), { padding: [55, 55], animate: true });
                        }
                      }
                    }}
                    className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-xs hover:bg-white text-[#0B5187] font-black text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    title="Ajustar visualização para enquadrar a rota inteira"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#0B5187]" />
                    <span>Enquadrar Rota</span>
                  </button>
                </div>

                <section className="space-y-2.5" aria-label="Configurações das paradas da rota">
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Detalhes por ponto da rota</h3>
                    <p className="text-[10px] text-slate-500">Comentários, vendedor e visibilidade são definidos separadamente em cada parada.</p>
                  </div>
                  <div className="space-y-2">
                    {routeStops.map((stop, index) => {
                      const config = routePointConfigs[stop.key];
                      const pointDriver = drivers.find(item => item.id === config.driverId);
                      return (
                        <article key={stop.key} className={`rounded-xl border p-3 shadow-2xs ${stop.border}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: stop.color }}>
                                {index + 1} • {stop.label}
                              </span>
                              <p className="mt-0.5 text-xs font-extrabold text-slate-900">{stop.address || `Endereço de ${stop.label.toLowerCase()}`}</p>
                              <p className="mt-0.5 text-[10px] font-bold text-slate-500">📍 {extractCityFromAddress(stop.address)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSellerEditPoint(stop.key)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-orange-800 hover:bg-orange-50"
                              aria-label={`Definir vendedor de ${stop.label}`}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              {config.sellerName ? config.sellerName : 'Vendedor'}
                            </button>
                          </div>
                          <label className="mt-2 block text-[10px] font-black text-slate-700">
                            Comentários / observações deste ponto
                            <textarea
                              rows={2}
                              value={stop.notes}
                              onChange={event => stop.setNotes(event.target.value)}
                              placeholder={`Instruções para ${stop.label.toLowerCase()}...`}
                              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#0B5187]"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-slate-700">Visibilidade desta parada</span>
                            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                              {(['publico', 'privado'] as const).map(visibility => (
                                <button
                                  key={visibility}
                                  type="button"
                                  aria-pressed={config.visibility === visibility}
                                  onClick={() => updateRoutePointConfig(stop.key, {
                                    visibility,
                                    ...(visibility === 'publico' ? { driverId: '' } : {})
                                  })}
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black ${
                                    config.visibility === visibility
                                      ? visibility === 'publico' ? 'bg-emerald-600 text-white' : 'bg-[#0B5187] text-white'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {visibility === 'publico' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                  {visibility === 'publico' ? 'Público' : 'Privado'}
                                </button>
                              ))}
                            </div>
                          </div>
                          {config.visibility === 'privado' && (
                            <label className="mt-2 block text-[10px] font-black text-slate-700">
                              Motorista autorizado para esta parada
                              <select
                                value={config.driverId}
                                onChange={event => updateRoutePointConfig(stop.key, { driverId: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800"
                              >
                                <option value="">Aguardando direcionamento</option>
                                {drivers.map(item => (
                                  <option key={item.id} value={item.id}>{item.name} ({item.vehicleModel})</option>
                                ))}
                              </select>
                              <span className="mt-1 block font-medium text-slate-500">
                                {pointDriver ? `Somente ${pointDriver.name} verá esta parada.` : 'Sem motorista atribuído, a parada fica aguardando direcionamento.'}
                              </span>
                            </label>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* LADO DIREITO: FINANCEIRO, DESCONTO E MOTORISTA (5 COLUNAS) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                
                {/* Resumo do Cliente e Veículo */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cliente / Encomenda</span>
                  <p className="text-sm font-black text-slate-900 truncate">{selectedCustomer?.fullName}</p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Porte: <strong className="uppercase">{packageSize} ({vehicleType})</strong> • Carga: <strong>{selectedPackageType}</strong>{isFragile ? ' • ⚠️ FRÁGIL' : ''}{weightKg ? ` • ${weightKg}kg` : ''}{(lengthCm && widthCm && heightCm) ? ` • ${lengthCm}×${widthCm}×${heightCm}cm` : ''}
                  </p>
                  {/* Agendamento de Data e Hora: Coleta, Entrega e Troca */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold text-slate-700 pt-0.5">
                    {/* Coleta */}
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0B5187] px-2 py-0.5 rounded-md border border-blue-200">
                      <span className="font-black">Coleta:</span>
                      <span>
                        {(() => {
                          if (!pickupDate) return 'Hoje';
                          const p = pickupDate.split('-');
                          return p.length === 3 ? `${p[2]}/${p[1]}` : pickupDate;
                        })()}
                      </span>
                      {pickupTime ? (
                        <strong className="text-blue-900">({pickupTimeMode === 'ate' ? 'pegar até' : 'pegar após'} {pickupTime})</strong>
                      ) : null}
                    </span>

                    {/* Entrega */}
                    <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF5E00] px-2 py-0.5 rounded-md border border-orange-200">
                      <span className="font-black">Entrega:</span>
                      <span>
                        {(() => {
                          if (!deliveryDate) return 'Hoje';
                          const p = deliveryDate.split('-');
                          return p.length === 3 ? `${p[2]}/${p[1]}` : deliveryDate;
                        })()}
                      </span>
                      {deliveryTime ? (
                        <strong className="text-orange-900">({deliveryTimeMode === 'ate' ? 'entregar até' : 'entregar após'} {deliveryTime})</strong>
                      ) : null}
                    </span>

                    {/* Troca (se for modalidade troca) */}
                    {operationType === 'troca' && (
                      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200">
                        <span className="font-black">Troca:</span>
                        <span>
                          {(() => {
                            if (!exchangeDate) return 'Hoje';
                            const p = exchangeDate.split('-');
                            return p.length === 3 ? `${p[2]}/${p[1]}` : exchangeDate;
                          })()}
                        </span>
                        {exchangeTime ? (
                          <strong className="text-purple-950">({exchangeTimeMode === 'ate' ? 'trocar até' : 'trocar após'} {exchangeTime})</strong>
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>

                {/* PAINEL FINANCEIRO DISCRIMINADO & EDITÁVEL */}
                <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  
                  {/* Cabeçalho da Seção de Preços */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>{pricingSettings.pricingModel === 'frete_unico' ? 'Preço do Frete' : 'Preços Discriminados'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Valores editáveis</span>
                  </div>

                  {/* 1. Lista de Itens de Preço (Coleta, Transporte, Entrega ou Frete Único) */}
                  <div className="space-y-1.5">
                    {priceItems.map((item) => {
                      const isFrete = item.id === 'frete';
                      const isColeta = item.id === 'coleta';
                      const isTransp = item.id === 'transporte';
                      const isEntrega = item.id === 'entrega';
                      const isTroca = item.id === 'troca';

                      return (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {item.isRemovable ? (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdatePriceItem(item.id, { name: e.target.value })}
                                placeholder="Nome da taxa ou item..."
                                className="w-full text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200 focus:border-[#0B5187] focus:outline-none"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isFrete ? 'bg-emerald-600' : isColeta ? 'bg-[#0B5187]' : isTransp ? 'bg-indigo-600' : isEntrega ? 'bg-[#FF5E00]' : isTroca ? 'bg-purple-600' : 'bg-emerald-600'}`} />
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {item.name}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-white border border-slate-300 focus-within:border-[#0B5187] focus-within:ring-2 focus-within:ring-[#0B5187]/15 rounded-lg px-2 py-1 w-24 sm:w-28">
                              <CurrencyCentsInput
                                value={item.value}
                                onChange={(val) => handleUpdatePriceItem(item.id, { value: val })}
                                prefix="R$"
                                placeholder="0,00"
                                className="w-full text-right text-xs font-black text-slate-900"
                              />
                            </div>

                            {item.isRemovable && (
                              <button
                                type="button"
                                onClick={() => handleRemovePriceItem(item.id)}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title="Remover item de preço"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Botão com Menu de Opções para Adicionar Mais Taxas/Preços */}
                    <PricingItemAddMenu 
                      type="fee" 
                      onSelect={handleAddPriceItem} 
                    />
                  </div>

                  {/* 2. Seção de Descontos (Podendo adicionar mais) */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Descontos {totalDiscounts > 0 ? `(- R$ ${totalDiscounts.toFixed(2)})` : ''}</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {discountItems.map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/50 border border-emerald-200/80"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {item.isRemovable ? (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateDiscountItem(item.id, { name: e.target.value })}
                                placeholder="Nome do desconto..."
                                className="w-full text-xs font-bold text-emerald-950 bg-white px-2 py-1 rounded-lg border border-emerald-300 focus:border-emerald-600 focus:outline-none"
                              />
                            ) : (
                              <span className="text-xs font-bold text-emerald-950 truncate">
                                {item.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-white border border-emerald-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/15 rounded-lg px-2 py-1 w-24 sm:w-28">
                              <CurrencyCentsInput
                                value={item.value}
                                onChange={(val) => handleUpdateDiscountItem(item.id, { value: val })}
                                prefix="- R$"
                                placeholder="0,00"
                                className="w-full text-right text-xs font-black text-emerald-800"
                              />
                            </div>

                            {item.isRemovable && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDiscountItem(item.id)}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title="Remover desconto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Botões Rápidos de Desconto no Desconto Principal */}
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[0, 2, 5, 10].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              if (discountItems.length > 0) {
                                handleUpdateDiscountItem(discountItems[0].id, { value: val });
                              }
                            }}
                            className={`py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${
                              discountItems[0]?.value === val 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {val === 0 ? 'Sem desc.' : `- R$ ${val}`}
                          </button>
                        ))}
                      </div>

                      {/* Botão com Menu de Opções para Adicionar Outro Desconto */}
                      <PricingItemAddMenu 
                        type="discount" 
                        onSelect={handleAddDiscountItem} 
                      />
                    </div>
                  </div>

                  {/* 3. Preço Final em Grande Destaque */}
                  <div className="pt-2.5 border-t-2 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Total a Pagar</span>
                      <span className="text-xs text-slate-500 font-bold">
                        {totalPrices > 0 ? `Subtotal: R$ ${totalPrices.toFixed(2)}` : ''}
                        {totalDiscounts > 0 ? ` • Desc: -R$ ${totalDiscounts.toFixed(2)}` : ''}
                      </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-[#FF5E00]">
                      R$ {finalPrice.toFixed(2)}
                    </span>
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

        {/* ========================================================
            RODAPÉ COMPACTO COM BOTÕES DE AÇÃO
            ======================================================== */}
        <footer className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-md">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-extrabold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsNewOrderModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-extrabold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {currentStep === 1 && (
            <button
              type="button"
              onClick={handleProceedToStep2}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B5187] hover:bg-[#083D66] active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Avançar para Locais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep === 2 && (
            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B5187] hover:bg-[#083D66] active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Avançar para Carga</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep === 3 && (
            <button
              type="button"
              onClick={handleProceedToStep4}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B5187] hover:bg-[#083D66] active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Calcular Rota & Preço</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep === 4 && (
            <button
              type="button"
              onClick={handleFinalizeOrder}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FF5E00] hover:bg-[#E05300] active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4.5 h-4.5 stroke-[3]" />
              <span>Revisar e salvar pedido</span>
            </button>
          )}
        </footer>

      </div>

      {/* ========================================================
          TELA CHEIA DE HISTÓRICO DE ENCOMENDAS (PADRONIZADA COM A TELA DE CLIENTE)
          ======================================================== */}
      <CustomerOrderHistoryFullScreen
        isOpen={isPastOrdersModalOpen && !!pastOrdersCustomer}
        onClose={() => setIsPastOrdersModalOpen(false)}
        customer={pastOrdersCustomer}
        orders={customerPastOrdersList}
        onRepeatOrder={handleRepeatPastOrder}
      />

      {/* GAVETA DE BUSCA NA AGENDA / CLIENTES PARA RESPONSÁVEL */}
      <CustomerSelectorDrawer
        isOpen={isCustomerSelectorOpen}
        onClose={() => setIsCustomerSelectorOpen(false)}
        targetField="responsible"
        onSelectCustomer={(cust) => {
          setResponsibleName(cust.fullName);
          setResponsiblePhone(cust.phone);
          setIsCustomerSelectorOpen(false);
        }}
        onOpenRegistration={(initial) => {
          setIsCustomerSelectorOpen(false);
          setRegistrationInitialData(initial || null);
          setSelectorTargetField('responsible');
          setIsRegistrationFullScreenOpen(true);
        }}
      />

      {/* TELA CHEIA DE CADASTRO DE CLIENTE SE NÃO TIVER CPF/LOCAL */}
      <CustomerFormFullScreen
        isOpen={isRegistrationFullScreenOpen}
        onClose={() => setIsRegistrationFullScreenOpen(false)}
        onSaveCustomer={handleSaveCustomerFromRegistration}
        initialData={registrationInitialData}
        targetFieldTitle={selectorTargetField === 'client' ? 'Cliente' : 'Vendedor (Responsável)'}
      />

      {/* MODAL DE SELEÇÃO DE LOCAL NO MAPA EM TELA CHEIA COM BUSCA E CONFIRMAÇÃO */}
      {mapPickerTarget && (
        <MapLocationPickerModal
          isOpen={Boolean(mapPickerTarget)}
          onClose={() => setMapPickerTarget(null)}
          targetType={mapPickerTarget}
          initialAddress={
            mapPickerTarget === 'coleta'
              ? pickupAddress
              : mapPickerTarget === 'entrega'
              ? deliveryAddress
              : mapPickerTarget === 'troca'
              ? exchangeAddress
              : selectedCustomer?.address || ''
          }
          initialCoords={
            mapPickerTarget === 'coleta'
              ? pickupCoords
              : mapPickerTarget === 'entrega'
              ? deliveryCoords
              : mapPickerTarget === 'troca'
              ? exchangeCoords
              : selectedCustomer?.coordinates || DEFAULT_PICKUP_COORDS
          }
          onConfirm={async ({ address, coordinates }) => {
            if (mapPickerTarget === 'cliente') {
              if (selectedCustomer) {
                let city = resolveCustomerCity({ address });
                if (!city) {
                  try {
                    city = resolveCustomerCity(await reverseGeocode(coordinates));
                  } catch {}
                }
                city = city || normalizeCityName(selectedCustomer.city || selectedCustomer.cidade);
                const updatedCust: Customer = {
                  ...selectedCustomer,
                  address,
                  coordinates,
                  ...(city ? { city, cidade: city } : {})
                };
                const saved = await updateCustomer(selectedCustomer.id, updatedCust);
                if (!saved) {
                  window.alert('Não foi possível salvar o endereço do cliente. Verifique a conexão e tente novamente.');
                  return;
                }
                setSelectedCustomer(updatedCust);
                if (operationType === 'coleta') {
                  setDeliveryAddress(address);
                  setDeliveryCoords(coordinates);
                  setDeliveryContact(selectedCustomer.fullName);
                  setDeliveryPhone(selectedCustomer.phone);
                } else if (operationType === 'entrega') {
                  setPickupAddress(address);
                  setPickupCoords(coordinates);
                  setPickupContact(selectedCustomer.fullName);
                  setPickupPhone(selectedCustomer.phone);
                } else if (operationType === 'troca') {
                  setPickupAddress(address);
                  setPickupCoords(coordinates);
                  setDeliveryAddress(address);
                  setDeliveryCoords(coordinates);
                  setPickupContact(selectedCustomer.fullName);
                  setDeliveryContact(selectedCustomer.fullName);
                }
              }
            } else if (mapPickerTarget === 'coleta') {
              setPickupAddress(address);
              setPickupCoords(coordinates);
              setStepErrors(prev => {
                const next = { ...prev };
                delete next.pickupAddress;
                return next;
              });
            } else if (mapPickerTarget === 'entrega') {
              setDeliveryAddress(address);
              setDeliveryCoords(coordinates);
              setStepErrors(prev => {
                const next = { ...prev };
                delete next.deliveryAddress;
                return next;
              });
            } else if (mapPickerTarget === 'troca') {
              setExchangeAddress(address);
              setExchangeCoords(coordinates);
              setStepErrors(prev => {
                const next = { ...prev };
                delete next.exchangeAddress;
                return next;
              });
            }
            setMapPickerTarget(null);
          }}
        />
      )}

      {/* AGENDA DE CONTATOS DO TELEFONE / SIMULADOR PARA APK */}
      <PhoneAgendaModal
        isOpen={isPhoneAgendaOpen}
        onClose={() => setIsPhoneAgendaOpen(false)}
        targetType={phoneAgendaTarget}
        targetRoleLabel={
          phoneAgendaTarget === 'coleta'
            ? 'Coleta'
            : phoneAgendaTarget === 'troca'
            ? 'Troca'
            : 'Entrega'
        }
        onSelectContact={handleSelectPhoneAgendaContact}
      />
      <SellerResponsibleModal
        isOpen={sellerEditPoint !== null}
        onClose={() => setSellerEditPoint(null)}
        initialName={sellerEditPoint ? routePointConfigs[sellerEditPoint].sellerName : ''}
        initialPhone={sellerEditPoint ? routePointConfigs[sellerEditPoint].sellerPhone : ''}
        clientName={selectedCustomer?.fullName}
        clientPhone={selectedCustomer?.phone}
        onSave={data => {
          if (sellerEditPoint) {
            updateRoutePointConfig(sellerEditPoint, {
              sellerName: data.name,
              sellerPhone: data.phone
            });
          }
        }}
      />
    </div>);
};
