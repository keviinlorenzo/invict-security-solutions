import React, { useState, useMemo } from 'react';
import { Task, AreaType, GoogleCalendarEvent, UserPersona } from '../types';
import { User } from 'firebase/auth';
import {
  formatPeriodName,
  getAdjacentPeriod,
  DEFAULT_PERIOD,
  formatCurrentFullDate,
  getTodayDateString
} from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  CalendarCheck2,
  Sparkles,
  Filter,
  RefreshCw,
  Flame,
  UserCheck,
  Lock
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { InvictLogo } from './InvictLogo';

interface CalendarViewProps {
  tasks: Task[];
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  selectedArea: AreaType;
  onAreaChange: (area: AreaType) => void;
  onSelectTask: (task: Task) => void;
  onOpenNewTaskModal: (date?: string) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: any) => void;
  currentPersona: UserPersona;
  googleUser: User | null;
  isGoogleLoading: boolean;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  googleEvents: GoogleCalendarEvent[];
  onRefreshGoogleEvents: () => void;
  onRequestSyncTaskToGoogle: (task: Task) => void;
  onRequestSyncAllPeriodTasks: (tasksToSync: Task[]) => void;
}

export const AREA_CALENDAR_COLORS: Record<AreaType, {
  name: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
}> = {
  OPERACIONES: {
    name: 'Operaciones de Puestos',
    bg: 'bg-rose-950/40',
    border: 'border-rose-600/50',
    text: 'text-rose-300',
    dot: 'bg-rose-500',
    badge: 'bg-rose-900/60 text-rose-200 border-rose-700/50',
  },
  SUPERVISIÓN: {
    name: 'Supervisión Operativa Móvil',
    bg: 'bg-amber-950/40',
    border: 'border-amber-600/50',
    text: 'text-amber-300',
    dot: 'bg-amber-500',
    badge: 'bg-amber-900/60 text-amber-200 border-amber-700/50',
  },
  RRHH: {
    name: 'Recursos Humanos (RR.HH.)',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-600/50',
    text: 'text-emerald-300',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/50',
  },
  ADM: {
    name: 'Administración (ADM)',
    bg: 'bg-blue-950/40',
    border: 'border-blue-600/50',
    text: 'text-blue-300',
    dot: 'bg-blue-500',
    badge: 'bg-blue-900/60 text-blue-200 border-blue-700/50',
  },
  AUX_ADM: {
    name: 'Auxiliar Administrativo',
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-600/50',
    text: 'text-cyan-300',
    dot: 'bg-cyan-500',
    badge: 'bg-cyan-900/60 text-cyan-200 border-cyan-700/50',
  },
  SELECCION: {
    name: 'Selección & Reclutamiento',
    bg: 'bg-purple-950/40',
    border: 'border-purple-600/50',
    text: 'text-purple-300',
    dot: 'bg-purple-500',
    badge: 'bg-purple-900/60 text-purple-200 border-purple-700/50',
  },
  GERENCIA: {
    name: 'Gerencia General (C-Level)',
    bg: 'bg-amber-950/40',
    border: 'border-amber-600/50',
    text: 'text-amber-300',
    dot: 'bg-amber-500',
    badge: 'bg-amber-900/60 text-amber-200 border-amber-700/50',
  },
  TODOS: {
    name: 'Consolidado Global',
    bg: 'bg-slate-900/40',
    border: 'border-slate-700/50',
    text: 'text-slate-300',
    dot: 'bg-slate-500',
    badge: 'bg-slate-800 text-slate-200 border-slate-700',
  },
};

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  currentPeriod,
  onPeriodChange,
  selectedArea,
  onAreaChange,
  onSelectTask,
  onOpenNewTaskModal,
  onUpdateTaskStatus,
  currentPersona,
  googleUser,
  isGoogleLoading,
  onSignInGoogle,
  onSignOutGoogle,
  googleEvents,
  onRefreshGoogleEvents,
  onRequestSyncTaskToGoogle,
  onRequestSyncAllPeriodTasks,
}) => {
  const isGerencia = currentPersona.profileType === 'GERENTE';
  const todayStr = getTodayDateString();
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(todayStr);

  const [yearStr, monthStr] = (currentPeriod || DEFAULT_PERIOD).split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const { daysInMonth, startWeekdayOffset, prevMonthDays } = useMemo(() => {
    const days = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    return { daysInMonth: days, startWeekdayOffset: offset, prevMonthDays };
  }, [year, month]);

  const periodTasks = useMemo(() => {
    return tasks.filter(t => (t.monthPeriod || DEFAULT_PERIOD) === currentPeriod);
  }, [tasks, currentPeriod]);

  // Role-based filtering: Gerencia sees all or filtered by area; others see their department/assigned tasks
  const displayedTasks = useMemo(() => {
    if (isGerencia) {
      if (selectedArea === 'TODOS') return periodTasks;
      return periodTasks.filter(t => t.area === selectedArea);
    }
    return periodTasks.filter(t => {
      const matchDept = t.area === currentPersona.department;
      const matchAssignee = t.assignee?.toLowerCase() === currentPersona.name.toLowerCase();
      const matchEmail = t.assigneeEmail?.toLowerCase() === currentPersona.email.toLowerCase();
      return matchDept || matchAssignee || matchEmail;
    });
  }, [periodTasks, selectedArea, isGerencia, currentPersona]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    displayedTasks.forEach(task => {
      let dayKey = task.dueDate;
      if (!dayKey && task.startDate) dayKey = task.startDate;
      if (!dayKey) return;
      if (dayKey.includes('/')) {
        const parts = dayKey.split('/');
        dayKey = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(task);
    });
    return map;
  }, [displayedTasks]);

  const googleEventsByDay = useMemo(() => {
    const map: Record<string, GoogleCalendarEvent[]> = {};
    googleEvents.forEach(ev => {
      let dateKey = ev.start?.date || ev.start?.dateTime?.slice(0, 10);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    });
    return map;
  }, [googleEvents]);

  const calendarCells = useMemo(() => {
    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Leading days
    for (let i = startWeekdayOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevPeriod = getAdjacentPeriod(currentPeriod, -1);
      const [pY, pM] = prevPeriod.split('-');
      const dateStr = `${pY}-${pM}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing days
    const totalFilled = cells.length;
    const totalNeeded = totalFilled <= 35 ? 35 : 42;
    const nextDaysNeeded = totalNeeded - totalFilled;
    const nextPeriod = getAdjacentPeriod(currentPeriod, 1);
    const [nY, nM] = nextPeriod.split('-');
    for (let d = 1; d <= nextDaysNeeded; d++) {
      const dateStr = `${nY}-${nM}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [year, month, daysInMonth, startWeekdayOffset, prevMonthDays, currentPeriod, todayStr]);

  const selectedDayTasks = selectedDayDate ? (tasksByDay[selectedDayDate] || []) : [];
  const selectedDayGoogleEvents = selectedDayDate ? (googleEventsByDay[selectedDayDate] || []) : [];

  const areasList: { id: AreaType; label: string }[] = [
    { id: 'TODOS', label: 'Todos los Puestos' },
    { id: 'OPERACIONES', label: 'Operaciones' },
    { id: 'RRHH', label: 'RR.HH.' },
    { id: 'ADM', label: 'Administración' },
    { id: 'AUX_ADM', label: 'Auxiliar Adm.' },
    { id: 'SELECCION', label: 'Selección' },
    { id: 'GERENCIA', label: 'Gerencia' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Header Navigation */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-950/60 text-[#BE2629] border border-[#BE2629]/40 rounded">
              Planificación General de Tareas
            </span>
            <span className="text-xs text-slate-300 font-semibold">{formatPeriodName(currentPeriod)}</span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hoy: {formatCurrentFullDate()}</span>
            </span>

            {isGerencia ? (
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-950/80 text-red-300 border border-red-700/70 rounded-full flex items-center gap-1">
                <span>⭐ Vista Gerencial Total</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-700/70 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-400" />
                <span>Restringido a: {currentPersona.role}</span>
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <InvictLogo size="sm" variant="isotype" />
            <span>Calendario Operativo por Puestos</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {isGerencia
              ? 'Vista completa para Gerencia: visualice las tareas asignadas a cada día distinguidas por colores corporativos de puesto.'
              : `Panel de calendario para ${currentPersona.name} (${currentPersona.role}): mostrando exclusivamente las tareas programadas para su puesto.`}
          </p>
        </div>

        {/* Month Navigator & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#0b0e14] border border-[#232a3b] rounded-xl p-1">
            <button
              onClick={() => onPeriodChange(getAdjacentPeriod(currentPeriod, -1))}
              title="Mes anterior"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-white min-w-[130px] text-center select-none font-mono">
              {formatPeriodName(currentPeriod)}
            </span>
            <button
              onClick={() => onPeriodChange(getAdjacentPeriod(currentPeriod, 1))}
              title="Mes siguiente"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {currentPeriod !== DEFAULT_PERIOD && (
            <button
              onClick={() => onPeriodChange(DEFAULT_PERIOD)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#161c28] hover:bg-[#202737] border border-[#252f44] rounded-xl transition-colors cursor-pointer"
            >
              Mes Actual
            </button>
          )}

          <button
            onClick={() => onOpenNewTaskModal(selectedDayDate || todayStr)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#BE2629] hover:bg-[#a62b2e] rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Google Calendar Connection & Sync Bar */}
      <div className="p-4 bg-gradient-to-r from-[#111726] via-[#141b2a] to-[#111726] border border-[#243147] rounded-2xl shadow flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/50 text-blue-400 shrink-0">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Sincronización con Google Calendar</span>
              {googleUser && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                  Conectado Oficial
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {googleUser
                ? `Conectado como ${googleUser.email}. Los eventos se sincronizan con su Google Calendar corporativo.`
                : 'Conecte su cuenta de Google Calendar para reflejar eventos y sincronizar tareas operativas.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {googleUser && (
            <>
              <button
                onClick={() => onRequestSyncAllPeriodTasks(displayedTasks)}
                title="Sincronizar tareas a Google Calendar"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sincronizar a Google Calendar ({displayedTasks.length})</span>
              </button>
              <button
                onClick={onRefreshGoogleEvents}
                title="Actualizar eventos desde Google Calendar"
                className="p-1.5 rounded-xl bg-[#161c28] hover:bg-[#202737] border border-[#252f44] text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
          <GoogleSignInButton
            user={googleUser}
            isLoading={isGoogleLoading}
            onSignIn={onSignInGoogle}
            onSignOut={onSignOutGoogle}
          />
        </div>
      </div>

      {/* Area Color Legend & Filter */}
      {isGerencia ? (
        <div className="p-4 bg-[#121620] border border-[#22293b] rounded-2xl shadow space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Filter className="w-3.5 h-3.5 text-[#BE2629]" />
              <span>Código de Color por Puesto de Trabajo (Visibilidad Gerencial):</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Filtre por un puesto para aislar sus tareas en el calendario o vea el consolidado general
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {areasList.map((item) => {
              const isActive = selectedArea === item.id;
              const colorDef = AREA_CALENDAR_COLORS[item.id];
              const count = item.id === 'TODOS'
                ? periodTasks.length
                : periodTasks.filter(t => t.area === item.id).length;
              return (
                <button
                  key={item.id}
                  onClick={() => onAreaChange(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isActive
                      ? `${colorDef.bg} ${colorDef.border} ${colorDef.text} ring-2 ring-white/20 shadow-md`
                      : 'bg-[#0d1017] border-[#1e2536] text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${colorDef.dot} shrink-0`} />
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-300">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-[#121620] border border-blue-900/40 rounded-2xl shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-700/50 text-blue-400 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white block">
                Visualización Exclusiva del Puesto: {currentPersona.role} ({currentPersona.department})
              </span>
              <span className="text-slate-400 text-[11px]">
                Por política de seguridad y roles definida por Gerencia, usted solo puede visualizar y gestionar las tareas correspondientes a su puesto.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-800/60 shrink-0">
            Filtro de Seguridad Activo
          </span>
        </div>
      )}

      {/* Main Calendar View: Grid & Day Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-[#121620] border border-[#22293b] rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-[#22293b] bg-[#0c0e14] text-center py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            {WEEK_DAYS.map((dayName, idx) => (
              <div key={dayName} className={idx >= 5 ? 'text-amber-500/80' : ''}>
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden">{dayName.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-[#1e2537] bg-[#090b0f]">
            {calendarCells.map((cell) => {
              const dayTasks = tasksByDay[cell.dateStr] || [];
              const dayGoogleEvents = googleEventsByDay[cell.dateStr] || [];
              const isSelected = selectedDayDate === cell.dateStr;
              const hasUrgent = dayTasks.some(t => t.priority === 'Urgente' && t.status !== 'Completada');

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDayDate(cell.dateStr)}
                  className={`min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between group ${
                    !cell.isCurrentMonth ? 'bg-[#0a0d13]/50 opacity-40' : 'bg-[#0f131c]'
                  } ${
                    cell.isToday
                      ? 'ring-2 ring-[#BE2629] ring-inset bg-[#171116]/80'
                      : ''
                  } ${
                    isSelected
                      ? 'bg-[#182030] shadow-inner ring-1 ring-blue-500/50'
                      : 'hover:bg-[#151b27]'
                  }`}
                >
                  {/* Cell Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                        cell.isToday
                          ? 'bg-[#BE2629] text-white shadow-sm'
                          : (cell.isCurrentMonth ? 'text-slate-200' : 'text-slate-500')
                      }`}>
                        {cell.dayNumber}
                      </span>
                      {cell.isToday && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 hidden sm:inline">
                          Hoy
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasUrgent && (
                        <span title="Tarea urgente para este día">
                          <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                        </span>
                      )}
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#1b2333] text-slate-300 font-semibold border border-[#2b364e]">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tasks in Cell */}
                  <div className="space-y-1 flex-1 overflow-hidden my-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      const colorDef = AREA_CALENDAR_COLORS[task.area] || AREA_CALENDAR_COLORS['OPERACIONES'];
                      const isDone = task.status === 'Completada';
                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(task);
                          }}
                          title={`${task.title} (${task.assignee} - ${task.area})`}
                          className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded border transition-all truncate flex items-center gap-1 cursor-pointer ${
                            isDone
                              ? 'bg-slate-900/60 border-slate-700/50 text-slate-400 line-through'
                              : `${colorDef.bg} ${colorDef.border} ${colorDef.text} hover:scale-[1.02]`
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${colorDef.dot} shrink-0`} />
                          <span className="font-semibold shrink-0 uppercase text-[9px]">
                            {task.area === 'OPERACIONES' ? 'OP' : (task.area === 'AUX_ADM' ? 'AUX' : task.area)}:
                          </span>
                          <span className="truncate">{task.title}</span>
                          {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-auto" />}
                        </div>
                      );
                    })}

                    {dayGoogleEvents.slice(0, 1).map((ev) => (
                      <div
                        key={ev.id}
                        title={`Google Calendar: ${ev.summary}`}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-950/30 text-blue-300 truncate flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-[9px] font-bold uppercase text-blue-400">GCAL:</span>
                        <span className="truncate">{ev.summary}</span>
                      </div>
                    ))}

                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-slate-400 font-mono text-center">
                        +{dayTasks.length - 3} más...
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5 border-t border-white/5">
                    <span>{cell.dateStr === todayStr ? 'Día Actual' : ''}</span>
                    <span className="group-hover:text-blue-400 transition-colors">Ver →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Side Panel */}
        <div className="bg-[#121620] border border-[#22293b] rounded-2xl shadow-xl p-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#22293b] pb-3 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Detalle del Día
                </span>
                {selectedDayDate === todayStr && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#BE2629] text-white">
                    HOY
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mt-1 font-mono">
                {selectedDayDate || 'Seleccione una fecha'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedDayTasks.length} tarea{selectedDayTasks.length === 1 ? '' : 's'} asignada{selectedDayTasks.length === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {selectedDayTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <span>No hay tareas programadas para este día.</span>
                  <div className="mt-3">
                    <button
                      onClick={() => onOpenNewTaskModal(selectedDayDate || todayStr)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#BE2629] hover:brightness-110 rounded-xl transition-all cursor-pointer"
                    >
                      + Programar Tarea
                    </button>
                  </div>
                </div>
              ) : (
                selectedDayTasks.map((task) => {
                  const colorDef = AREA_CALENDAR_COLORS[task.area] || AREA_CALENDAR_COLORS['OPERACIONES'];
                  const isDone = task.status === 'Completada';
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 hover:brightness-110 ${colorDef.bg} ${colorDef.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${colorDef.badge}`}>
                          {colorDef.name}
                        </span>
                        <span className={`text-[10px] font-bold ${
                          task.priority === 'Urgente' ? 'text-red-400 animate-pulse' : 'text-slate-400'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                        {task.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-white/10">
                        <span>Resp: <strong className="text-white">{task.assignee}</strong></span>
                        <span className="text-[10px] font-mono text-slate-400">{task.status}</span>
                      </div>
                      {googleUser && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestSyncTaskToGoogle(task);
                            }}
                            className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <CalendarCheck2 className="w-3 h-3 text-blue-400" />
                            <span>{task.googleEventId ? 'Re-sincronizar' : 'Sincronizar a GCal'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#22293b] mt-3">
            <button
              onClick={() => onOpenNewTaskModal(selectedDayDate || todayStr)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#1a2336] hover:bg-[#222e46] border border-[#2b3a56] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#BE2629]" />
              <span>Añadir Tarea el {selectedDayDate || todayStr}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
