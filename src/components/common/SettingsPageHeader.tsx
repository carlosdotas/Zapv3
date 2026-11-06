import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface SettingsPageHeaderProps {
  onBack: () => void;
  title: React.ReactNode;
  description: React.ReactNode;
  children?: React.ReactNode;
}

export const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({ onBack, title, description, children }) => (
  <div className="sticky top-0 z-20 bg-[#F8F9FA]/95 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-200/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-slate-200/80 active:bg-slate-300 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
            title="Voltar para Configurações"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.3]" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">{title}</h1>
            <p className="text-[11px] text-slate-500 font-semibold">{description}</p>
          </div>
        </div>
        {children}
      </div>
);
