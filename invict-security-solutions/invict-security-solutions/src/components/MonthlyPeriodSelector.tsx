import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  formatPeriodName,
  getAdjacentPeriod,
  getAvailablePeriodsList,
  DEFAULT_PERIOD
} from '../utils/dateUtils';

interface MonthlyPeriodSelectorProps {
  currentPeriod: string; // 'YYYY-MM'
  onPeriodChange: (newPeriod: string) => void;
  onResetFixedTasks?: () => void;
  onExportPeriod?: () => void;
  totalTasksInPeriod?: number;
  fixedTasksCount?: number;
}

export const MonthlyPeriodSelector: React.FC<MonthlyPeriodSelectorProps> = ({
  currentPeriod,
  onPeriodChange,
  onResetFixedTasks,
  onExportPeriod,
  totalTasksInPeriod = 0,
  fixedTasksCount = 0,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const availablePeriods = getAvailablePeriodsList();

  const handlePrev = () => {
    onPeriodChange(getAdjacentPeriod(currentPeriod, -1));
  };

  const handleNext = () => {
    onPeriodChange(getAdjacentPeriod(currentPeriod, 1));
  };

  const isCurrentAppMonth = currentPeriod === DEFAULT_PERIOD;
  const isPastMonth = currentPeriod < DEFAULT_PERIOD;
  const isFutureMonth = currentPeriod > DEFAULT_PERIOD;

  return (
    <div className="bg-[#121620] border border-[#22293b] rounded-2xl p-3 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Left: Navigation and Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0b0c10] border border-[#242c3e] rounded-xl p-1">
          {/* Previous Month */}
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
            title="Mes Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Period Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-white hover:bg-[#1a2130] rounded-lg transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#BE2629]" />
              <span>{formatPeriodName(currentPeriod)}</span>
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-56 bg-[#121620] border border-[#2a3449] rounded-xl shadow-2xl py-1 z-50 max-h-72 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-[#22293b] text-[10px] uppercase font-bold text-slate-400">
                    Seleccionar Período Mensual
                  </div>
                  {availablePeriods.map(p => {
                    const isSelected = p.id === currentPeriod;
                    const isCurrent = p.id === DEFAULT_PERIOD;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onPeriodChange(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#1a2130] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#1a2130] text-[#BE2629] font-bold border-l-2 border-[#BE2629]' : 'text-slate-300'
                        }`}
                      >
                        <span>{p.label}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-mono">
                            Actual
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Next Month */}
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
            title="Mes Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Status Badge of Month */}
        <div className="flex items-center gap-1.5">
          {isCurrentAppMonth && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mes Activo</span>
            </span>
          )}
          {isPastMonth && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-950/50 text-blue-400 border border-blue-800/50 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Histórico</span>
            </span>
          )}
          {isFutureMonth && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-950/50 text-purple-400 border border-purple-800/50 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Proyección</span>
            </span>
          )}
          {!isCurrentAppMonth && (
            <button
              onClick={() => onPeriodChange(DEFAULT_PERIOD)}
              className="px-2.5 py-1 text-[11px] text-slate-300 hover:text-white bg-[#182030] hover:bg-[#202b40] rounded-xl border border-[#26334d] transition-colors cursor-pointer"
            >
              Volver al Mes Actual
            </button>
          )}
        </div>
      </div>

      {/* Right: Info and Actions */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#0b0c10] border border-[#22293b] rounded-xl text-xs text-slate-300">
          <Layers className="w-3.5 h-3.5 text-[#BE2629]" />
          <span>Planilla: <strong className="text-white">{totalTasksInPeriod}</strong> tareas</span>
          <span className="text-slate-400">·</span>
          <span className="text-cyan-400">⚡ {fixedTasksCount} fijas</span>
        </div>

        {onResetFixedTasks && (
          <button
            onClick={onResetFixedTasks}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#182030] hover:bg-[#222d42] border border-[#28354e] rounded-xl transition-colors active:scale-95 cursor-pointer"
            title="Mes a mes la planilla se renueva con las tareas fijas"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Renovar Fijas</span>
          </button>
        )}

        {onExportPeriod && (
          <button
            onClick={onExportPeriod}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#BE2629] hover:bg-[#a62c2f] rounded-xl shadow transition-colors active:scale-95 cursor-pointer"
            title="Exportar tareas y métricas de este mes a planilla CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        )}
      </div>
    </div>
  );
};
