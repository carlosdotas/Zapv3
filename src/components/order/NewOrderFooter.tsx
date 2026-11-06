import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

type OrderStep = 1 | 2 | 3 | 4;

type NewOrderFooterProps = {
  currentStep: OrderStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<OrderStep>>;
  setIsNewOrderModalOpen: (open: boolean) => void;
  handleProceedToStep2: () => void;
  handleProceedToStep3: () => void;
  handleProceedToStep4: () => Promise<void>;
  handleFinalizeOrder: () => void;
};

export const NewOrderFooter: React.FC<NewOrderFooterProps> = ({
  currentStep,
  setCurrentStep,
  setIsNewOrderModalOpen,
  handleProceedToStep2,
  handleProceedToStep3,
  handleProceedToStep4,
  handleFinalizeOrder,
}) => (
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
);
