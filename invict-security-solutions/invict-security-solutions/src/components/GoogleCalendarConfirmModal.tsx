import React from 'react';
import { Calendar, AlertTriangle, ShieldCheck, X, Check } from 'lucide-react';

interface GoogleCalendarConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  actionDescription: string;
  itemCount?: number;
  itemsList?: string[];
  dateInfo?: string;
  isDestructive?: boolean;
  userEmail?: string;
}

export const GoogleCalendarConfirmModal: React.FC<GoogleCalendarConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionDescription,
  itemCount,
  itemsList,
  dateInfo,
  isDestructive = false,
  userEmail,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#11151f] border border-[#2b354b] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 flex items-start justify-between border-b ${isDestructive ? 'bg-red-950/20 border-red-900/30' : 'bg-blue-950/20 border-blue-900/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isDestructive ? 'bg-red-900/30 border-red-700/50 text-red-400' : 'bg-blue-900/30 border-blue-700/50 text-blue-400'}`}>
              {isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Confirmación de Google Calendar
              </span>
              <h3 className="text-base font-bold text-white">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <p className="text-sm leading-relaxed text-slate-200">
            {actionDescription}
          </p>

          {userEmail && (
            <div className="flex items-center gap-2 p-2.5 bg-[#0b0e14] border border-[#222938] rounded-xl text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cuenta de Google destino: <strong className="text-white font-mono">{userEmail}</strong></span>
            </div>
          )}

          {dateInfo && (
            <div className="p-2.5 bg-[#161c28] border border-[#232d40] rounded-xl text-slate-300 flex items-center justify-between">
              <span className="text-slate-400">Fecha del evento:</span>
              <span className="font-semibold text-white">{dateInfo}</span>
            </div>
          )}

          {itemsList && itemsList.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Tareas afectadas ({itemCount ?? itemsList.length}):
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-[#0b0e14] p-2.5 rounded-xl border border-[#222938]">
                {itemsList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-300 text-xs py-1 border-b border-[#1b2232] last:border-b-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl text-[11px] text-amber-200/90 leading-tight flex items-start gap-2">
            <span className="text-amber-400 font-bold">Nota:</span>
            <span>Esta acción modificará su calendario oficial de Google Workspace. Puede consultar o editar los eventos en Google Calendar en cualquier momento.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0d1017] border-t border-[#22293b] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#252f44] border border-[#2b364e] rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Confirmar y Ejecutar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
