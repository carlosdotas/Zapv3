import React from 'react';
import { X, User, UserCheck, Clock, Calendar, Check, ArrowDownToLine, Package, Repeat, Camera, RefreshCw, CheckCircle2, AlertCircle, Image as ImageIcon, Zap, ZapOff, Sun, Share2, FileText, Minus, Plus, Layers, Navigation, ChevronDown, Bike, Car, Truck, Maximize2, Ban, AlertTriangle, Edit3, DollarSign, Globe, Lock, Route, MapPin, Menu, Loader2 } from 'lucide-react';
import { OrderFinalDetailsModal } from '../order/OrderFinalDetailsModal';
import { isStreetOrAddress } from '../../utils/placeUtils';
import { realtimeAssignmentService } from '../../services/realtimeAssignmentService';
import { canClaimOrders } from '../../utils/canClaimOrders';
import { GoogleMapsIcon, WazeIcon } from '../map/NavAppIcons';
import { PackageItemType } from '../../types/map';
import { CustomerSelectorDrawer } from '../customer/CustomerSelectorDrawer';
import { CustomerFormFullScreen } from '../customer/CustomerFormFullScreen';
import { SellerResponsibleModal } from './SellerResponsibleModal';
import { DriverSelectorModal } from '../driver/DriverSelectorModal';
import { formatPhotoUrl } from '../../services/apiAdapters';
import { formatDistance, ArrivalInfo } from './placeDetailHelpers';
import { usePlaceDetailCard } from './usePlaceDetailCard';
export { formatPhoneDisplay, getClosingTime, getOpeningTime, getTimeUntilClosing } from './placeDetailHelpers';
export type { TimeUntilClosing } from './placeDetailHelpers';


export const PlaceDetailCard: React.FC = () => {
  const model = usePlaceDetailCard();
  if (!model) return null;
  const { saveSuccessToast, driverToast, setSaveSuccessToast, setDriverToast, galleryInputRef, handleGalleryFileSelected, cardRef, transformStyle, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, isNewOrderDraft, canEdit, handleLockedEditAttempt, setShowOperationPicker, setShowSchedulePicker, setShowVehiclePicker, setShowPackagePicker, operationType, showOperationPicker, handleApplyOperationType, placeDateBadge, showSchedulePicker, updatePlaceDetails, selectedPlace, scheduleCalendarInputRef, vehicleConfig, VehicleIcon, showVehiclePicker, vehicleType, packageConfig, PackageIcon, showPackagePicker, allAvailablePackageTypes, newCustomPackageInput, setNewCustomPackageInput, handleAddCustomPackageType, setShowCustomCargoDetails, showCustomCargoDetails, dimLength, setDimLength, dimWidth, dimHeight, setDimWidth, setDimHeight, isAlreadySaved, isEditingOrder, isDriverRole, setIsEditingOrder, triggerClose, contentScrollRef, registeredOutcome, operationConfig, openFullScreenCamera, firstPhoto, openPhotoViewer, placeNameInputRef, draftPlaceName, placeNameDraftRef, setDraftPlaceName, showPlaceNameError, isPlaceNameInvalid, distanceFormatted, closingTime, openingTime, isOpen, timeUntilClose, hasCustomerRoute, handleOpenCustomerSelector, customerName, setRouteSellerTarget, setIsSellerModalOpen, responsibleName, setRouteDriverTarget, setIsDriverSelectorOpen, selectedDriverName, hasCustomer, handleWhatsApp, customerPhone, renderViewRoutePointActions, activeRoutePoint, showCounterpartButton, setIsCounterpartPickerOpen, counterpartLabel, isCounterpartPickerOpen, counterpartQuery, setCounterpartQuery, counterpartResults, applyCounterpartLocation, activeRoute, orderResolvedLocations, renderRoutePointDetails, renderDraftRoutePointActions, clearActiveRoute, canManageDriverAssignment, handleSetVisibilityPublic, handleSetVisibilityPrivate, assignedVehicleEmoji, assignedDriverDisplayName, assignedDriverSubtitle, handleRemoveDriverFromPlace, setShowRefusalModal, draftObservationRef, draftOrderComment, draftObservationEditedRef, setDraftOrderComment, setSelectedPlace, showNavChooser, setShowNavChooser, executeDirectNavigation, saveAsDefaultNav, defaultNavApp, setSaveAsDefaultNav, setDefaultNavApp, isActionsMenuOpen, setIsActionsMenuOpen, setOperationStatus, setIsFinalDetailsOpen, setRefusalReason, setRefusalNotes, handleShareLocation, sharedToast, currentRole, isClaimingOrder, handleClaimThisOrder, handleSavePlaceOrder, isSavingOrder, handleStartNavigation, nativeCameraInputRef, isFullScreenCameraOpen, isFlashing, closeFullScreenCamera, operationStatus, setFlashMode, flashMode, handleFlipCamera, setShowFailReasonPicker, failReason, showFailReasonPicker, setFailReason, handleUpdateVolumeQuantity, volumeQuantity, setShowObservationSheet, notes, receiverName, handleViewfinderTap, cameraError, isFinalizingPhoto, handleFinalizeRegistration, videoRef, zoomLevel, focusPoint, setZoomLevel, showObservationSheet, setReceiverName, setNotes, photoErrorMsg, customPhotos, handleDeletePhoto, handleTakeShutterPhoto, showOperationModal, OperationIcon, setShowOperationModal, setPhotoErrorMsg, setSelectedPackage, selectedPackage, volumesCount, volumeQuantityInput, handleVolumeInputChange, handleVolumeInputBlur, handleSaveOperation, farWarning, setFarWarning, showRefusalModal, isSubmittingRefusal, refusalReason, refusalNotes, handleConfirmRefusal, isSellerModalOpen, routeSellerTarget, getRouteSeller, responsiblePhone, handleSaveSellerResponsible, isCustomerSelectorOpen, setIsCustomerSelectorOpen, selectorTargetField, handleSelectCustomer, handleOpenRegistrationFromDrawer, isCustomerRegistrationOpen, setIsCustomerRegistrationOpen, handleSaveCustomerFromRegistration, registrationInitialData, isDriverSelectorOpen, routeDriverTarget, handleSelectDriverForRoutePoint, handleSelectDriverForPlace, handleRemoveDriverFromRoutePoint, drivers, getRouteDriver, handleDraftVisibilityChange, isFinalDetailsOpen } = model;
  return (<>
      {(saveSuccessToast || driverToast) && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[150] flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto inline-flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate">{saveSuccessToast || driverToast}</span>
            <button
              type="button"
              onClick={() => {
                setSaveSuccessToast(null);
                setDriverToast(null);
              }}
              className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar informação"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* INPUT INVISÍVEL PARA ESCOLHER FOTO DA GALERIA */}
      <input 
        type="file" 
        ref={galleryInputRef} 
        accept="image/*" 
        onChange={handleGalleryFileSelected} 
        className="hidden" 
      />

      {/* ========================================================
          CARD PRINCIPAL ESTILO GOOGLE MAPS
          ======================================================== */}
      <aside 
        aria-label="Detalhes do local selecionado"
        className="fixed inset-x-0 bottom-0 sm:bottom-4 sm:inset-x-auto sm:right-5 sm:w-[450px] md:w-[470px] z-40 pointer-events-none flex justify-center select-none"
      >
        <div 
          ref={cardRef}
          style={transformStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="pointer-events-auto w-full max-w-lg sm:max-w-none bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] will-change-transform"
        >
          
          {/* PUXADOR GOOGLE MAPS */}
          <div 
            onMouseDown={handleMouseDown}
            className="w-full pt-2 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0 bg-white hover:bg-slate-50 transition-colors"
            title="Arraste para baixo para fechar"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full transition-all group-hover:bg-slate-400" />
          </div>

          {/* HEADER SUPERIOR: BOTÕES INTERATIVOS PARA ALTERAR (TIPO, AGENDA, VEÍCULO, CARGA) + BOTÃO FECHAR */}
          <div className="px-3.5 pt-1.5 pb-1.5 flex items-center justify-between shrink-0 bg-white border-b border-slate-100 relative">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              
              {/* 1. Botão da Operação (Coleta / Entrega / Troca) */}
              <div className="relative">
                <button
                  type="button"
                  disabled={isNewOrderDraft || !canEdit}
                  onClick={() => {
                    if (!canEdit) {
                      handleLockedEditAttempt();
                      return;
                    }
                    setShowOperationPicker(prev => !prev);
                    setShowSchedulePicker(false);
                    setShowVehiclePicker(false);
                    setShowPackagePicker(false);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-2xs shrink-0 transition-all active:scale-95 cursor-pointer hover:brightness-110 ${
                    operationType === 'coleta'
                      ? 'bg-[#0B5187]'
                      : operationType === 'troca'
                      ? 'bg-[#7C3AED]'
                      : 'bg-[#FF5E00]'
                  }`}
                  title={canEdit ? "Alterar Tipo da Encomenda" : "Tipo da Encomenda (Clique em Editar para alterar)"}
                >
                  {operationType === 'coleta' && <ArrowDownToLine className="w-3 h-3 stroke-[2.8]" />}
                  {operationType === 'entrega' && <Package className="w-3 h-3 stroke-[2.8]" />}
                  {operationType === 'troca' && <Repeat className="w-3 h-3 stroke-[2.8]" />}
                  <span>{operationType === 'coleta' ? 'Coleta' : operationType === 'troca' ? 'Troca' : 'Entrega'}</span>
                  {canEdit && <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />}
                </button>

                {showOperationPicker && (
                  <div className="absolute top-8 left-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 w-48 space-y-1 animate-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase px-2 py-0.5">
                      Alterar Tipo
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyOperationType('coleta')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${operationType === 'coleta' ? 'bg-blue-50 text-[#0B5187]' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0B5187]" />
                      <span>Coleta (Azul)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyOperationType('entrega')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${operationType === 'entrega' ? 'bg-orange-50 text-[#FF5E00]' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF5E00]" />
                      <span>Entrega (Laranja)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyOperationType('troca')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${operationType === 'troca' ? 'bg-purple-50 text-[#7C3AED]' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
                      <span>Troca (Roxo)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Botão de Data / Agenda da Encomenda */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) {
                      handleLockedEditAttempt();
                      return;
                    }
                    setShowSchedulePicker(prev => !prev);
                    setShowOperationPicker(false);
                    setShowVehiclePicker(false);
                    setShowPackagePicker(false);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-white shadow-2xs shrink-0 transition-all active:scale-95 cursor-pointer hover:brightness-110 ${
                    placeDateBadge.type === 'hoje'
                      ? 'bg-emerald-600'
                      : placeDateBadge.type === 'amanha'
                      ? 'bg-sky-600'
                      : placeDateBadge.type === 'ontem'
                      ? 'bg-blue-600'
                      : placeDateBadge.type === '2_dias_atras'
                      ? 'bg-amber-600'
                      : 'bg-indigo-600'
                  }`}
                  title={canEdit ? "Alterar Data e Horário da Agenda" : "Data da Agenda (Clique em Editar para alterar)"}
                >
                  <Clock className="w-3 h-3 stroke-[2.8]" />
                  <span>{placeDateBadge.label}</span>
                  {canEdit && <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />}
                </button>

                {showSchedulePicker && (
                  <div className="absolute top-8 left-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 w-72 space-y-2.5 animate-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                        Agendamento da Encomenda
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSchedulePicker(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {/* Opções de Data: Hoje, Amanhã e Botão para Abrir Calendário */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* 1. Botão HOJE */}
                      <button
                        type="button"
                        onClick={() => {
                          updatePlaceDetails(selectedPlace.id, { 
                            orderDateBadge: 'hoje', 
                            scheduledDate: undefined 
                          });
                          setShowSchedulePicker(false);
                        }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                          (!selectedPlace.scheduledDate && placeDateBadge.type === 'hoje') || selectedPlace.scheduledDate === new Date().toISOString().slice(0, 10)
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${((!selectedPlace.scheduledDate && placeDateBadge.type === 'hoje') || selectedPlace.scheduledDate === new Date().toISOString().slice(0, 10)) ? 'bg-white' : 'bg-emerald-500'}`} />
                          <span>Hoje</span>
                        </div>
                        <span className={`text-[9.5px] font-bold ${((!selectedPlace.scheduledDate && placeDateBadge.type === 'hoje') || selectedPlace.scheduledDate === new Date().toISOString().slice(0, 10)) ? 'text-white/80' : 'text-slate-400'}`}>
                          {new Date().getDate().toString().padStart(2, '0')}/{(new Date().getMonth() + 1).toString().padStart(2, '0')}
                        </span>
                      </button>

                      {/* 2. Botão AMANHÃ */}
                      <button
                        type="button"
                        onClick={() => {
                          const tom = new Date();
                          tom.setDate(tom.getDate() + 1);
                          const tomStr = tom.toISOString().slice(0, 10);
                          updatePlaceDetails(selectedPlace.id, { 
                            orderDateBadge: 'amanha', 
                            scheduledDate: tomStr 
                          });
                          setShowSchedulePicker(false);
                        }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                          (() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            const tomStr = tom.toISOString().slice(0, 10);
                            return placeDateBadge.type === 'amanha' || selectedPlace.scheduledDate === tomStr;
                          })()
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${(() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            const tomStr = tom.toISOString().slice(0, 10);
                            return placeDateBadge.type === 'amanha' || selectedPlace.scheduledDate === tomStr;
                          })() ? 'bg-white' : 'bg-sky-500'}`} />
                          <span>Amanhã</span>
                        </div>
                        <span className={`text-[9.5px] font-bold ${(() => {
                          const tom = new Date();
                          tom.setDate(tom.getDate() + 1);
                          const tomStr = tom.toISOString().slice(0, 10);
                          return placeDateBadge.type === 'amanha' || selectedPlace.scheduledDate === tomStr;
                        })() ? 'text-white/80' : 'text-slate-400'}`}>
                          {(() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            return `${tom.getDate().toString().padStart(2, '0')}/${(tom.getMonth() + 1).toString().padStart(2, '0')}`;
                          })()}
                        </span>
                      </button>

                      {/* 3. Botão para Abrir Calendário para Escolher um Dia */}
                      <button
                        type="button"
                        onClick={() => {
                          if (scheduleCalendarInputRef.current) {
                            try {
                              if ('showPicker' in HTMLInputElement.prototype) {
                                scheduleCalendarInputRef.current.showPicker();
                              } else {
                                scheduleCalendarInputRef.current.click();
                              }
                            } catch {
                              scheduleCalendarInputRef.current.click();
                            }
                          }
                        }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                          Boolean(selectedPlace.scheduledDate && selectedPlace.scheduledDate !== new Date().toISOString().slice(0, 10) && (() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            return selectedPlace.scheduledDate !== tom.toISOString().slice(0, 10);
                          })())
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                        title="Abrir calendário para escolher um dia"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <Calendar className={`w-3 h-3 shrink-0 ${Boolean(selectedPlace.scheduledDate && selectedPlace.scheduledDate !== new Date().toISOString().slice(0, 10)) ? 'text-white' : 'text-indigo-600'}`} />
                          <span className="truncate">
                            {Boolean(selectedPlace.scheduledDate && selectedPlace.scheduledDate !== new Date().toISOString().slice(0, 10) && (() => {
                              const tom = new Date();
                              tom.setDate(tom.getDate() + 1);
                              return selectedPlace.scheduledDate !== tom.toISOString().slice(0, 10);
                            })()) ? (() => {
                              const p = selectedPlace.scheduledDate!.split('-');
                              return p.length === 3 ? `${p[2]}/${p[1]}` : selectedPlace.scheduledDate;
                            })() : 'Calendário'}
                          </span>
                        </div>
                        <span className={`text-[9.5px] font-bold ${Boolean(selectedPlace.scheduledDate && selectedPlace.scheduledDate !== new Date().toISOString().slice(0, 10)) ? 'text-white/80' : 'text-slate-400'}`}>
                          {Boolean(selectedPlace.scheduledDate && selectedPlace.scheduledDate !== new Date().toISOString().slice(0, 10) && (() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            return selectedPlace.scheduledDate !== tom.toISOString().slice(0, 10);
                          })()) ? 'Data fixada' : 'Escolher dia'}
                        </span>
                      </button>
                    </div>

                    {/* Input nativo de calendário oculto acionado via showPicker() do botão (sem input visível na tela) */}
                    <input
                      ref={scheduleCalendarInputRef}
                      type="date"
                      aria-label="Escolher data no calendário"
                      value={selectedPlace.scheduledDate || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const today = new Date().toISOString().slice(0, 10);
                          const tom = new Date();
                          tom.setDate(tom.getDate() + 1);
                          const tomStr = tom.toISOString().slice(0, 10);

                          if (val === today) {
                            updatePlaceDetails(selectedPlace.id, { 
                              orderDateBadge: 'hoje', 
                              scheduledDate: undefined 
                            });
                          } else if (val === tomStr) {
                            updatePlaceDetails(selectedPlace.id, { 
                              orderDateBadge: 'amanha', 
                              scheduledDate: tomStr 
                            });
                          } else {
                            updatePlaceDetails(selectedPlace.id, { 
                              orderDateBadge: 'custom', 
                              scheduledDate: val 
                            });
                          }
                          setShowSchedulePicker(false);
                        }
                      }}
                      className="sr-only opacity-0 absolute pointer-events-none"
                      tabIndex={-1}
                    />

                    {/* Horário previsto e modo */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Horário Previsto</label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedPlace.scheduledTimeMode || 'ate'}
                          onChange={(e) => updatePlaceDetails(selectedPlace.id, { scheduledTimeMode: e.target.value as any })}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 font-bold text-slate-800"
                        >
                          <option value="ate">Até às</option>
                          <option value="partir">Após</option>
                        </select>
                        <input
                          type="time"
                          value={selectedPlace.scheduledTime || ''}
                          onChange={(e) => updatePlaceDetails(selectedPlace.id, { scheduledTime: e.target.value })}
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Botão do Tipo de Veículo */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) {
                      handleLockedEditAttempt();
                      return;
                    }
                    setShowVehiclePicker(prev => !prev);
                    setShowOperationPicker(false);
                    setShowSchedulePicker(false);
                    setShowPackagePicker(false);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border shadow-2xs shrink-0 transition-all active:scale-95 cursor-pointer hover:brightness-105 ${vehicleConfig.bg}`}
                  title={canEdit ? `Veículo: ${vehicleConfig.label} - Clique para alterar` : `Veículo: ${vehicleConfig.label} (Clique em Editar para alterar)`}
                >
                  <VehicleIcon className="w-3 h-3 stroke-[2.5]" />
                  <span>{vehicleConfig.label}</span>
                  {canEdit && <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />}
                </button>

                {showVehiclePicker && (
                  <div className="absolute top-8 left-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 w-44 space-y-1 animate-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase px-2 py-0.5">
                      Alterar Veículo
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlaceDetails(selectedPlace.id, { vehicleType: 'moto' });
                        setShowVehiclePicker(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${vehicleType === 'moto' ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <Bike className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Moto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlaceDetails(selectedPlace.id, { vehicleType: 'carro' });
                        setShowVehiclePicker(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${vehicleType === 'carro' ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <Car className="w-3.5 h-3.5 text-blue-600" />
                      <span>Carro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlaceDetails(selectedPlace.id, { vehicleType: 'utilitario' });
                        setShowVehiclePicker(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${vehicleType === 'utilitario' ? 'bg-amber-50 text-amber-950' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <Truck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Utilitário</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Botão do Tipo de Encomenda / Carga & Medidas/Volumes */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) {
                      handleLockedEditAttempt();
                      return;
                    }
                    setShowPackagePicker(prev => !prev);
                    setShowOperationPicker(false);
                    setShowSchedulePicker(false);
                    setShowVehiclePicker(false);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border shadow-2xs shrink-0 transition-all active:scale-95 cursor-pointer hover:brightness-105 ${packageConfig.bg}`}
                  title={canEdit ? `Encomenda: ${packageConfig.label} - Clique para alterar tipo, volumes e medidas` : `Encomenda: ${packageConfig.label} (Clique em Editar para alterar)`}
                >
                  <PackageIcon className="w-3 h-3 stroke-[2.5]" />
                  <span>
                    {packageConfig.label}
                    {selectedPlace.volumesCount && selectedPlace.volumesCount > 1 ? ` (${selectedPlace.volumesCount} vol)` : ''}
                    {selectedPlace.isFragile ? ' ⚠️' : ''}
                  </span>
                  {canEdit && <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />}
                </button>
              </div>

      {/* MODAL CENTRALIZADO E AMPLO: TIPO DE ENCOMENDA & CARGA */}
      {showPackagePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 pointer-events-auto">
          <div className="w-full max-w-lg sm:max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-150">
            
            {/* Cabeçalho */}
            <div className="bg-[#0B5187] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <Package className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black tracking-tight leading-tight">
                    Tipo de Encomenda & Carga
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium truncate">
                    Selecione o tipo, adicione novos ou personalize medidas e volumes
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPackagePicker(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 divide-y divide-slate-100 overscroll-contain text-left">
              
              {/* 1. LISTA COM VÁRIOS TIPOS DE ENCOMENDA (COM SCROLL SUAVE) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    Tipos Disponíveis ({allAvailablePackageTypes.length})
                  </label>
                  <span className="text-[11px] font-black text-[#0B5187] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    Selecionado: {packageConfig.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 sm:max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {allAvailablePackageTypes.map(item => {
                    const isSelected = selectedPlace.packageType?.toLowerCase() === item.key.toLowerCase() ||
                                       selectedPlace.packageType?.toLowerCase() === item.label.toLowerCase();
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          updatePlaceDetails(selectedPlace.id, { packageType: item.label as any });
                        }}
                        className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-between gap-1.5 text-left active:scale-95 ${
                          isSelected
                            ? 'bg-[#0B5187] text-white border-[#0B5187] shadow-sm font-black ring-2 ring-[#0B5187]/20'
                            : 'bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 stroke-[3] text-emerald-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. EM BAIXO: O ADD (ADICIONAR NOVO TIPO) */}
              <div className="pt-3 space-y-2">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#FF5E00]" />
                  <span>Adicionar Novo Tipo de Encomenda</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCustomPackageInput}
                    onChange={(e) => setNewCustomPackageInput(e.target.value)}
                    placeholder="Digite o nome (ex: Bolo, Tortas, Joias, Eletrônicos...)"
                    className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0B5187] focus:ring-2 focus:ring-[#0B5187]/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCustomPackageInput.trim()) {
                        e.preventDefault();
                        handleAddCustomPackageType();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomPackageType}
                    disabled={!newCustomPackageInput.trim()}
                    className="px-4 py-2.5 bg-[#FF5E00] hover:bg-[#E05300] disabled:opacity-40 text-white text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* 3. MAIS EM BAIXO: O BOTÃO PERSONALIZADO QUE ABRE OS OUTROS DETALHES */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setShowCustomCargoDetails(prev => !prev)}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer select-none active:scale-95 ${
                    showCustomCargoDetails || Boolean(
                      (selectedPlace.volumesCount && selectedPlace.volumesCount > 1) ||
                      selectedPlace.dimensions ||
                      selectedPlace.weightKg ||
                      selectedPlace.isFragile
                    )
                      ? 'bg-blue-50/80 border-[#0B5187]/40 text-[#0B5187] shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      showCustomCargoDetails || Boolean(
                        (selectedPlace.volumesCount && selectedPlace.volumesCount > 1) ||
                        selectedPlace.dimensions ||
                        selectedPlace.weightKg ||
                        selectedPlace.isFragile
                      ) ? 'bg-[#0B5187] text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-black block leading-tight">
                        Personalizado (Outros Detalhes de Carga)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block truncate mt-0.5">
                        {Boolean(
                          (selectedPlace.volumesCount && selectedPlace.volumesCount > 1) ||
                          selectedPlace.dimensions ||
                          selectedPlace.weightKg ||
                          selectedPlace.isFragile
                        )
                          ? `${selectedPlace.volumesCount ? `${selectedPlace.volumesCount} vol` : ''}${selectedPlace.weightKg ? ` • ${selectedPlace.weightKg}kg` : ''}${selectedPlace.dimensions ? ` • ${selectedPlace.dimensions}` : ''}${selectedPlace.isFragile ? ' • ⚠️ Frágil' : ''}`
                          : 'Toque para abrir medidas, volumes, peso e frágil'
                        }
                      </span>
                    </div>
                  </div>
                  
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${showCustomCargoDetails ? 'rotate-180 text-[#0B5187]' : ''}`} />
                </button>

                {/* CONTEÚDO DOS OUTROS DETALHES (ABERTO PELO BOTÃO PERSONALIZADO) */}
                {showCustomCargoDetails && (
                  <div className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3 animate-in fade-in duration-150">
                    {/* Quantidade de Volumes */}
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <label className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">Quantidade de Volumes</label>
                        <span className="text-[11px] text-slate-400">Total de pacotes neste local</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const current = selectedPlace.volumesCount || 1;
                            const next = Math.max(1, current - 1);
                            updatePlaceDetails(selectedPlace.id, { volumesCount: next });
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          -
                        </button>
                        <span className="font-mono text-sm sm:text-base font-black text-slate-900 w-10 text-center">
                          {selectedPlace.volumesCount || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = selectedPlace.volumesCount || 1;
                            const next = Math.min(999, current + 1);
                            updatePlaceDetails(selectedPlace.id, { volumesCount: next });
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Dimensões / Medidas (Comprimento x Largura x Altura) */}
                    <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200">
                      <label className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Medidas em Centímetros (Comp x Larg x Alt)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Comprimento</span>
                          <input
                            type="text"
                            placeholder="Ex: 30"
                            value={dimLength}
                            onChange={(e) => {
                              setDimLength(e.target.value);
                              const combined = (e.target.value || dimWidth || dimHeight) ? `${e.target.value || '0'}x${dimWidth || '0'}x${dimHeight || '0'} cm` : '';
                              updatePlaceDetails(selectedPlace.id, { dimensions: combined });
                            }}
                            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-center focus:outline-none focus:bg-white focus:border-[#0B5187]"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Largura</span>
                          <input
                            type="text"
                            placeholder="Ex: 20"
                            value={dimWidth}
                            onChange={(e) => {
                              setDimWidth(e.target.value);
                              const combined = (dimLength || e.target.value || dimHeight) ? `${dimLength || '0'}x${e.target.value || '0'}x${dimHeight || '0'} cm` : '';
                              updatePlaceDetails(selectedPlace.id, { dimensions: combined });
                            }}
                            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-center focus:outline-none focus:bg-white focus:border-[#0B5187]"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Altura</span>
                          <input
                            type="text"
                            placeholder="Ex: 15"
                            value={dimHeight}
                            onChange={(e) => {
                              setDimHeight(e.target.value);
                              const combined = (dimLength || dimWidth || e.target.value) ? `${dimLength || '0'}x${dimWidth || '0'}x${e.target.value || '0'} cm` : '';
                              updatePlaceDetails(selectedPlace.id, { dimensions: combined });
                            }}
                            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-center focus:outline-none focus:bg-white focus:border-[#0B5187]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Peso em KG */}
                    <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                      <label className="text-[11px] font-black text-slate-600 uppercase">
                        Peso Estimado (kg)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 2.5 kg"
                        value={selectedPlace.weightKg || ''}
                        onChange={(e) => updatePlaceDetails(selectedPlace.id, { weightKg: e.target.value })}
                        className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-[#0B5187]"
                      />
                    </div>

                    {/* Checkbox Carga Frágil */}
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedPlace.isFragile)}
                        onChange={(e) => updatePlaceDetails(selectedPlace.id, { isFragile: e.target.checked })}
                        className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                      />
                      <div className="text-left">
                        <span className="text-xs sm:text-sm font-black text-amber-950 block">⚠️ Carga Frágil</span>
                        <span className="text-[11px] text-amber-800">Manusear com cuidado especial durante o transporte</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

            </div>

            {/* Rodapé fixo com Botão Concluir */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowPackagePicker(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Concluir Seleção</span>
              </button>
            </div>

          </div>
        </div>
      )}

            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {isAlreadySaved && !isEditingOrder && !isDriverRole && (
                <button
                  type="button"
                  onClick={() => setIsEditingOrder(true)}
                  className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-[#0B5187] border border-blue-200 text-[11px] font-black inline-flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title="Editar dados deste pedido"
                >
                  <Edit3 className="w-3 h-3 stroke-[2.5]" />
                  <span>Editar</span>
                </button>
              )}
              <button
                onClick={triggerClose}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors active:scale-90 shrink-0 cursor-pointer"
                title="Fechar"
                aria-label="Fechar diálogo"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* DADOS DO LOCAL (NOME DO LOCAL, HORÁRIO QUE FECHA, CLIENTE, RESPONSÁVEL) */}
          <div 
            ref={contentScrollRef}
            className="p-3 sm:p-3.5 overflow-y-auto flex-1 flex flex-col gap-2.5"
          >
            {/* Status registrado */}
            {registeredOutcome && (
              <div className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold animate-in fade-in duration-150 ${
                registeredOutcome.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-1.5">
                  {registeredOutcome.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  )}
                  <span>
                    {registeredOutcome.status === 'success' 
                      ? `${operationConfig.label} registrada às ${registeredOutcome.time}!` 
                      : `Insucesso registrado às ${registeredOutcome.time}`}
                  </span>
                </div>
                <button 
                  onClick={() => openFullScreenCamera()}
                  className="underline text-[10px] hover:opacity-80"
                >
                  Alterar
                </button>
              </div>
            )}

            {/* Nome do Local, Endereço, Foto da Encomenda & Distância */}
            <div 
              onClick={() => {
                if (!isEditingOrder && canEdit) {
                  setIsEditingOrder(true);
                }
              }}
              className={`flex items-start gap-3 p-1 rounded-2xl transition-all ${
                !isEditingOrder && canEdit 
                  ? 'cursor-pointer hover:bg-slate-50/80 hover:ring-1 hover:ring-blue-200' 
                  : isEditingOrder 
                  ? 'bg-red-50/40 border border-red-200 p-2 rounded-2xl' 
                  : ''
              }`}
              title={!isEditingOrder && canEdit ? "Toque nesta área para editar os dados deste pedido" : undefined}
            >
              {/* Foto da Encomenda (Proporcional à altura das linhas de título, endereço e status) */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (firstPhoto) {
                    openPhotoViewer(formatPhotoUrl(firstPhoto, 'lg') || firstPhoto, selectedPlace);
                  } else {
                    openFullScreenCamera();
                  }
                }}
                className={`relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] rounded-2xl overflow-hidden border-2 shadow-xs cursor-pointer group shrink-0 transition-all active:scale-95 flex items-center justify-center ${
                  firstPhoto 
                    ? 'border-slate-200 hover:border-[#0B5187] hover:shadow-md bg-slate-900' 
                    : 'border-dashed border-slate-300 hover:border-[#FF5E00] bg-slate-50 hover:bg-orange-50/50'
                }`}
                title={firstPhoto ? "Toque para abrir a foto grande na tela" : "Toque para fotografar ou escolher foto"}
              >
                {firstPhoto ? (
                  <>
                    <img 
                      src={firstPhoto} 
                      alt="Foto da encomenda indisponível"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Maximize2 className="w-5 h-5 drop-shadow-md" />
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full leading-none shadow-xs">
                      Foto 1
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-[#FF5E00] transition-colors p-1 text-center">
                    <Camera className="w-6 h-6 stroke-[2.2]" />
                    <span className="text-[10px] font-black mt-1 leading-none">+ Foto</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                    {isNewOrderDraft && canEdit ? (
                      <input
                        aria-label="Nome do local"
                        ref={placeNameInputRef}
                        value={draftPlaceName}
                        onChange={event => {
                          if (placeNameDraftRef.current) placeNameDraftRef.current.edited = true;
                          setDraftPlaceName(event.target.value);
                        }}
                        onClick={event => event.stopPropagation()}
                        aria-required="true"
                        aria-invalid={showPlaceNameError && isPlaceNameInvalid}
                        aria-describedby={showPlaceNameError && isPlaceNameInvalid ? 'place-name-error' : undefined}
                        placeholder={selectedPlace.isResolvingAddress ? 'Buscando nome do local...' : 'Nome do local (obrigatório)'}
                        className={`w-full min-w-0 rounded-lg border ${showPlaceNameError && isPlaceNameInvalid ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-300'} bg-white px-2 py-1 text-lg font-black tracking-tight text-slate-900 outline-none focus:border-[#0B5187] focus:ring-2 focus:ring-blue-100 sm:text-xl`}
                      />
                    ) : (
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                        {selectedPlace.name}
                      </h2>
                    )}
                  </div>

                  {!isNewOrderDraft && distanceFormatted && (
                    <div 
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200 text-[#0B5187] shadow-2xs"
                      title={`Distância até o local: ${distanceFormatted}`}
                    >
                      <Navigation className="w-3.5 h-3.5 fill-[#0B5187]/20 text-[#0B5187] stroke-[2.4]" />
                      <span className="text-xs sm:text-[13px] font-black">{distanceFormatted}</span>
                    </div>
                  )}
                </div>

                {isNewOrderDraft && showPlaceNameError && isPlaceNameInvalid && (
                  <p id="place-name-error" role="alert" className="mt-1 text-xs font-bold text-red-600">
                    Informe o nome do local para salvar o pedido.
                  </p>
                )}

                {/* Endereço do local */}
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5" title={selectedPlace.address}>
                  {selectedPlace.address}
                </p>

                {isDriverRole && <ArrivalInfo placeId={selectedPlace.id} />}

              <div className="flex flex-wrap items-center gap-x-2">
              {isStreetOrAddress(selectedPlace) ? (
                <div className="mt-1.5 flex items-center gap-2 text-xs sm:text-sm font-medium flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[#0B5187] bg-blue-50 border border-blue-200/90 px-2 py-0.5 rounded-lg font-bold text-[11px] sm:text-xs shadow-2xs">
                    <MapPin className="w-3.5 h-3.5 text-[#0B5187] stroke-[2.2]" />
                    <span>Via pública / Endereço</span>
                  </span>
                  <span className="text-slate-500 text-[11px] sm:text-xs flex items-center gap-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Acesso livre 24h
                  </span>
                </div>
              ) : (closingTime || openingTime) ? (
                <div className="mt-1.5 flex items-center gap-2 text-xs sm:text-sm font-semibold flex-wrap">
                  {isOpen ? (
                    <>
                      <span className="text-emerald-700 flex items-center gap-1.5 font-bold shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Aberto
                      </span>
                      {closingTime && (
                        <>
                          <span className="text-slate-400 font-bold">⋅</span>
                          <span className="text-slate-700 flex items-center gap-1.5 font-medium flex-wrap">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="font-bold">Fecha às {closingTime}</span>
                            {timeUntilClose && timeUntilClose.text !== 'fechado' && (
                              <span
                                className={`inline-flex items-center text-[10.5px] sm:text-[11px] font-black px-2 py-0.5 rounded-md leading-none border transition-colors ${
                                  timeUntilClose.isUrgent
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : timeUntilClose.isClosingSoon
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {timeUntilClose.text === 'fechando agora'
                                  ? 'Fechando agora'
                                  : `Fecha ${timeUntilClose.text}`}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-red-600 flex items-center gap-1.5 font-bold shrink-0">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Fechado
                      </span>
                      <span className="text-slate-400 font-bold">⋅</span>
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Abre às {openingTime || '08:00'}</span>
                      </span>
                    </>
                  )}
                </div>
              ) : null}
              {isNewOrderDraft && distanceFormatted && (
                <span
                  className="mt-1.5 inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-700 sm:text-sm"
                  title={`Distância até o local: ${distanceFormatted}`}
                >
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-slate-500 stroke-[2.4]" />
                  <span className="font-bold">{distanceFormatted}</span>
                </span>
              )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className={hasCustomerRoute ? 'flex' : 'grid grid-cols-3 gap-2'}>
              <button
                type="button"
                onClick={() => handleOpenCustomerSelector('customer')}
                className={`inline-flex min-w-0 items-center justify-between gap-1.5 rounded-xl border border-blue-700 bg-blue-600 px-2.5 py-2 text-[10px] font-black text-white shadow-sm transition-colors hover:bg-blue-700 ${hasCustomerRoute ? 'w-full' : ''}`}
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">
                  {customerName ? <><span>Cliente</span><br /><span className="font-semibold">{customerName}</span></> : 'Cliente'}
                </span>
                {customerName && <Edit3 className="h-3 w-3 shrink-0" />}
              </button>
              {!hasCustomerRoute && (
                <>
              <button
                type="button"
                onClick={() => {
                  setRouteSellerTarget(null);
                  setIsSellerModalOpen(true);
                }}
                className="inline-flex min-w-0 items-center justify-between gap-1.5 rounded-xl border border-orange-700 bg-orange-500 px-2.5 py-2 text-[10px] font-black text-white shadow-sm transition-colors hover:bg-orange-600"
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">
                  {responsibleName ? <><span>Vendedor</span><br /><span className="font-semibold">{responsibleName}</span></> : 'Definir vendedor'}
                </span>
                {responsibleName && <Edit3 className="h-3 w-3 shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteDriverTarget(null);
                  setIsDriverSelectorOpen(true);
                }}
                className="inline-flex min-w-0 items-center justify-between gap-1.5 rounded-xl border border-emerald-700 bg-emerald-600 px-2.5 py-2 text-[10px] font-black text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                {selectedPlace.orderVisibility === 'privado' ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Globe className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0 flex-1 whitespace-normal break-words text-center leading-tight">
                  {selectedDriverName ? <><span>Motorista</span><br /><span className="font-semibold">{selectedDriverName}</span></> : 'Motorista'}
                </span>
                {selectedDriverName && <Edit3 className="h-3 w-3 shrink-0" />}
              </button>
                </>
              )}
            </div>
          )}


            {!isNewOrderDraft && !canEdit && hasCustomer && (
              <button
                type="button"
                onClick={() => handleWhatsApp(customerPhone, customerName)}
                disabled={!customerPhone}
                className="inline-flex w-full min-w-0 items-center gap-1.5 rounded-xl border border-blue-700 bg-blue-600 px-2.5 py-2 text-[10px] font-black text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-70"
                title={customerPhone ? `Chamar ${customerName} no WhatsApp` : 'Sem telefone cadastrado'}
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-tight">
                  <span>Cliente</span><br />
                  <span className="font-semibold">{customerName}</span><br />
                  <span className="text-[9px] font-bold text-white/90">{customerPhone ? 'Clique para chamar no zap' : 'Sem telefone'}</span>
                </span>
              </button>
            )}

            {!hasCustomerRoute && renderViewRoutePointActions(activeRoutePoint)}

            {showCounterpartButton && (
              <div className="w-full space-y-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCounterpartPickerOpen(open => !open)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#0B5187]/50 bg-blue-50/60 px-3 py-2 text-[11px] font-black text-[#0B5187] hover:bg-blue-100/70 active:scale-[0.99] cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {(selectedPlace.operationType === 'entrega' ? selectedPlace.pickupCoordinates : selectedPlace.deliveryCoordinates)
                      ? `Local de ${counterpartLabel}: ${selectedPlace.operationType === 'entrega' ? selectedPlace.pickupAddress : selectedPlace.deliveryAddress}`
                      : `Definir local de ${counterpartLabel}`}
                  </span>
                </button>
                {isCounterpartPickerOpen && (
                  <div className="rounded-xl border border-slate-200 bg-white p-2 space-y-1.5 shadow-sm">
                    <input
                      autoFocus
                      value={counterpartQuery}
                      onChange={event => setCounterpartQuery(event.target.value)}
                      placeholder={`Buscar local de ${counterpartLabel}...`}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0B5187]"
                    />
                    {counterpartResults.map(result => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => applyCounterpartLocation(result)}
                        className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-[#0B5187] hover:bg-blue-50/50 cursor-pointer"
                      >
                        <p className="text-xs font-black text-slate-900 break-words">{result.name}</p>
                        <p className="text-[10px] text-slate-500 break-words">{result.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Rota, pontos e configurações em um único painel compacto. */}
            {hasCustomerRoute ? (
              <div className="w-full min-w-0 rounded-2xl p-3 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 border border-slate-200/90 shadow-2xs space-y-2.5 shrink-0">
                {/* Cabeçalho da Rota com Tipo de Operação */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Route className="w-4 h-4 text-[#0B5187] stroke-[2.5] shrink-0" />
                    <span className="text-xs font-black text-slate-800 truncate">
                      {operationType === 'coleta' && 'Rota de Coleta (Local ➔ Cliente)'}
                      {operationType === 'entrega' && 'Rota de Entrega (Cliente ➔ Local)'}
                      {operationType === 'troca' && 'Rota de Troca (Cliente ➔ Local ➔ Cliente)'}
                    </span>
                  </div>

                  {activeRoute && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0 shadow-2xs">
                      {activeRoute.distanceKm.toFixed(1)} km • ~{activeRoute.durationMin} min
                    </span>
                  )}
                </div>

                {/* Resumo das etapas da rota da encomenda */}
                {Boolean(orderResolvedLocations) && orderResolvedLocations && (
                <div className="text-[11px] space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  {operationType === 'coleta' && (
                    <>
                      <div className={`flex items-start gap-2${isDriverRole && 'pickup' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-[#0B5187] font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            Coleta no Local: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryOriginName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryOriginAddress}
                          </p>
                          {renderRoutePointDetails('pickup')}
                          {renderDraftRoutePointActions('pickup')}
                          {renderViewRoutePointActions('pickup')}
                        </div>
                      </div>
                      <div className={`flex items-start gap-2 pt-1.5 border-t border-slate-100${isDriverRole && 'delivery' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            Entrega no Cliente: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryDestName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryDestAddress}
                          </p>
                          {renderRoutePointDetails('delivery')}
                          {renderDraftRoutePointActions('delivery')}
                          {renderViewRoutePointActions('delivery')}
                        </div>
                      </div>
                    </>
                  )}

                  {operationType === 'entrega' && (
                    <>
                      <div className={`flex items-start gap-2${isDriverRole && 'pickup' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-orange-100 text-[#FF5E00] font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            Coleta no Cliente: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryOriginName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryOriginAddress}
                          </p>
                          {renderRoutePointDetails('pickup')}
                          {renderDraftRoutePointActions('pickup')}
                          {renderViewRoutePointActions('pickup')}
                        </div>
                      </div>
                      <div className={`flex items-start gap-2 pt-1.5 border-t border-slate-100${isDriverRole && 'delivery' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-[#0B5187] font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            Entrega no Local: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryDestName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryDestAddress}
                          </p>
                          {renderRoutePointDetails('delivery')}
                          {renderDraftRoutePointActions('delivery')}
                          {renderViewRoutePointActions('delivery')}
                        </div>
                      </div>
                    </>
                  )}

                  {operationType === 'troca' && (
                    <>
                      <div className={`flex items-start gap-2${isDriverRole && 'pickup' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            1. Coleta no Cliente: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryOriginName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryOriginAddress}
                          </p>
                          {renderRoutePointDetails('pickup')}
                          {renderDraftRoutePointActions('pickup')}
                          {renderViewRoutePointActions('pickup')}
                        </div>
                      </div>
                      <div className={`flex items-start gap-2 pt-1.5 border-t border-slate-100${isDriverRole && 'exchange' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-[#0B5187] font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            2. Troca no Local: <span className="text-slate-600 font-normal">{orderResolvedLocations.exchangeName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.exchangeAddress}
                          </p>
                          {renderRoutePointDetails('exchange')}
                          {renderDraftRoutePointActions('exchange')}
                          {renderViewRoutePointActions('exchange')}
                        </div>
                      </div>
                      <div className={`flex items-start gap-2 pt-1.5 border-t border-slate-100${isDriverRole && 'delivery' !== activeRoutePoint ? ' hidden' : ''}`}>
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                          3
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="min-w-0 font-bold text-slate-800 leading-tight break-words [overflow-wrap:anywhere]">
                            3. Retorno no Cliente: <span className="text-slate-600 font-normal">{orderResolvedLocations.summaryDestName}</span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {orderResolvedLocations.summaryDestAddress}
                          </p>
                          {renderRoutePointDetails('delivery')}
                          {renderDraftRoutePointActions('delivery')}
                          {renderViewRoutePointActions('delivery')}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                )}

                {activeRoute && (
                  <button
                    type="button"
                    onClick={clearActiveRoute}
                    className="w-full py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    title="Ocultar rota ativa do mapa"
                  >
                    Ocultar rota do mapa
                  </button>
                )}

            </div>
            ) : (
            !isNewOrderDraft && !isDriverRole && (() => {
              const isPublicMode = selectedPlace.orderVisibility === 'publico' || 
                (!selectedPlace.orderVisibility && !selectedPlace.assignedDriverId && !selectedPlace.assignedDriverPhone);

              return (
                <div className="w-full rounded-2xl p-3 bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2 shrink-0">
                  {/* Cabeçalho da seção com seletor Público / Privado */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {selectedPlace.operationType === 'coleta'
                        ? 'Visibilidade da coleta'
                        : selectedPlace.operationType === 'troca'
                          ? 'Visibilidade da troca'
                          : 'Visibilidade da entrega'}
                    </span>

                    {canManageDriverAssignment ? (
                      <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80 border border-slate-300/80">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              handleLockedEditAttempt();
                              return;
                            }
                            handleSetVisibilityPublic();
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                            isPublicMode
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                          title="Público: Aparece para todos os motoristas"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Público</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              handleLockedEditAttempt();
                              return;
                            }
                            handleSetVisibilityPrivate();
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                            !isPublicMode
                              ? 'bg-[#0B5187] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                          title="Privado: Escolha o motorista para aparecer (opcional)"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Privado</span>
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        isPublicMode ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#0B5187]'
                      }`}>
                        {isPublicMode ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        <span>{isPublicMode ? 'Público' : 'Privado'}</span>
                      </span>
                    )}
                  </div>

                  {/* CONTEÚDO QUANDO PÚBLICO */}
                  {isPublicMode ? (
                    <div className="w-full rounded-xl p-2.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300/80 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-emerald-950 truncate leading-tight">
                            Aparece para todos os motoristas
                          </p>
                          <p className="text-[10px] text-emerald-700/90 font-medium truncate">
                            Qualquer motorista pode visualizar e atender no mapa
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-white/80 px-2 py-1 rounded-md shrink-0 border border-emerald-200">
                        Livre
                      </span>
                    </div>
                  ) : (
                    /* CONTEÚDO QUANDO PRIVADO */
                    <div>
                      {selectedPlace.assignedDriverId || selectedPlace.assignedDriverPhone ? (
                        /* Motorista direcionado no modo privado */
                        <div className="w-full rounded-xl p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50/80 border border-blue-200 shadow-2xs flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-[#0B5187] text-white flex items-center justify-center shrink-0 shadow-xs text-base">
                              {assignedVehicleEmoji}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-[#0B5187] bg-blue-100 px-1.5 py-0.2 rounded-md">
                                  Privado • Motorista Escolhido
                                </span>
                              </div>
                              <p className="text-xs sm:text-[13px] font-black text-slate-900 truncate leading-tight mt-0.5">
                                {assignedDriverDisplayName}
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium truncate">
                                {assignedDriverSubtitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {canManageDriverAssignment ? (
                              canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setIsDriverSelectorOpen(true)}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-white hover:bg-blue-100 text-[#0B5187] border border-blue-300 shadow-2xs transition-all cursor-pointer"
                                    title="Trocar motorista da encomenda"
                                  >
                                    Alterar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRemoveDriverFromPlace}
                                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Desvincular motorista (manter privado)"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                </>
                              ) : null
                            ) : (
                              /* Motorista: pode apenas Recusar com justificativa */
                              <button
                                type="button"
                                onClick={() => setShowRefusalModal(true)}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                                title="Recusar ou cancelar esta rota com justificativa para a central"
                              >
                                <Ban className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Recusar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : canManageDriverAssignment ? (
                        /* Modo privado sem motorista selecionado ainda (Opcional) */
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              handleLockedEditAttempt();
                              return;
                            }
                            setIsDriverSelectorOpen(true);
                          }}
                          className={`w-full rounded-xl p-2.5 border-2 border-dashed border-blue-300 hover:border-[#0B5187] bg-blue-50/60 hover:bg-blue-50 text-slate-800 flex items-center justify-between gap-3 transition-all shadow-2xs text-left ${canEdit ? 'cursor-pointer group' : 'cursor-default opacity-80'}`}
                          title={canEdit ? "Escolher motorista para aparecer (opcional)" : "Motorista privado (Clique em Editar para escolher)"}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-[#0B5187] group-hover:bg-[#083c64] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
                              <UserCheck className="w-4 h-4 stroke-[2.4]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate leading-tight">
                                Escolher motorista para aparecer
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium truncate">
                                Opcional • Toque para selecionar o motorista
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-blue-200 group-hover:bg-[#0B5187] group-hover:text-white text-[#0B5187] text-[11px] font-black transition-colors shrink-0">
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>Selecionar</span>
                          </div>
                        </button>
                      ) : (
                        <div className="w-full rounded-xl p-2.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                          Rota privada aguardando atribuição de motorista.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
            )}

            {canEdit && !hasCustomerRoute && (
              <div className="rounded-2xl border-2 border-red-300 bg-red-50/70 p-3 shadow-sm shrink-0">
                <label className="block text-[11px] font-black uppercase tracking-wider text-red-700">
                  Observações
                  <textarea
                    ref={isNewOrderDraft ? draftObservationRef : undefined}
                    value={isNewOrderDraft ? draftOrderComment : (selectedPlace.observations || '')}
                    onChange={event => {
                      if (isNewOrderDraft) draftObservationEditedRef.current = true;
                      const comment = event.target.value;
                      setDraftOrderComment(comment);
                      const routeNote = operationType === 'troca'
                        ? { exchangeNotes: comment }
                        : operationType === 'entrega'
                          ? { deliveryNotes: comment }
                          : { pickupNotes: comment };
                      setSelectedPlace({ ...selectedPlace, observations: comment, ...routeNote });
                    }}
                    placeholder={`Instruções para ${operationType === 'coleta' ? 'a coleta' : operationType === 'troca' ? 'a troca' : 'a entrega'}...`}
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 outline-none placeholder:font-medium placeholder:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>
            )}

          </div>

          {/* BARRA DE AÇÕES INFERIOR: EXATAMENTE OS 3 BOTÕES SOLICITADOS */}
          <div className="relative p-2.5 sm:p-3 bg-slate-50 border-t border-slate-200/80 flex items-center gap-2 shrink-0">
            {/* Modal / Menu Flutuante para escolher Waze ou Google Maps com opção de definir como padrão */}
            {showNavChooser && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNavChooser(false)} 
                />
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-16 right-2 sm:right-16 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 w-72 sm:w-80 animate-in zoom-in-95 fade-in duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                    <div>
                      <span className="text-xs font-black uppercase text-slate-800 tracking-wide block">
                        Escolher Navegação GPS
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Direto na rota sem precisar clicar iniciar
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowNavChooser(false)}
                      className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Opção Google Maps */}
                    <button
                      type="button"
                      onClick={() => {
                        executeDirectNavigation('google_maps', saveAsDefaultNav);
                        setShowNavChooser(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left group cursor-pointer ${
                        defaultNavApp === 'google_maps'
                          ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-400'
                          : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      <GoogleMapsIcon className="w-7 h-7 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-900">Google Maps</p>
                          {defaultNavApp === 'google_maps' && (
                            <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">Navegação direta no mapa</p>
                      </div>
                    </button>

                    {/* Opção Waze */}
                    <button
                      type="button"
                      onClick={() => {
                        executeDirectNavigation('waze', saveAsDefaultNav);
                        setShowNavChooser(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left group cursor-pointer ${
                        defaultNavApp === 'waze'
                          ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-400'
                          : 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-200'
                      }`}
                    >
                      <WazeIcon className="w-7 h-7 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-900">Waze</p>
                          {defaultNavApp === 'waze' && (
                            <span className="text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-md">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">Trânsito e alertas em tempo real</p>
                      </div>
                    </button>
                  </div>

                  {/* Opção para definir como padrão ou alterar preferência */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveAsDefaultNav}
                        onChange={(e) => setSaveAsDefaultNav(e.target.checked)}
                        className="w-4 h-4 text-[#0B5187] rounded border-slate-300 focus:ring-[#0B5187] cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-slate-700">
                        Definir como padrão (não perguntar mais)
                      </span>
                    </label>

                    {defaultNavApp && (
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultNavApp(null);
                          setSaveAsDefaultNav(false);
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-red-600 text-left transition-colors pt-0.5 cursor-pointer"
                      >
                        Remover padrão (perguntar sempre)
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Menu Popover das Outras Ações do Pedido (Editar, Detalhes, Novo Pedido, Compartilhar, GPS) */}
            {isActionsMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsActionsMenuOpen(false)} 
                />
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-16 right-2 sm:right-3 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 w-64 sm:w-72 animate-in zoom-in-95 fade-in duration-150 divide-y divide-slate-100"
                >
                  <div className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                        Mais Opções
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        #{selectedPlace.orderCode || selectedPlace.id?.slice(0, 8) || 'Pedido'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActionsMenuOpen(false)}
                      className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="py-1 space-y-0.5">
                    {/* Registrar Baixa / Ocorrência com Foto */}
                    <button
                      type="button"
                      onClick={() => {
                        setOperationStatus('success');
                        openFullScreenCamera();
                        setIsActionsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-950 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 transition-colors">
                        <Camera className="w-4.5 h-4.5 stroke-[2.3]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 truncate">
                          Registrar {operationConfig.title}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Tirar foto e dar baixa imediata
                        </div>
                      </div>
                    </button>

                    {/* Detalhes do Pedido & Preço (apenas admin e atendente) */}
                    {canManageDriverAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFinalDetailsOpen(true);
                        setIsActionsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-amber-50/70 text-slate-700 hover:text-amber-950 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 group-hover:bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 transition-colors">
                        <DollarSign className="w-4.5 h-4.5 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-amber-950 truncate">
                          Detalhes do Pedido & Preço
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {selectedPlace.price ? `R$ ${selectedPlace.price.toFixed(2)} • Ver cálculo` : 'Calcular frete e taxas'}
                        </div>
                      </div>
                    </button>
                    )}

                    {/* Editar Pedido (Desabilitado para motoristas) */}
                    {!isDriverRole && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingOrder(true);
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl hover:bg-blue-50/70 text-slate-700 hover:text-[#0B5187] flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 text-[#0B5187] flex items-center justify-center shrink-0 transition-colors">
                          <Edit3 className="w-4 h-4 stroke-[2.3]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#0B5187] truncate">
                            Editar Pedido
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Alterar dados, endereço ou cliente
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Cancelar pedido (motorista, com justificativa) */}
                    {isDriverRole && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setRefusalReason('');
                          setRefusalNotes('');
                          setShowRefusalModal(true);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl hover:bg-rose-50/70 text-slate-700 hover:text-rose-800 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-100 group-hover:bg-rose-200 text-rose-700 flex items-center justify-center shrink-0 transition-colors">
                          <Ban className="w-4 h-4 stroke-[2.3]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 group-hover:text-rose-800 truncate">
                            Cancelar pedido
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Desistir da rota com justificativa
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Compartilhar */}
                    <button
                      type="button"
                      onClick={() => {
                        handleShareLocation();
                        setIsActionsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-teal-50/70 text-slate-700 hover:text-teal-950 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        sharedToast ? 'bg-emerald-600 text-white' : 'bg-teal-100 group-hover:bg-teal-200 text-teal-900'
                      }`}>
                        {sharedToast ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4 stroke-[2.3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-teal-950 truncate">
                          {sharedToast ? 'Dados Copiados!' : 'Compartilhar Pedido'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Copiar dados e link de rastreio
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {canClaimOrders(currentRole) && selectedPlace && realtimeAssignmentService.isPublicOrder(selectedPlace) ? (
              /* BARRA ESPECIAL DO MOTORISTA: PEDIDO PÚBLICO DISPONÍVEL - BOTÃO ACEITAR EM DESTAQUE */
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  disabled={isClaimingOrder}
                  onClick={handleClaimThisOrder}
                  className="flex-1 h-12 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-orange-500/30 active:scale-95 transition-all cursor-pointer ring-2 ring-amber-300 animate-pulse disabled:opacity-50"
                  title="Confirmar que você será o responsável por esta entrega"
                >
                  <Zap className="w-5 h-5 fill-current shrink-0" />
                  <span>{isClaimingOrder ? 'Confirmando...' : 'ACEITAR E ASSUMIR PEDIDO'}</span>
                </button>
                <button
                  type="button"
                  onClick={triggerClose}
                  className="h-12 px-3.5 rounded-2xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  Fechar
                </button>
              </div>
            ) : !isAlreadySaved ? (
              /* BARRA INFERIOR AO ADICIONAR NOVO PEDIDO: BOTÃO ADICIONAR PEDIDO EM DESTAQUE (APENAS NÃO-MOTORISTA) */
              !isDriverRole ? (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleSavePlaceOrder}
                    disabled={isSavingOrder}
                    className="w-full h-12 px-4 rounded-2xl active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-600/30 ring-2 ring-emerald-400/40"
                    title="Salvar esta encomenda no banco de dados"
                  >
                    {isSavingOrder ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Check className="w-5 h-5 stroke-[3] shrink-0" />}
                    <span className="truncate">{isSavingOrder ? 'Salvando no banco...' : 'Salvar Pedido'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-xs text-slate-500 font-semibold truncate px-2">
                    Visualização de Local no Mapa
                  </span>
                  <button
                    type="button"
                    onClick={triggerClose}
                    className="h-10 px-4 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    Fechar
                  </button>
                </div>
              )
            ) : isEditingOrder ? (
              /* BARRA INFERIOR DURANTE EDIÇÃO MANUAL DO PEDIDO */
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setIsEditingOrder(false)}
                  className="h-11 sm:h-12 px-4 rounded-2xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePlaceOrder}
                  className="flex-1 h-11 sm:h-12 px-4 rounded-2xl active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 min-w-0"
                  title="Salvar alterações do pedido"
                >
                  <Check className="w-5 h-5 stroke-[3] shrink-0" />
                  <span className="truncate">Salvar Alterações</span>
                </button>
              </div>
            ) : (
              /* BARRA INFERIOR PADRÃO: 1. REGISTRO + 2. NAVEGAR COM SETA DE SELEÇÃO + 3. MENU APENAS ÍCONE */
              <div className="flex items-center gap-2 w-full">
                {/* 1. BOTÃO DE REGISTRO DIRETO COM FOTO (COLETA / ENTREGA / TROCA) */}
                <button
                  type="button"
                  onClick={() => {
                    setOperationStatus('success');
                    openFullScreenCamera();
                  }}
                  className={`flex-1 h-11 sm:h-12 px-3 sm:px-4 rounded-2xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg transition-all active:scale-95 cursor-pointer min-w-0 ${operationConfig.btnBg}`}
                  title={`${operationConfig.title} com Foto - Toque para registrar`}
                >
                  <Camera className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.6] shrink-0" />
                  <span className="truncate">{operationConfig.title}</span>
                </button>

                {/* 2. BOTÃO NAVEGAR GPS COM SETA PARA BAIXO (SELETOR DE APP GOOGLE MAPS / WAZE) */}
                <div className="flex items-center h-11 sm:h-12 rounded-2xl bg-[#1A73E8] text-white shadow-md shadow-blue-500/25 border border-blue-400/30 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartNavigation()}
                    className="h-full px-3 sm:px-3.5 hover:bg-[#1557b0] active:bg-[#0d47a1] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title={
                      defaultNavApp === 'google_maps'
                        ? "Navegar direto pelo Google Maps (traça rota no GPS)"
                        : defaultNavApp === 'waze'
                        ? "Navegar direto pelo Waze (traça rota no GPS)"
                        : "Navegar até o local (escolher app e traçar rota)"
                    }
                  >
                    {defaultNavApp === 'google_maps' ? (
                      <GoogleMapsIcon className="w-4 h-4 shrink-0" />
                    ) : defaultNavApp === 'waze' ? (
                      <WazeIcon className="w-4 h-4 shrink-0" />
                    ) : (
                      <Navigation className="w-4 h-4 fill-current stroke-[2.2] shrink-0" />
                    )}
                    <span>Navegar</span>
                  </button>
                  <div className="w-[1px] h-6 bg-white/30" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNavChooser(prev => !prev);
                    }}
                    className="h-full px-2 hover:bg-[#1557b0] active:bg-[#0d47a1] flex items-center justify-center transition-all cursor-pointer"
                    title="Mudar aplicativo de navegação GPS (Google Maps / Waze)"
                    aria-label="Escolher aplicativo de GPS"
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* 3. BOTÃO DE MENU (SEM TEXTO) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsActionsMenuOpen(prev => !prev);
                  }}
                  className={`h-11 sm:h-12 w-11 sm:w-12 rounded-2xl flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0 cursor-pointer border ${
                    isActionsMenuOpen
                      ? 'bg-[#0B5187] text-white border-[#0B5187] shadow-[#0B5187]/25'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-slate-200/50'
                  }`}
                  title="Menu de opções do pedido"
                  aria-label="Mais opções do pedido"
                >
                  <Menu className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* Input oculto para selecionar foto(s) da galeria */}
      <input 
        ref={galleryInputRef} 
        type="file" 
        accept="image/*" 
        multiple 
        onChange={handleGalleryFileSelected} 
        className="hidden" 
      />

      {/* Input oculto nativo do dispositivo para abrir a câmera física (Samsung/iOS) */}
      <input 
        ref={nativeCameraInputRef} 
        type="file" 
        accept="image/*" 
        capture="environment" 
        onChange={handleGalleryFileSelected} 
        className="hidden" 
      />

      {/* ========================================================
          SISTEMA DE CÂMERA PRÓPRIO CHEIA NA TELA (ESTILO SAMSUNG)
          - Câmera cheia na tela inteira (100% viewport)
          - Controles flutuantes sobre a câmera (Volume e Observação)
          - As fotos vão saindo embaixo no carrossel sem fechar a câmera
          - Botão Shutter central estilo Samsung
          - Botão Finalizar Registro direto na tela da câmera
          ======================================================== */}
      {isFullScreenCameraOpen && (
        <div className="fixed inset-0 z-[80] bg-black text-white select-none flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
          
          {/* Flash visual da tela ao disparar */}
          {isFlashing && <div className="absolute inset-0 bg-white z-40 pointer-events-none" />}

          {/* 1. BARRA SUPERIOR TRANSLÚCIDA SOBRE O VISOR */}
          <div className="absolute top-0 inset-x-0 pt-4 pb-2 px-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent z-30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              {/* Botão Fechar Câmera */}
              <button 
                type="button"
                onClick={closeFullScreenCamera} 
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md"
                title="Voltar ao mapa"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>

              {/* Identificação da Operação & Local */}
              <div className="text-center px-2 min-w-0">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full backdrop-blur-md border text-[11px] font-black uppercase tracking-wider mb-0.5 shadow-md ${
                  operationStatus === 'failed'
                    ? 'bg-rose-950/80 border-rose-400/80 text-rose-200'
                    : 'bg-black/60 border-white/20 text-white'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    operationStatus === 'failed'
                      ? 'bg-rose-500 animate-pulse'
                      : selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta' 
                      ? 'bg-[#FF5E00]' 
                      : 'bg-emerald-400'
                  }`} />
                  <span>
                    {operationStatus === 'failed' 
                      ? (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta' ? 'Tentativa de Coleta' : 'Tentativa de Entrega')
                      : selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta' 
                      ? 'Registro de Coleta' 
                      : 'Registro de Entrega'}
                  </span>
                </div>
                <p className="text-xs font-black text-white drop-shadow-md truncate max-w-[200px] sm:max-w-xs">
                  {selectedPlace.name}
                </p>
              </div>

              {/* Botões do Topo: Flash e Virar Câmera */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFlashMode(prev => prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto');
                  }}
                  className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md"
                  title="Modo de Flash"
                >
                  {flashMode === 'auto' && <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />}
                  {flashMode === 'on' && <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />}
                  {flashMode === 'off' && <ZapOff className="w-4 h-4 text-slate-300" />}
                </button>

                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md"
                  title="Virar Câmera"
                >
                  <RefreshCw className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* CONTROLES FLUTUANTES SOBRESSALENTES REDISTRIBUÍDOS: NÃO CONSEGUIU ENTREGAR/COLETAR?, VOLUMES E OBSERVAÇÃO */}
            <div className="flex items-center justify-between gap-1.5 max-w-md mx-auto w-full pt-1">
              {/* Botão Discreto: Não conseguiu entregar / Insucesso */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (operationStatus === 'success') {
                      setOperationStatus('failed');
                      setShowFailReasonPicker(true);
                    } else {
                      setShowFailReasonPicker(prev => !prev);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl backdrop-blur-md border text-xs font-black transition-all active:scale-95 cursor-pointer shadow-lg ${
                    operationStatus === 'failed'
                      ? 'bg-rose-600/90 text-white border-rose-300 ring-2 ring-rose-400/40'
                      : 'bg-black/60 text-amber-300 border-amber-400/35 hover:bg-black/80 hover:border-amber-400'
                  }`}
                  title={
                    operationStatus === 'failed' 
                      ? "Motivo do insucesso (toque para alterar)" 
                      : (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta')
                      ? "Não conseguiu coletar? Toque para registrar ocorrência com foto"
                      : "Não conseguiu entregar? Toque para registrar ocorrência com foto"
                  }
                >
                  <AlertCircle className={`w-3.5 h-3.5 ${operationStatus === 'failed' ? 'text-white' : 'text-amber-400'}`} />
                  <span className="truncate max-w-[130px] sm:max-w-[150px]">
                    {operationStatus === 'failed' 
                      ? failReason 
                      : (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta')
                      ? 'Não coletou?'
                      : 'Não entregou?'}
                  </span>
                  {operationStatus === 'failed' && (
                    <ChevronDown className="w-3 h-3 text-white/80" />
                  )}
                </button>

                {/* Seletor Flutuante de Motivos de Insucesso */}
                {showFailReasonPicker && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full left-0 mt-1.5 w-60 z-50 bg-slate-900/95 backdrop-blur-xl border border-rose-400/50 rounded-2xl p-2 shadow-2xl animate-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1 px-1">
                      <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider">
                        {(selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') ? 'Motivo da Não Coleta' : 'Motivo da Não Entrega'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFailReasonPicker(false)}
                        className="text-white/60 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-1">
                      {[
                        'Local Fechado / Fora de Horário',
                        'Cliente / Responsável Ausente',
                        'Endereço Não Localizado',
                        'Mercadoria Não Disponível',
                        'Recusado pelo Destinatário',
                        'Outro Motivo'
                      ].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            setFailReason(reason);
                            setOperationStatus('failed');
                            setShowFailReasonPicker(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                            failReason === reason && operationStatus === 'failed'
                              ? 'bg-rose-600 text-white'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <span className="truncate">{reason}</span>
                          {failReason === reason && operationStatus === 'failed' && (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                        </button>
                      ))}

                      <div className="pt-1 mt-1 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setOperationStatus('success');
                            setShowFailReasonPicker(false);
                          }}
                          className="w-full text-center px-2 py-1 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {(selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') ? 'Voltar para Coleta Normal' : 'Voltar para Entrega Normal'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lado Direito: Volumes e Observação */}
              <div className="flex items-center gap-1.5">
                {/* Stepper de Quantidade de Volumes (somente no modo normal de sucesso) */}
                {operationStatus === 'success' && (
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 pl-0.5">
                      Vol:
                    </span>

                    <button
                      type="button"
                      onClick={() => handleUpdateVolumeQuantity(volumeQuantity - 1)}
                      disabled={volumeQuantity <= 1}
                      className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center font-black active:scale-90 transition-all cursor-pointer"
                    >
                      <Minus className="w-3 h-3 stroke-[3]" />
                    </button>

                    <span className="px-1 font-mono font-black text-xs text-amber-300 min-w-6 text-center">
                      {volumeQuantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleUpdateVolumeQuantity(volumeQuantity + 1)}
                      className="w-6 h-6 rounded-lg bg-[#FF5E00] hover:bg-orange-600 text-white flex items-center justify-center font-black active:scale-90 transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                )}

                {/* Botão Flutuante de Observação & Recebedor */}
                <button
                  type="button"
                  onClick={() => setShowObservationSheet(prev => !prev)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-2xl backdrop-blur-md border text-xs font-black transition-all active:scale-95 cursor-pointer shadow-lg ${
                    notes.trim() || receiverName.trim()
                      ? 'bg-amber-500/90 text-slate-950 border-amber-300'
                      : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                  }`}
                  title="Adicionar ou editar observações"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[100px]">
                    {operationStatus === 'failed' ? (notes ? 'Obs Insucesso' : 'Obs') : receiverName ? `Por: ${receiverName}` : notes ? 'Anotação' : 'Obs'}
                  </span>
                  {(notes.trim() || receiverName.trim()) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 2. VISOR DA CÂMERA CHEIA NA TELA (FULLSCREEN VIEW) */}
          <div 
            onClick={handleViewfinderTap}
            className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-crosshair"
          >
            {/* Aviso Flutuante quando no modo Insucesso / Tentativa sem sucesso */}
            {operationStatus === 'failed' && (
              <div className="absolute top-4 inset-x-4 max-w-sm mx-auto z-20 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-1.5 rounded-full bg-rose-600/90 backdrop-blur-md text-white text-xs font-black text-center shadow-lg border border-rose-300 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Tire a foto do local para comprovar a tentativa</span>
                </div>
              </div>
            )}

            {cameraError ? (
              /* Mensagem de Erro com botão para Câmera do Celular e Galeria */
              <div className="p-6 text-center max-w-sm mx-auto flex flex-col items-center gap-3 z-20">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
                <div className="flex flex-col gap-2 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="w-full py-3 px-5 rounded-2xl bg-[#FF5E00] hover:bg-[#EA580C] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all"
                  >
                    <Camera className="w-5 h-5 stroke-[2.5]" />
                    <span>Tirar Foto com a Câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isFinalizingPhoto}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <ImageIcon className="w-4 h-4 text-amber-300" />
                    <span>Escolher Foto da Galeria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFinalizeRegistration();
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Dar Baixa Direta sem Câmera</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Vídeo da Câmera em Tela Cheia */
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  playsInline 
                  autoPlay 
                  muted 
                  onLoadedMetadata={(e) => {
                    e.currentTarget.play().catch(() => {});
                  }}
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1)'
                  }}
                  className="w-full h-full object-cover" 
                />

                {/* Anel de foco amarelo estilo smartphone ao tocar no visor */}
                {focusPoint && (
                  <div 
                    style={{ left: focusPoint.x - 30, top: focusPoint.y - 30 }}
                    className="absolute pointer-events-none z-30 flex items-center gap-1.5 animate-in zoom-in-75 duration-150"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-amber-300 flex items-center justify-center shadow-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    </div>
                    <Sun className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                )}
              </div>
            )}

            {/* Controles de Zoom (.6, 1x, 2x) sobre o visor estilo Samsung */}
            {!cameraError && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-2 z-20"
              >
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1 shadow-lg">
                  {[
                    { label: '.6', zoom: 1.0 },
                    { label: '1x', zoom: 1.0 },
                    { label: '2x', zoom: 2.0 }
                  ].map((z, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setZoomLevel(z.zoom)}
                      className={`w-8 h-8 rounded-full text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                        zoomLevel === z.zoom
                          ? 'bg-amber-400 text-black shadow-md scale-105'
                          : 'text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PAINEL FLUTUANTE DE OBSERVAÇÃO & RECEBEDOR (SOBRESSALENTE) */}
            {showObservationSheet && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-3 bottom-8 max-w-md mx-auto z-40 bg-slate-900/95 backdrop-blur-xl border border-white/25 rounded-3xl p-4 text-white shadow-2xl animate-in slide-in-from-bottom-6 duration-200"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Observação & Recebedor
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowObservationSheet(false)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2.5">
                  {/* Alternador de Status: Sucesso ou Insucesso */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOperationStatus('success')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        operationStatus === 'success'
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-xs'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sucesso</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOperationStatus('failed')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        operationStatus === 'failed'
                          ? 'bg-rose-500/25 border-rose-400 text-rose-300 shadow-xs'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Insucesso</span>
                    </button>
                  </div>

                  {operationStatus === 'success' ? (
                    <>
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Nome do Recebedor / Responsável
                        </label>
                        <input
                          type="text"
                          value={receiverName}
                          onChange={(e) => setReceiverName(e.target.value)}
                          placeholder="Ex: Carlos Silva"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Observações adicionais (opcional)
                        </label>
                        <textarea
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ex: Mercadoria entregue na recepção..."
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Motivo do Insucesso
                      </label>
                      <select
                        value={failReason}
                        onChange={(e) => setFailReason(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/20 text-white focus:outline-none focus:border-rose-400 mb-2 cursor-pointer"
                      >
                        {[
                          'Local Fechado / Fora de Horário',
                          'Cliente / Responsável Ausente',
                          'Endereço Não Localizado',
                          'Recusado pelo Destinatário',
                          'Outro Motivo'
                        ].map((r) => (
                          <option key={r} value={r} className="bg-slate-900 text-white">
                            {r}
                          </option>
                        ))}
                      </select>

                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Detalhes da ocorrência
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Tentativa sem sucesso às 14h..."
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowObservationSheet(false)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Salvar e Voltar para a Câmera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. BARRA INFERIOR COM AS FOTOS SAINDO EMBAIXO E O OBTURADOR ESTILO SAMSUNG */}
          <div className="relative inset-x-0 p-4 pb-6 bg-gradient-to-t from-black via-black/85 to-transparent z-30 flex flex-col gap-3">
            
            {/* ALERTA DE ERRO DE FOTO CASO FALTE NA COLETA */}
            {photoErrorMsg && (
              <div className="max-w-md mx-auto w-full p-2.5 rounded-xl bg-rose-500/90 border border-rose-300 text-white text-xs font-black flex items-center gap-2 shadow-lg animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-white" />
                <span>{photoErrorMsg}</span>
              </div>
            )}

            {/* FILEIRA DE MINIATURAS DAS FOTOS SAINDO EMBAIXO */}
            <div className="w-full max-w-md mx-auto">
              {customPhotos.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto px-1 py-1 scrollbar-thin">
                  {customPhotos.map((photo, index) => {
                    const mdPhoto = formatPhotoUrl(photo, 'md') || photo;
                    return (
                      <div 
                        key={index}
                        onClick={() => openPhotoViewer(photo, selectedPlace)}
                        className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-white/80 shadow-lg group cursor-pointer bg-black/60 animate-in zoom-in-75 duration-150"
                        title="Toque para ver grande"
                      >
                        <img 
                          src={mdPhoto} 
                          alt={`Foto ${index + 1} indisponível`}
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(index, e);
                          }}
                          title="Excluir foto"
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] font-black text-white leading-none">
                          #{index + 1}
                        </span>
                      </div>
                    );
                  })}
                  <div className="px-2 text-[11px] font-bold text-white/80 whitespace-nowrap">
                    {customPhotos.length} {customPhotos.length === 1 ? 'foto' : 'fotos'}
                  </div>
                </div>
              ) : (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') ? (
                <div className="p-2 rounded-xl bg-orange-500/25 border border-orange-400/40 backdrop-blur-md text-center text-xs font-black text-amber-300 animate-pulse">
                  📸 Foto obrigatória: aponte e tire a foto da mercadoria
                </div>
              ) : null}
            </div>

            {/* LINHA DE DISPARO: GALERIA | OBTURADOR SAMSUNG | FINALIZAR REGISTRO */}
            <div className="w-full flex items-center justify-between max-w-md mx-auto px-2 gap-3">
              {/* Botão Galeria */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-[52px] h-[52px] rounded-2xl bg-white/15 hover:bg-white/25 active:scale-90 text-white flex flex-col items-center justify-center border border-white/25 backdrop-blur-md shadow-md transition-all cursor-pointer shrink-0"
                title="Escolher foto da galeria"
              >
                <ImageIcon className="w-5 h-5 text-amber-300" />
                <span className="text-[9px] font-bold text-white/90">Galeria</span>
              </button>

              {/* Botão Shutter Circular Estilo Samsung (76px) */}
              <button
                type="button"
                onClick={handleTakeShutterPhoto}
                disabled={isFinalizingPhoto}
                title="Tirar Foto"
                className="relative w-19 h-19 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90 shadow-2xl group focus:outline-none cursor-pointer shrink-0"
              >
                <div className="w-14 h-14 rounded-full bg-white group-active:scale-90 transition-transform shadow-inner" />
              </button>

              {/* Botão Finalizar Registro */}
              <button
                type="button"
                onClick={() => handleFinalizeRegistration()}
                disabled={isFinalizingPhoto}
                className={`h-[52px] px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer shrink-0 ${
                  operationStatus === 'failed'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/35 border border-rose-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/35 border border-emerald-400'
                }`}
                title={
                  operationStatus === 'failed'
                    ? "Finalizar registro de tentativa sem sucesso e dar andamento"
                    : "Finalizar registro e dar baixa"
                }
              >
                {operationStatus === 'failed' ? (
                  <>
                    <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                    <span className="whitespace-nowrap">Finalizar Insucesso</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span className="whitespace-nowrap">{isFinalizingPhoto ? 'Salvando...' : 'Finalizar'}</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          MODAL DO DIÁLOGO DE COLETA / ENTREGA / TROCA
          ======================================================== */}
      {showOperationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3.5 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            
            {/* Header Colorido da Operação */}
            <div className={`p-4 text-white flex items-center justify-between ${operationConfig.badgeBg}`}>
              <div className="flex items-center gap-2.5">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (firstPhoto) {
                      openPhotoViewer(firstPhoto, selectedPlace);
                    } else {
                      openFullScreenCamera();
                    }
                  }}
                  className={`w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/30 shrink-0 ${
                    firstPhoto ? 'cursor-pointer hover:opacity-90 active:scale-95' : 'cursor-pointer hover:bg-white/30'
                  }`}
                  title={firstPhoto ? "Toque para abrir a foto grande na tela" : "Tirar foto da encomenda"}
                >
                  {firstPhoto ? (
                    <img 
                      src={firstPhoto} 
                      alt="Foto da encomenda indisponível"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <OperationIcon className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">{operationConfig.title}</h3>
                  <p className="text-[11px] text-white/80 truncate max-w-[240px]">{selectedPlace.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowOperationModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Diálogo */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              
              {/* Status: Sucesso ou Insucesso */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Resultado da Operação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperationStatus('success')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
                      operationStatus === 'success'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Realizada com Sucesso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperationStatus('failed')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
                      operationStatus === 'failed'
                        ? 'bg-red-50 border-red-500 text-red-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Insucesso / Falha</span>
                  </button>
                </div>
              </div>

              {/* Campos para Sucesso */}
              {operationStatus === 'success' ? (
                <>
                  {/* SEÇÃO DE FOTO DA BAIXA (OBRIGATÓRIA NA COLETA, USANDO O MESMO COMPONENTE) */}
                  <div className={`p-3 rounded-2xl border-2 transition-all ${
                    photoErrorMsg 
                      ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-200' 
                      : (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') && customPhotos.length === 0
                      ? 'bg-orange-50/70 border-orange-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Camera className={`w-4 h-4 ${(selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') ? 'text-[#FF5E00]' : 'text-slate-700'}`} />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                          Foto da {selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta' ? 'Coleta' : 'Entrega'}
                        </span>
                        {(selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta') && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-300">
                            Obrigatória
                          </span>
                        )}
                        {customPhotos.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {customPhotos.length} {customPhotos.length === 1 ? 'anexada' : 'anexadas'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoErrorMsg('');
                            openFullScreenCamera();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5E00] hover:text-[#E05300] bg-white hover:bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{customPhotos.length === 0 ? 'Tirar Foto' : 'Mais'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPhotoErrorMsg('');
                            galleryInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          title="Escolher foto da galeria"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Galeria</span>
                        </button>
                      </div>
                    </div>

                    {photoErrorMsg && (
                      <div className="p-2 mb-2 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{photoErrorMsg}</span>
                      </div>
                    )}

                    {customPhotos.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoErrorMsg('');
                          openFullScreenCamera();
                        }}
                        className={`w-full py-3 px-3 rounded-xl border-2 border-dashed bg-white hover:bg-orange-50/50 transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer ${
                          photoErrorMsg 
                            ? 'border-rose-400 bg-rose-50/40' 
                            : (selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta')
                            ? 'border-[#FF5E00]/60 hover:border-[#FF5E00]' 
                            : 'border-slate-300 hover:border-[#FF5E00]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF5E00] flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                          <Camera className="w-4 h-4 stroke-[2.3]" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 group-hover:text-[#FF5E00] transition-colors">
                          {(selectedPlace.orderStage === 'coleta' || selectedPlace.operationType === 'coleta')
                            ? 'Tirar foto obrigatória da mercadoria'
                            : 'Toque para tirar foto da encomenda ou comprovante'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Câmera em tela cheia ou galeria
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {customPhotos.map((photo, index) => {
                          const mdPhoto = formatPhotoUrl(photo, 'md') || photo;
                          const lgPhoto = formatPhotoUrl(photo, 'lg') || photo;
                          return (
                            <div 
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPhotoViewer(lgPhoto, selectedPlace);
                              }}
                              className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-lg overflow-hidden shrink-0 border-2 border-[#FF5E00] shadow-2xs group cursor-pointer bg-slate-900"
                            >
                              <img 
                                src={mdPhoto} 
                                alt={`Foto ${index + 1} indisponível`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleDeletePhoto(index, e)}
                                title="Excluir foto"
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-red-600 text-white flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
                              >
                                <X className="w-3 h-3 stroke-[3]" />
                              </button>
                              <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white leading-none">
                                #{index + 1}
                              </span>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setPhotoErrorMsg('');
                            openFullScreenCamera();
                          }}
                          title="Adicionar mais foto"
                          className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg border-2 border-dashed border-slate-300 hover:border-[#FF5E00] hover:bg-orange-50/50 flex flex-col items-center justify-center gap-1 shrink-0 text-slate-400 hover:text-[#FF5E00] transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                          <span className="text-[9px] font-bold">Mais</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nome do Recebedor / Entregador
                    </label>
                    <input 
                      type="text" 
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Ex: Pedro Henrique da Silva"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B5187] focus:border-[#0B5187]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Tipo de Embalagem / Carga
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'caixa', label: 'Caixa', icon: '📦' },
                        { id: 'sacola', label: 'Sacola', icon: '🛍️' },
                        { id: 'envelope', label: 'Envelope', icon: '✉️' },
                        { id: 'cilindro', label: 'Cilindro', icon: '🛢️' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedPackage(item.id as PackageItemType)}
                          className={`py-2 px-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                            selectedPackage === item.id
                              ? 'bg-[#0B5187] text-white border-[#0B5187] shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Quantidade de Volumes
                      </label>
                      <span className="text-[11px] font-bold text-[#0B5187] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {selectedPackage === 'cilindro'
                          ? `${volumeQuantity} ${volumeQuantity === 1 ? 'cilindro' : 'cilindros'}`
                          : volumesCount}
                      </span>
                    </div>

                    {/* Stepper [+] e [-] com digitação livre */}
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateVolumeQuantity(volumeQuantity - 1)}
                        disabled={volumeQuantity <= 1}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300 text-slate-800 flex items-center justify-center font-black transition-all cursor-pointer shadow-2xs shrink-0"
                        title="Diminuir volume"
                      >
                        <Minus className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={volumeQuantityInput}
                          onChange={(e) => handleVolumeInputChange(e.target.value)}
                          onBlur={handleVolumeInputBlur}
                          className="w-full text-center py-1.5 px-3 bg-slate-50 border-2 border-slate-300 focus:bg-white focus:border-[#0B5187] rounded-xl text-sm font-black text-slate-900 focus:outline-none transition-all shadow-inner"
                          placeholder="1"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none hidden sm:inline">
                          {selectedPackage === 'cilindro' ? 'cil' : 'vol'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateVolumeQuantity(volumeQuantity + 1)}
                        className="w-9 h-9 rounded-xl bg-[#0B5187] hover:bg-blue-900 active:scale-95 text-white flex items-center justify-center font-black transition-all cursor-pointer shadow-xs shrink-0"
                        title="Aumentar volume"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Atalhos rápidos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleUpdateVolumeQuantity(num)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${
                            volumeQuantity === num
                              ? 'bg-[#0B5187] text-white border-[#0B5187]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {num} {num === 1 ? 'vol' : 'vols'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Observações adicionais (opcional)
                    </label>
                    <textarea 
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Pacote lacrado entregue na recepção."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B5187] focus:border-[#0B5187]"
                    />
                  </div>
                </>
              ) : (
                /* Campos para Insucesso */
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Motivo do Insucesso
                    </label>
                    <div className="space-y-1.5">
                      {[
                        'Local Fechado / Fora de Horário',
                        'Cliente / Responsável Ausente',
                        'Endereço Não Localizado',
                        'Recusado pelo Destinatário',
                        'Outro Motivo'
                      ].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setFailReason(reason)}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left border flex items-center justify-between transition-all ${
                            failReason === reason
                              ? 'bg-red-50 text-red-700 border-red-300 font-black'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>{reason}</span>
                          {failReason === reason && <Check className="w-3.5 h-3.5 text-red-600 stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Detalhes da Ocorrência
                    </label>
                    <textarea 
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Descreva o que ocorreu..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </>
              )}

            </div>

            {/* Footer do Diálogo */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOperationModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleSaveOperation()}
                disabled={isFinalizingPhoto}
                className={`px-5 py-2.5 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95 ${
                  operationStatus === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmar e Salvar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AVISO: baixa feita longe do local (mais de 1 km) */}
      {farWarning && (
        <div
          className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setFarWarning(null)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-amber-200 space-y-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Você está longe do local</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Você está a <strong>{formatDistance(farWarning.proximity.distanceM / 1000)}</strong> do local desta
                  {operationType === 'entrega' ? ' entrega' : operationType === 'troca' ? ' troca' : ' coleta'}.
                  Se finalizar agora, essa distância ficará registrada no pedido.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFarWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  const proceed = farWarning.proceed;
                  setFarWarning(null);
                  proceed();
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md active:scale-95 transition-all"
              >
                Finalizar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECUSA / CANCELAMENTO DE ROTA PELO MOTORISTA COM MOTIVO */}
      {showRefusalModal && (
        <div 
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isSubmittingRefusal) setShowRefusalModal(false);
          }}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <Ban className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Cancelar pedido
                  </h3>
                  <p className="text-xs text-slate-500">
                    A central será notificada para reatribuir a outro entregador:
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingRefusal}
                onClick={() => setShowRefusalModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opções pré-definidas */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Selecione o Motivo:
              </span>
              {[
                'Problema mecânico / Pane no veículo',
                'Fora da minha rota / Região distante',
                'Volume ou peso incompatível com veículo',
                'Fim de expediente / Turno encerrado',
                'Local fechado ou inacessível no momento',
                'Outro motivo operacional'
              ].map((reason) => {
                const isSelected = refusalReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setRefusalReason(reason);
                      const presets = [
                        'Problema mecânico / Pane no veículo',
                        'Fora da minha rota / Região distante',
                        'Volume ou peso incompatível com veículo',
                        'Fim de expediente / Turno encerrado',
                        'Local fechado ou inacessível no momento',
                        'Outro motivo operacional'
                      ];
                      if (!refusalNotes.trim() || presets.includes(refusalNotes.trim())) {
                        setRefusalNotes(reason === 'Outro motivo operacional' ? '' : reason);
                      }
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50/80 border-rose-300 text-rose-900 font-bold'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{reason}</span>
                    {isSelected && <Check className="w-4 h-4 text-rose-600 stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            {/* Campo de observações adicionais */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Justificativa (obrigatória):
              </label>
              <textarea
                value={refusalNotes}
                onChange={(e) => setRefusalNotes(e.target.value)}
                placeholder="Ex: Pneu furado na rota, solicito outro entregador..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-none"
              />
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmittingRefusal}
                onClick={() => setShowRefusalModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!refusalReason || refusalNotes.trim().length < 5 || isSubmittingRefusal}
                onClick={handleConfirmRefusal}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingRefusal ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirmar Cancelamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DO VENDEDOR (RESPONSÁVEL) COM NOME, TELEFONE E AGENDA (SEM ABRIR LISTA DE USUÁRIOS) */}
      <SellerResponsibleModal
        isOpen={isSellerModalOpen}
        onClose={() => {
          setIsSellerModalOpen(false);
          setRouteSellerTarget(null);
        }}
        initialName={routeSellerTarget ? getRouteSeller(routeSellerTarget).name : responsibleName}
        initialPhone={routeSellerTarget ? getRouteSeller(routeSellerTarget).phone : responsiblePhone}
        clientName={customerName}
        clientPhone={customerPhone}
        onSave={handleSaveSellerResponsible}
      />

      {/* GAVETA / BOTTOM SHEET DE SELEÇÃO DE CLIENTE COM BUSCA EMBAIXO E FILTRAGEM */}
      <CustomerSelectorDrawer
        isOpen={isCustomerSelectorOpen}
        onClose={() => setIsCustomerSelectorOpen(false)}
        targetField={selectorTargetField}
        onSelectCustomer={handleSelectCustomer}
        onOpenRegistration={handleOpenRegistrationFromDrawer}
      />

      {/* TELA CHEIA DE CADASTRO DE CLIENTE (COM NOME, TELEFONE, CPF E LOCALIZAÇÃO OBRIGATÓRIOS) */}
      <CustomerFormFullScreen
        isOpen={isCustomerRegistrationOpen}
        onClose={() => setIsCustomerRegistrationOpen(false)}
        onSaveCustomer={handleSaveCustomerFromRegistration}
        initialData={registrationInitialData}
        selectedPlace={selectedPlace}
        targetFieldTitle={selectorTargetField === 'responsible' ? 'Vendedor (Responsável)' : 'Cliente'}
      />

      {/* MODAL / BOTTOM SHEET PARA DIRECIONAR ENCOMENDA PARA MOTORISTA */}
      <DriverSelectorModal
        isOpen={isDriverSelectorOpen}
        onClose={() => {
          setIsDriverSelectorOpen(false);
          setRouteDriverTarget(null);
        }}
        place={selectedPlace}
        onSelectDriver={routeDriverTarget ? handleSelectDriverForRoutePoint : handleSelectDriverForPlace}
        onRemoveDriver={routeDriverTarget ? handleRemoveDriverFromRoutePoint : handleRemoveDriverFromPlace}
        activeTelemetryDrivers={drivers}
        visibility={(isNewOrderDraft || (canManageDriverAssignment && routeDriverTarget)) ? (getRouteDriver(routeDriverTarget || activeRoutePoint).visibility === 'privado' ? 'privado' : 'publico') : undefined}
        onVisibilityChange={(isNewOrderDraft || (canManageDriverAssignment && routeDriverTarget)) ? handleDraftVisibilityChange : undefined}
      />

      {/* MODAL DA ETAPA FINAL COM TRAÇADO DA ROTA, PREÇOS DISCRIMINADOS E WHATSAPP */}
      {selectedPlace && canManageDriverAssignment && (
        <OrderFinalDetailsModal
          isOpen={isFinalDetailsOpen}
          onClose={() => setIsFinalDetailsOpen(false)}
          place={selectedPlace}
          readOnly={isDriverRole}
          onUpdatePlace={(updates) => updatePlaceDetails(selectedPlace.id, updates)}
        />
      )}
    </>);
};
