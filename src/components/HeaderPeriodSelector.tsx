import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Sparkles,
  Check,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import {
  formatPeriodName,
  getAdjacentPeriod,
  getAvailablePeriodsList,
  DEFAULT_PERIOD
} from '../utils/dateUtils';

interface HeaderPeriodSelectorProps {
  currentPeriod: string; // 'YYYY-MM'
  onPeriodChange: (newPeriod: string) => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export const HeaderPeriodSelector: React.FC<HeaderPeriodSelectorProps> = ({
  currentPeriod,
  onPeriodChange,
  onExportCSV,
  onExportPDF,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const availablePeriods = getAvailablePeriodsList();

  const handlePrev = () => {
    onPeriodChange(getAdjacentPeriod(currentPeriod, -1));
  };

  const handleNext = () => {
    onPeriodChange(getAdjacentPeriod(currentPeriod, 1));
  };

  const isCurrentMonth = currentPeriod === DEFAULT_PERIOD;
  const isPastMonth = currentPeriod < DEFAULT_PERIOD;
  const isFutureMonth = currentPeriod > DEFAULT_PERIOD;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Navigation Pill Container */}
      <div className="flex items-center bg-[#121622] border border-[#263147] hover:border-[#354360] rounded-xl p-0.5 sm:p-1 shadow-inner transition-colors">
        {/* Previous Month */}
        <button
          type="button"
          onClick={handlePrev}
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2333] transition-colors cursor-pointer"
          title="Mes Anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Current Month Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1c2333] rounded-lg transition-colors group cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-[#BE2629] shrink-0" />
          <span className="tracking-tight whitespace-nowrap">{formatPeriodName(currentPeriod)}</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Next Month */}
        <button
          type="button"
          onClick={handleNext}
          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2333] transition-colors cursor-pointer"
          title="Mes Siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Month Status indicator badge */}
      {!isCurrentMonth && (
        <button
          onClick={() => onPeriodChange(DEFAULT_PERIOD)}
          className={`hidden md:flex ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border items-center gap-1 hover:brightness-125 transition-all cursor-pointer ${
            isPastMonth
              ? 'bg-blue-950/70 text-blue-400 border-blue-800/60'
              : 'bg-purple-950/70 text-purple-400 border-purple-800/60'
          }`}
          title="Click para volver al mes actual"
        >
          {isPastMonth ? <Clock className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
          <span>{isPastMonth ? 'Histórico' : 'Futuro'} · Volver</span>
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-[#121622] border border-[#2a364e] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 pb-2 border-b border-[#222c3f] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Navegación Mensual
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Data Histórica</span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
            {availablePeriods.map((p) => {
              const isSelected = p.id === currentPeriod;
              const isDefault = p.id === DEFAULT_PERIOD;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPeriodChange(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#BE2629]/20 text-white font-bold border-l-2 border-[#BE2629]'
                      : 'text-slate-300 hover:bg-[#1a2130]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && <Check className="w-3 h-3 text-[#BE2629]" />}
                    <span>{p.label}</span>
                  </span>
                  {isDefault && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Actual
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Export options from Header */}
          {(onExportCSV || onExportPDF) && (
            <div className="pt-2 mt-1 border-t border-[#222c3f] px-2 flex items-center justify-between gap-1">
              {onExportCSV && (
                <button
                  type="button"
                  onClick={() => {
                    onExportCSV();
                    setIsOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-[#182030] hover:bg-[#222d42] text-[11px] font-semibold text-slate-200 border border-[#28354e] transition-colors cursor-pointer"
                  title="Exportar planilla del mes a CSV"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                  <span>CSV</span>
                </button>
              )}
              {onExportPDF && (
                <button
                  type="button"
                  onClick={() => {
                    onExportPDF();
                    setIsOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-[#BE2629]/20 hover:bg-[#BE2629]/30 text-[11px] font-semibold text-red-300 border border-[#BE2629]/40 transition-colors cursor-pointer"
                  title="Descargar informe oficial en PDF"
                >
                  <FileText className="w-3 h-3 text-red-400" />
                  <span>PDF</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
