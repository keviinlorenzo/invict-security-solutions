import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Task, AreaType, GoogleCalendarEvent } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  CalendarCheck2,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { formatPeriodName } from '../utils/dateUtils';
import { AREA_CALENDAR_COLORS } from './CalendarView';

interface GoogleCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  currentPeriod: string;
  googleUser: User | null;
  isGoogleLoading: boolean;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onConfirmSyncTasks: (tasks: Task[]) => void;
  googleEvents: GoogleCalendarEvent[];
  onRefreshGoogleEvents: () => void;
}

export const GoogleCalendarSyncModal: React.FC<GoogleCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  tasks,
  currentPeriod,
  googleUser,
  isGoogleLoading,
  onSignInGoogle,
  onSignOutGoogle,
  onConfirmSyncTasks,
}) => {
  const [filterArea, setFilterArea] = useState<AreaType>('TODOS');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [initializedSelection, setInitializedSelection] = useState(false);

  const periodTasks = tasks.filter(t => (t.monthPeriod || '2026-10') === currentPeriod);

  React.useEffect(() => {
    if (isOpen && !initializedSelection) {
      setSelectedTaskIds(periodTasks.map(t => t.id));
      setInitializedSelection(true);
    }
    if (!isOpen) {
      setInitializedSelection(false);
    }
  }, [isOpen, periodTasks, initializedSelection]);

  if (!isOpen) return null;

  const filteredTasks = filterArea === 'TODOS'
    ? periodTasks
    : periodTasks.filter(t => t.area === filterArea);

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedTaskIds(filteredTasks.map(t => t.id));
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds([]);
  };

  const tasksToSync = periodTasks.filter(t => selectedTaskIds.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#11151f] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-center justify-between border-b border-[#222b3e] bg-[#0c0f16]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Google Workspace Integration
              </span>
              <h3 className="text-base font-bold text-white">
                Sincronización con Google Calendar
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

        <div className="p-5 border-b border-[#222b3e] bg-[#141a27] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                {googleUser ? 'Cuenta de Google Conectada' : 'No conectado a Google Calendar'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {googleUser
                ? `Los eventos se crearán en el calendario principal de ${googleUser.email}.`
                : 'Inicie sesión con su cuenta corporativa de Google para sincronizar tareas operativas.'}
            </p>
          </div>
          <div className="shrink-0">
            <GoogleSignInButton
              user={googleUser}
              isLoading={isGoogleLoading}
              onSignIn={onSignInGoogle}
              onSignOut={onSignOutGoogle}
            />
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-200">
                Seleccione las tareas de {formatPeriodName(currentPeriod)} a sincronizar
              </h4>
              <span className="text-[11px] text-slate-400">
                {tasksToSync.length} seleccionadas de {periodTasks.length} disponibles
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#1a2233] hover:bg-[#242f44] rounded-lg transition-colors cursor-pointer"
              >
                Seleccionar Todas
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-[#1a2233] hover:bg-[#242f44] rounded-lg transition-colors cursor-pointer"
              >
                Deseleccionar
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredTasks.map((task) => {
              const isChecked = selectedTaskIds.includes(task.id);
              const colorDef = AREA_CALENDAR_COLORS[task.area] || AREA_CALENDAR_COLORS['OPERACIONES'];
              return (
                <div
                  key={task.id}
                  onClick={() => toggleSelectTask(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-[#151c2a] border-blue-500/50 shadow-sm'
                      : 'bg-[#0e121a] border-[#202738] opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-[#2e3b52] bg-[#0c0f16] text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${colorDef.badge}`}>
                          {task.area}
                        </span>
                        <span className="font-semibold text-white truncate text-xs">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>Resp: <strong className="text-slate-300">{task.assignee}</strong></span>
                        <span>·</span>
                        <span>Vence: <strong className="text-slate-300">{task.dueDate}</strong></span>
                      </div>
                    </div>
                  </div>
                  {task.status === 'Completada' && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                      <CheckCircle2 className="w-3 h-3" />
                      Completada
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-[#0d1017] border-t border-[#22293b] flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {googleUser
              ? 'Se abrirá un diálogo de confirmación antes de guardar los eventos.'
              : 'Debe iniciar sesión con Google para sincronizar.'}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#252f44] border border-[#2b364e] rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              disabled={!googleUser || tasksToSync.length === 0}
              onClick={() => {
                onConfirmSyncTasks(tasksToSync);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Sincronizar ({tasksToSync.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
