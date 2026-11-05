import React, { useState } from 'react';
import { Task, AreaType, TaskStatus, TaskNature, UserPersona, TaskModification, ShiftType } from '../types';
import {
  Table,
  Kanban,
  Search,
  Plus,
  Filter,
  MessageSquare,
  Check,
  Clock,
  AlertTriangle,
  Download,
  Users,
  Briefcase,
  FileCheck,
  Headphones,
  ShieldAlert,
  Layers,
  CheckCircle2,
  Repeat,
  Zap,
  Trash2,
  FileText,
  Cloud,
  MapPin,
  Calendar,
  CheckSquare,
  Shield,
  Eye,
  EyeOff,
  User,
  Smartphone,
  Crown
} from 'lucide-react';
import { calculateDaysRemaining, formatDateLocale, formatPeriodName } from '../utils/dateUtils';
import { getDayOfWeekLabel, getDayOfWeekFromDateString, isMonthlyTaskStoppedForPeriod } from '../utils/monthRenewalService';
import { exportTasksToCSV } from '../utils/exportUtils';
import { exportTasksToPDF } from '../utils/pdfExportUtils';
import { MonthlyPeriodSelector } from './MonthlyPeriodSelector';
import { CloudFileSyncBar } from './CloudFileSyncBar';

interface TasksMatrixViewProps {
  tasks: Task[];
  selectedArea: AreaType;
  onAreaChange: (area: AreaType) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTaskModal: () => void;
  onDeleteTask?: (taskId: string) => void;
  globalSearchTerm: string;
  currentPersona?: UserPersona;
  allPersonas?: UserPersona[];
  lastModification?: TaskModification | null;
  onOpenAuditHistory?: () => void;
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  onResetFixedTasks?: () => void;
  onRenewWeeklyNextMonth?: () => void;
  onToggleWeeklyRecurrence?: (task: Task, stopRecurrence: boolean) => void;
  onToggleMonthlyRecurrence?: (task: Task, stopRecurrence: boolean) => void;
  onClearMonth?: () => void;
  onExportPeriod?: () => void;
  onOpenAdminSheets?: () => void;
}

interface PostTabDef {
  id: AreaType;
  label: string;
  shortLabel: string;
  officer: string;
  icon: React.ReactNode;
  description: string;
  badgeClass: string;
}

export const TasksMatrixView: React.FC<TasksMatrixViewProps> = ({
  tasks,
  selectedArea,
  onAreaChange,
  onSelectTask,
  onUpdateTaskStatus,
  onOpenNewTaskModal,
  onDeleteTask,
  globalSearchTerm,
  currentPersona,
  allPersonas,
  lastModification,
  onOpenAuditHistory,
  currentPeriod,
  onPeriodChange,
  onResetFixedTasks,
  onRenewWeeklyNextMonth,
  onToggleWeeklyRecurrence,
  onToggleMonthlyRecurrence,
  onClearMonth,
  onExportPeriod,
  onOpenAdminSheets,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [mobileLayout, setMobileLayout] = useState<'cards' | 'table'>('cards');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'SOLO_PENDIENTES' | TaskStatus>('TODOS');
  const [natureFilter, setNatureFilter] = useState<'TODAS' | TaskNature>('TODAS');
  const [deadlineQuickFilter, setDeadlineQuickFilter] = useState<'TODAS' | 'HOY' | '48HS' | 'VENCIDAS'>('TODAS');
  const [localSearch, setLocalSearch] = useState('');
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    return localStorage.getItem('invict_hide_completed') === 'true';
  });

  const toggleHideCompleted = () => {
    setHideCompleted(prev => {
      const next = !prev;
      localStorage.setItem('invict_hide_completed', String(next));
      if (next && statusFilter === 'Completada') {
        setStatusFilter('TODOS');
      }
      return next;
    });
  };

  const handleStatusFilterChange = (newStatus: 'TODOS' | 'SOLO_PENDIENTES' | TaskStatus) => {
    setStatusFilter(newStatus);
    if (newStatus === 'SOLO_PENDIENTES') {
      setHideCompleted(true);
      localStorage.setItem('invict_hide_completed', 'true');
    } else if (newStatus === 'Completada') {
      setHideCompleted(false);
      localStorage.setItem('invict_hide_completed', 'false');
    }
  };

  const isGerencia = Boolean(
    currentPersona && (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE')
  );
  const isSubGerencia = Boolean(
    currentPersona && (currentPersona.department === 'SUB_GERENCIA' || currentPersona.profileType === 'SUB_GERENTE')
  );

  // Helper to dynamically compute current assigned officers from allPersonas so any change by Gerencia is reflected immediately
  const getOfficersForArea = (area: AreaType, fallback: string): string => {
    if (!allPersonas || allPersonas.length === 0) return fallback;
    if (area === 'TODOS') return isGerencia ? 'Gerencia General & Auditoría Integral' : isSubGerencia ? 'Sub Gerencia & Supervisión Integral' : 'Coordinación General de Oficina';
    const matching = allPersonas.filter(p => p.department === area);
    if (matching.length > 0) {
      return matching.map(p => p.name).join(' / ');
    }
    return fallback;
  };

  const postTabs: PostTabDef[] = [
    ...(isGerencia
      ? [
          {
            id: 'GERENCIA' as AreaType,
            label: 'Gerencia General (Privado)',
            shortLabel: 'GERENCIA',
            officer: getOfficersForArea('GERENCIA', 'Yamila / Domingo'),
            icon: <Shield className="w-4 h-4 text-amber-400" />,
            description: 'Tareas estratégicas, confidenciales y de dirección exclusivas del sector de Gerencia General.',
            badgeClass: 'text-amber-300 bg-amber-950/70 border-amber-700/70',
          },
        ]
      : []),
    {
      id: 'SUB_GERENCIA' as AreaType,
      label: 'Sub Gerencia / Vicepresidencia',
      shortLabel: 'SUB GERENCIA',
      officer: getOfficersForArea('SUB_GERENCIA', 'Laura'),
      icon: <Crown className="w-4 h-4 text-rose-400" />,
      description: 'Supervisión transversal, control de gestión y apoyo a la dirección ejecutiva.',
      badgeClass: 'text-rose-300 bg-rose-950/70 border-rose-600/70',
    },
    {
      id: 'OPERACIONES',
      label: 'Operaciones & Logística',
      shortLabel: 'OPERACIONES',
      officer: getOfficersForArea('OPERACIONES', 'Kevin / Supervisores'),
      icon: <ShieldAlert className="w-4 h-4" />,
      description: 'Coordinación de servicios, logística interna, supervisión y seguimiento de tareas de la empresa.',
      badgeClass: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
    },
    {
      id: 'RRHH',
      label: 'Recursos Humanos',
      shortLabel: 'RR.HH.',
      officer: getOfficersForArea('RRHH', 'Pilar'),
      icon: <Users className="w-4 h-4" />,
      description: 'Gestión de personal, legajos de colaboradores, altas/bajas, licencias, sanciones y cumplimiento laboral.',
      badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
    },
    {
      id: 'ADM',
      label: 'Administración',
      shortLabel: 'ADM',
      officer: getOfficersForArea('ADM', 'Giuliana'),
      icon: <Briefcase className="w-4 h-4" />,
      description: 'Facturación a clientes, cuentas por pagar a proveedores, rendición de egresos, pagos y vencimientos impositivos.',
      badgeClass: 'text-blue-400 bg-blue-950/60 border-blue-800/60',
    },
    {
      id: 'AUX_ADM',
      label: 'Auxiliar Administrativo',
      shortLabel: 'AUX ADM',
      officer: getOfficersForArea('AUX_ADM', 'Kevin'),
      icon: <FileCheck className="w-4 h-4" />,
      description: 'Archivo físico de legajos y expedientes, trámites bancarios, compra de insumos de oficina y caja chica.',
      badgeClass: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
    },
    {
      id: 'SELECCION',
      label: 'Selección de Personal',
      shortLabel: 'SELECCIÓN',
      officer: getOfficersForArea('SELECCION', 'Mariana'),
      icon: <Headphones className="w-4 h-4" />,
      description: 'Búsquedas y convocatorias de personal, entrevistas presenciales, psicotécnicos y altas administrativas.',
      badgeClass: 'text-purple-400 bg-purple-950/60 border-purple-800/60',
    },
    {
      id: 'TODOS',
      label: isGerencia ? 'Vista Consolidada (Auditoría C-Level)' : 'Vista Consolidada (Oficina)',
      shortLabel: 'Consolidado',
      officer: getOfficersForArea('TODOS', isGerencia ? 'Dirección General (C-Level)' : 'Áreas Operativas y Administrativas'),
      icon: <Layers className="w-4 h-4" />,
      description: 'Auditoría integral cruzada de todas las áreas y puestos de trabajo de la oficina central.',
      badgeClass: 'text-red-400 bg-red-950/60 border-red-800/60',
    },
  ];

  const activeTabId = (!isGerencia && selectedArea === 'GERENCIA') ? (isSubGerencia ? 'SUB_GERENCIA' : 'OPERACIONES') : (selectedArea || 'OPERACIONES');
  const activeTabDef = postTabs.find(p => p.id === activeTabId) || postTabs[0];
  const effectiveSearch = (globalSearchTerm || localSearch).toLowerCase().trim();

  // Tasks of the selected period (defense-in-depth: never include GERENCIA tasks for non-Gerencia users)
  const periodTasks = tasks.filter(t => {
    if (!isGerencia && t.area === 'GERENCIA') return false;
    if (t.dueDate && t.dueDate.startsWith(currentPeriod)) return true;
    return (t.monthPeriod || '2026-10') === currentPeriod;
  });

  // Number of completed tasks in active tab
  const completedInActiveTab = periodTasks.filter(t => {
    if (activeTabId !== 'TODOS' && t.area !== activeTabId) return false;
    return t.status === 'Completada';
  }).length;

  const isFilteringOutCompleted = (hideCompleted || statusFilter === 'SOLO_PENDIENTES') && statusFilter !== 'Completada';

  // Filter tasks strictly by the active post tab, period, and deadline
  const filteredTasks = periodTasks.filter((t) => {
    if (activeTabId !== 'TODOS' && t.area !== activeTabId) return false;

    // Quick filter: hide completed tasks for a cleaner real-time backlog view
    if (isFilteringOutCompleted && t.status === 'Completada') {
      return false;
    }

    if (statusFilter !== 'TODOS' && statusFilter !== 'SOLO_PENDIENTES' && t.status !== statusFilter) {
      return false;
    }

    if (natureFilter !== 'TODAS' && (t.nature || 'Fija Mensual') !== natureFilter) return false;

    if (deadlineQuickFilter !== 'TODAS') {
      const { days, status } = calculateDaysRemaining(t.dueDate, t.completedDate);
      if (deadlineQuickFilter === 'HOY' && days !== 0) return false;
      if (deadlineQuickFilter === '48HS' && (days < 0 || days > 2)) return false;
      if (deadlineQuickFilter === 'VENCIDAS' && status !== 'vencida') return false;
    }

    if (effectiveSearch) {
      const matchTitle = t.title.toLowerCase().includes(effectiveSearch);
      const matchAssignee = t.assignee.toLowerCase().includes(effectiveSearch);
      const matchNotes = (t.notes || '').toLowerCase().includes(effectiveSearch);
      const matchCategory = (t.category || '').toLowerCase().includes(effectiveSearch);
      return matchTitle || matchAssignee || matchNotes || matchCategory;
    }
    return true;
  });

  const renderNatureBadge = (nature?: TaskNature, task?: Task) => {
    const val = nature || 'Fija Mensual';
    if (val === 'Fija Semanal') {
      const dayLabel = getDayOfWeekLabel(
        task?.weeklyDayOfWeek !== undefined
          ? task.weeklyDayOfWeek
          : task?.dueDate
          ? getDayOfWeekFromDateString(task.dueDate)
          : undefined
      );
      const weekStr = task?.weekNumberInMonth ? ` · Sem. ${task.weekNumberInMonth}` : '';
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
            task?.weeklyRecurrenceStopped
              ? 'bg-slate-900/80 text-slate-400 border-slate-700'
              : 'bg-purple-950/80 text-purple-300 border-purple-700/70'
          }`}
        >
          <Repeat className="w-3 h-3 text-purple-400" />
          <span>
            Fija Semanal{weekStr} ({dayLabel}){task?.weeklyRecurrenceStopped ? ' · Pausada' : ''}
          </span>
        </span>
      );
    }
    if (val === 'Fija Mensual') {
      const isStopped = Boolean(
        task &&
          (task.monthlyRecurrenceStopped ||
            isMonthlyTaskStoppedForPeriod(task.area, task.title, task.monthPeriod || currentPeriod, tasks))
      );
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
            isStopped
              ? 'bg-slate-900/80 text-slate-400 border-slate-700'
              : 'bg-cyan-950/70 text-cyan-400 border-cyan-800/60'
          }`}
        >
          <Repeat className={`w-3 h-3 ${isStopped ? 'text-slate-500' : 'text-cyan-400'}`} />
          <span>{isStopped ? 'Fija Mensual · Sin Repetición' : 'Fija Mensual'}</span>
        </span>
      );
    }
    if (val === 'Imprevisto') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/80 whitespace-nowrap">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Imprevisto</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-950/50 text-blue-300 border border-blue-800/50 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3 text-blue-400" />
        <span>Variable</span>
      </span>
    );
  };

  const renderShiftBadge = (shift?: ShiftType) => {
    const val = shift || 'General';
    const shiftStyles: Record<ShiftType, string> = {
      Mañana: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
      Tarde: 'bg-orange-950/60 text-orange-300 border-orange-800/50',
      Noche: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50',
      Rotativo: 'bg-purple-950/60 text-purple-300 border-purple-800/50',
      '24hs': 'bg-red-950/60 text-red-300 border-red-800/50',
      General: 'bg-slate-900/60 text-slate-300 border-slate-700/50',
    };
    return (
      <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${shiftStyles[val]} whitespace-nowrap`}>
        {val}
      </span>
    );
  };

  const getTabStats = (areaId: AreaType) => {
    const areaTasks = areaId === 'TODOS' ? periodTasks : periodTasks.filter(t => t.area === areaId);
    const total = areaTasks.length;
    const completed = areaTasks.filter(t => t.status === 'Completada').length;
    const pending = total - completed;
    const urgentOrOverdue = areaTasks.filter(t => {
      if (t.status === 'Completada') return false;
      const { days, status } = calculateDaysRemaining(t.dueDate, t.completedDate);
      return days <= 1 || status === 'vencida';
    }).length;
    return { total, completed, pending, urgentOrOverdue };
  };

  const kanbanColumns: TaskStatus[] = [
    'No iniciada',
    'En curso',
    'Completada',
    'Urgente/Prioritaria',
  ];

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `INVICT_Tareas_${activeTabDef.shortLabel.replace(/[\s./]+/g, '_')}_${dateStr}.csv`;
    exportTasksToCSV(filteredTasks, fileName);
  };

  const handleExportPDF = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `INVICT_Tareas_${activeTabDef.shortLabel.replace(/[\s./]+/g, '_')}_${dateStr}.pdf`;
    exportTasksToPDF(filteredTasks, fileName);
  };

  const handleCycleStatus = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const cycleMap: Record<TaskStatus, TaskStatus> = {
      'No iniciada': 'En curso',
      'En curso': 'Completada',
      'Completada': 'No iniciada',
      'Urgente/Prioritaria': 'Completada',
    };
    onUpdateTaskStatus(task.id, cycleMap[task.status]);
  };

  const activeStats = getTabStats(activeTabId);
  const fixedTasksInThisPeriod = periodTasks.filter(t => (t.nature || 'Fija Mensual') === 'Fija Mensual');
  const weeklyTasksInThisPeriod = periodTasks.filter(t => t.nature === 'Fija Semanal');

  return (
    <div className="space-y-4">
      {/* Cloud Synchronized Workspace Status */}
      {currentPersona && (
        <CloudFileSyncBar
          currentUser={currentPersona}
          allPersonas={allPersonas || []}
          lastModification={lastModification}
          onOpenAuditHistory={onOpenAuditHistory || (() => {})}
        />
      )}

      {/* Period Navigator */}
      <MonthlyPeriodSelector
        currentPeriod={currentPeriod}
        onPeriodChange={onPeriodChange}
        onResetFixedTasks={onResetFixedTasks}
        onRenewWeeklyNextMonth={onRenewWeeklyNextMonth}
        onClearMonth={onClearMonth}
        onExportPeriod={onExportPeriod}
        totalTasksInPeriod={periodTasks.length}
        fixedTasksCount={fixedTasksInThisPeriod.length}
        weeklyFixedCount={weeklyTasksInThisPeriod.length}
      />

      {/* 1. Primary Post Navigation Tabs */}
      <div className="bg-[#121620] border border-[#22293b] rounded-2xl p-2.5 shadow-lg">
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 border-b border-[#1f2638]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Áreas y Puestos de Oficina
            </span>
            <span className="text-[10px] text-slate-400">
              ({formatPeriodName(currentPeriod)})
            </span>
          </div>
          {currentPersona && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Tu puesto asignado:</span>
              <span className="font-semibold text-white px-2 py-0.5 rounded bg-[#1a2130] border border-[#2a3449]">
                {currentPersona.department} ({currentPersona.role})
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {postTabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const stats = getTabStats(tab.id);
            const isUserDepartment = currentPersona?.department === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onAreaChange(tab.id)}
                className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#BE2629] text-white border-[#BE2629] shadow-md scale-[1.01]'
                    : 'bg-[#151a24] hover:bg-[#1a2130] text-slate-300 border-[#222a3a] hover:border-[#303c54]'
                }`}
              >
                <div className={`p-1 rounded ${isActive ? 'bg-white/20 text-white' : 'text-slate-400'}`}>
                  {tab.icon}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span>{tab.shortLabel}</span>
                    {isUserDepartment && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isActive ? 'bg-white/30 text-white' : 'bg-blue-900/60 text-blue-300'
                      }`}>
                        Mi Puesto
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-normal truncate max-w-[120px] ${
                    isActive ? 'text-red-100' : 'text-slate-400'
                  }`}>
                    {tab.officer}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-1">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-black/30 text-white'
                      : 'bg-[#1d2535] text-slate-300'
                  }`}>
                    {stats.pending}
                  </span>
                  {stats.urgentOrOverdue > 0 && (
                    <span
                      title={`${stats.urgentOrOverdue} tareas vencidas o en <24hs`}
                      className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-[#BE2629]'
                          : 'bg-red-600 text-white animate-pulse'
                      }`}
                    >
                      !
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Active Post Banner */}
      <div className="p-4 bg-gradient-to-r from-[#141824] via-[#161c2b] to-[#141824] border border-[#242e42] rounded-2xl shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30 mt-0.5 shrink-0">
            {activeTabDef.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${activeTabDef.badgeClass}`}>
                Puesto: {activeTabDef.label}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Responsable Habitual: <strong className="text-white">{activeTabDef.officer}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              {activeTabDef.description}
            </p>
          </div>
        </div>

        {/* Post Quick KPIs */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          <div className="px-3 py-1.5 bg-[#0e121a] border border-[#202737] rounded-xl text-center min-w-[70px]">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Total</span>
            <span className="text-sm font-bold text-white font-mono">{activeStats.total}</span>
          </div>
          <div
            onClick={toggleHideCompleted}
            title={
              isFilteringOutCompleted
                ? `Filtro activo: ${activeStats.completed} completadas ocultas. Clic para mostrarlas.`
                : `Clic para ocultar las ${activeStats.completed} tareas completadas y ver solo lo pendiente.`
            }
            className={`px-3 py-1.5 border rounded-xl text-center min-w-[75px] cursor-pointer transition-all group ${
              isFilteringOutCompleted
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
                : 'bg-[#0e121a] border-[#202737] hover:border-emerald-700/60'
            }`}
          >
            <div className="text-[10px] text-emerald-400 font-mono uppercase flex items-center justify-center gap-1">
              <span>Listas</span>
              {isFilteringOutCompleted ? (
                <EyeOff className="w-2.5 h-2.5 text-emerald-300" />
              ) : (
                <Eye className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
              )}
            </div>
            <span className="text-sm font-bold text-emerald-400 font-mono">{activeStats.completed}</span>
            <span className="text-[9px] text-slate-400 block -mt-0.5">
              {isFilteringOutCompleted ? 'Ocultas' : 'Visibles'}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-[#0e121a] border border-[#202737] rounded-xl text-center min-w-[70px]">
            <span className="text-[10px] text-amber-400 block uppercase font-mono">En Curso</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{activeStats.pending}</span>
          </div>
          {activeStats.urgentOrOverdue > 0 && (
            <div className="px-3 py-1.5 bg-red-950/40 border border-red-800/60 rounded-xl text-center min-w-[70px]">
              <span className="text-[10px] text-red-400 block uppercase font-mono">Vencidas</span>
              <span className="text-sm font-bold text-red-400 font-mono animate-pulse">{activeStats.urgentOrOverdue}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Comprehensive Control Toolbar with Shift, Deadline and Status Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-[#1a2130] rounded-xl border border-[#263044]">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#BE2629] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Matriz Detallada</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#BE2629] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Tablero Kanban</span>
            </button>
          </div>

          {/* Mobile Layout Switcher (Tarjetas vs Tabla en Celulares) */}
          {viewMode === 'table' && (
            <div className="flex md:hidden items-center bg-[#161b26] border border-[#263044] rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setMobileLayout('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mobileLayout === 'cards' ? 'bg-[#BE2629] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                📱 Tarjetas
              </button>
              <button
                type="button"
                onClick={() => setMobileLayout('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mobileLayout === 'table' ? 'bg-[#BE2629] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                💻 Tabla
              </button>
            </div>
          )}

          {/* Quick Deadline Selector */}
          <div className="flex items-center gap-1 bg-[#161b26] border border-[#263044] rounded-xl px-2 py-1 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold">Plazo:</span>
            <button
              onClick={() => setDeadlineQuickFilter('TODAS')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                deadlineQuickFilter === 'TODAS'
                  ? 'bg-[#BE2629] text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setDeadlineQuickFilter('HOY')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                deadlineQuickFilter === 'HOY'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              Vence Hoy
            </button>
            <button
              onClick={() => setDeadlineQuickFilter('48HS')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                deadlineQuickFilter === '48HS'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              ≤ 48hs
            </button>
            <button
              onClick={() => setDeadlineQuickFilter('VENCIDAS')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                deadlineQuickFilter === 'VENCIDAS'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-red-400 hover:text-red-300'
              }`}
            >
              Vencidas
            </button>
          </div>

          {/* Quick Filter: Ocultar / Mostrar Completadas */}
          <button
            onClick={toggleHideCompleted}
            title={
              isFilteringOutCompleted
                ? `Mostrar ${completedInActiveTab} tareas completadas`
                : `Ocultar ${completedInActiveTab} tareas completadas para ver solo el trabajo pendiente en tiempo real`
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isFilteringOutCompleted
                ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-900/80 shadow-sm'
                : 'bg-[#161b26] border-[#263044] text-slate-300 hover:text-white hover:bg-[#1f2636] hover:border-[#38435d]'
            }`}
          >
            {isFilteringOutCompleted ? (
              <EyeOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span>{isFilteringOutCompleted ? 'Ocultando Completadas' : 'Ocultar Completadas'}</span>
            {completedInActiveTab > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isFilteringOutCompleted
                    ? 'bg-emerald-400 text-black'
                    : 'bg-[#22293b] text-slate-400'
                }`}
              >
                {completedInActiveTab}
              </span>
            )}
          </button>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#161b26] border border-[#263044] rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400 font-semibold">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as any)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-[#121620]">Todos los Estados</option>
              <option value="SOLO_PENDIENTES" className="bg-[#121620]">⚡ Solo Pendientes (Ocultar listas)</option>
              <option value="No iniciada" className="bg-[#121620]">No iniciada</option>
              <option value="En curso" className="bg-[#121620]">En curso</option>
              <option value="Urgente/Prioritaria" className="bg-[#121620]">Urgente/Prioritaria</option>
              <option value="Completada" className="bg-[#121620]">Solo Completadas</option>
            </select>
          </div>
        </div>

        {/* Right Actions: Local Search, CSV, PDF and Add */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={`Buscar en ${activeTabDef.shortLabel}...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#161b26] border border-[#263044] rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629]"
            />
          </div>

          <button
            onClick={handleExportCSV}
            title={`Exportar ${filteredTasks.length} tareas a archivo CSV`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#242d40] border border-[#2a3449] rounded-xl transition-colors whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            title={`Exportar ${filteredTasks.length} tareas a documento oficial en PDF`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#242d40] border border-[#2a3449] rounded-xl transition-colors whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 rounded-xl shadow-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Status Bar (Workflow Presets) */}
      {onOpenAdminSheets && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-[#121a2b] via-[#152036] to-[#121a2b] border border-blue-800/50 rounded-xl text-xs shadow">
          <div className="flex items-center gap-2 text-slate-200">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Planillas Informativas de Administración:</strong> Consulta o actualiza <em>Personal Sin DISEP</em> y <em>Personal que Debe Uniforme</em> (no afectan métricas de tareas).
            </span>
          </div>
          <button
            onClick={onOpenAdminSheets}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shrink-0 shadow"
          >
            Abrir Planillas Informativas →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#10141d] border border-[#1e2536] rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filtro Rápido:</span>
          </span>
          <button
            onClick={() => {
              setHideCompleted(false);
              localStorage.setItem('invict_hide_completed', 'false');
              setStatusFilter('TODOS');
              setDeadlineQuickFilter('TODAS');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isFilteringOutCompleted && statusFilter === 'TODOS' && deadlineQuickFilter === 'TODAS'
                ? 'bg-[#BE2629] text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-white hover:bg-[#181e2c]'
            }`}
          >
            Todas ({activeStats.total})
          </button>
          <button
            onClick={() => {
              setHideCompleted(true);
              localStorage.setItem('invict_hide_completed', 'true');
              setStatusFilter('TODOS');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isFilteringOutCompleted
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold shadow-sm'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-[#181e2c]'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            <span>Solo Pendientes ({activeStats.pending})</span>
          </button>
          <button
            onClick={() => {
              setDeadlineQuickFilter(deadlineQuickFilter === 'VENCIDAS' ? 'TODAS' : 'VENCIDAS');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              deadlineQuickFilter === 'VENCIDAS'
                ? 'bg-red-950 text-red-300 border border-red-700/60 font-bold shadow-sm'
                : 'text-slate-400 hover:text-red-300 hover:bg-[#181e2c]'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Vencidas / En Riesgo ({activeStats.urgentOrOverdue})</span>
          </button>
          <button
            onClick={() => {
              setHideCompleted(false);
              localStorage.setItem('invict_hide_completed', 'false');
              setStatusFilter('Completada');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'Completada'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-[#181e2c]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Solo Completadas ({activeStats.completed})</span>
          </button>
        </div>

        {/* Counter of tasks currently visible */}
        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 ml-auto">
          <span>Mostrando: <strong className="text-white">{filteredTasks.length}</strong> de {activeStats.total}</span>
          {isFilteringOutCompleted && completedInActiveTab > 0 && (
            <span className="text-emerald-400 font-semibold">({completedInActiveTab} completadas ocultas)</span>
          )}
        </div>
      </div>

      {/* Clean Mode Informative Banner when completed tasks are hidden */}
      {isFilteringOutCompleted && completedInActiveTab > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-[#131d27] to-emerald-950/60 border border-emerald-700/50 text-emerald-200 text-xs shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              <EyeOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white">Visualización limpia en tiempo real:</span>{' '}
              <span className="text-slate-300">
                Se están ocultando <strong>{completedInActiveTab} tarea{completedInActiveTab === 1 ? '' : 's'} completada{completedInActiveTab === 1 ? '' : 's'}</strong> en {activeTabDef.shortLabel}. Visualizando únicamente el trabajo pendiente.
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setHideCompleted(false);
              localStorage.setItem('invict_hide_completed', 'false');
              if (statusFilter === 'SOLO_PENDIENTES') setStatusFilter('TODOS');
            }}
            className="self-end sm:self-center px-3 py-1 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white font-bold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mostrar todas ({completedInActiveTab})</span>
          </button>
        </div>
      )}

      {/* 4. Data Presentation: Table or Kanban */}
      {viewMode === 'table' ? (
        <div className="space-y-3">
          {/* Mobile Task Cards (Diseño Táctil y Sencillo para Celulares) */}
          {mobileLayout === 'cards' && (
            <div className="md:hidden space-y-2.5">
              {filteredTasks.map((task) => {
                const daysInfo = calculateDaysRemaining(task.dueDate, task.completedDate);
                const isMonthlyStopped = Boolean(
                  task.monthlyRecurrenceStopped ||
                    isMonthlyTaskStoppedForPeriod(task.area, task.title, task.monthPeriod || currentPeriod, tasks)
                );
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] space-y-2.5 ${
                      task.status === 'Completada'
                        ? 'bg-[#0f141f]/70 border-[#1f283c] opacity-80'
                        : daysInfo.status === 'vencida'
                        ? 'bg-[#181116] border-red-900/60 shadow-sm'
                        : 'bg-[#121622] border-[#222b3d] hover:border-[#354360] shadow-sm'
                    }`}
                  >
                    {/* Fila Superior: Área, Naturaleza, Prioridad y Estado de Vencimiento */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[10px] text-slate-200 px-2 py-0.5 bg-[#1b2232] rounded border border-[#283248]">
                          {task.area}
                        </span>
                        {renderNatureBadge(task.nature, task)}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            task.priority === 'Urgente'
                              ? 'text-red-300 bg-red-950/70 border border-red-800'
                              : task.priority === 'Alta'
                              ? 'text-amber-300 bg-amber-950/50'
                              : 'text-slate-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${daysInfo.badgeClass}`}
                      >
                        {daysInfo.status === 'vencida' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                        {daysInfo.status === 'urgente_48h' && <Clock className="w-3 h-3 text-amber-400" />}
                        {daysInfo.status === 'completada' && <Check className="w-3 h-3 text-emerald-400" />}
                        {daysInfo.label}
                      </span>
                    </div>

                    {/* Título & Detalle */}
                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {task.title}
                      </h4>
                      {task.notes && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {task.notes}
                        </p>
                      )}
                    </div>

                    {/* Responsable & Fecha Límite */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-[#1a2130]">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-200 font-medium truncate">{task.assignee}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 shrink-0 ml-2">
                        Vence: <strong className="text-slate-200">{formatDateLocale(task.dueDate)}</strong>
                      </div>
                    </div>

                    {/* Barra de Acciones Táctiles: Estado en 1 Clic + Repetición + Comentarios */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1a2130]">
                      <button
                        type="button"
                        onClick={(e) => handleCycleStatus(e, task)}
                        className={`flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-1.5 border transition-transform active:scale-95 cursor-pointer ${
                          task.status === 'Completada'
                            ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700 shadow-sm'
                            : task.status === 'En curso'
                            ? 'text-blue-300 bg-blue-950/80 border-blue-700'
                            : task.status === 'Urgente/Prioritaria'
                            ? 'text-red-300 bg-red-950/80 border-red-700 animate-pulse'
                            : 'text-slate-300 bg-[#161d2b] border-[#29364d]'
                        }`}
                        title="Toca para cambiar de estado"
                      >
                        {task.status === 'Completada' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{task.status}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {(task.nature || 'Fija Mensual') === 'Fija Mensual' && onToggleMonthlyRecurrence && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMonthlyRecurrence(task, !isMonthlyStopped);
                            }}
                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                              isMonthlyStopped
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                : 'bg-amber-950/70 text-amber-200 border-amber-700/60'
                            }`}
                          >
                            {isMonthlyStopped ? 'Reactivar' : 'Frenar'}
                          </button>
                        )}

                        {task.nature === 'Fija Semanal' && onToggleWeeklyRecurrence && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWeeklyRecurrence(task, !task.weeklyRecurrenceStopped);
                            }}
                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                              task.weeklyRecurrenceStopped
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                : 'bg-purple-950/70 text-purple-200 border-purple-700/60'
                            }`}
                          >
                            {task.weeklyRecurrenceStopped ? 'Reactivar' : 'Parar'}
                          </button>
                        )}

                        <span className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 bg-[#151c27] rounded-lg border border-[#232d3f]">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.commentsCount || 0}</span>
                        </span>

                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Deseas retirar la tarea "${task.title}" de la planilla?`)) {
                                onDeleteTask(task.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredTasks.length === 0 && (
                <div className="p-8 text-center bg-[#121620] border border-[#22293b] rounded-2xl text-slate-400 text-xs">
                  No hay tareas registradas con los filtros seleccionados.
                </div>
              )}
            </div>
          )}

          {/* Desktop Table View */}
          <div className={`bg-[#121620] border border-[#22293b] rounded-2xl shadow overflow-hidden ${
            mobileLayout === 'cards' ? 'hidden md:block' : 'block'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5">Puesto / Área</th>
                  <th className="py-3 px-3.5 min-w-[260px]">Tarea & Procedimiento</th>
                  <th className="py-3 px-3">Responsable</th>
                  <th className="py-3 px-3 text-center">Estado (Clic para alternar)</th>
                  <th className="py-3 px-3 font-mono">Límite</th>
                  <th className="py-3 px-3 text-center">Alerta</th>
                  <th className="py-3 px-3 text-center">Prioridad</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Última Modificación</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredTasks.map((task) => {
                  const daysInfo = calculateDaysRemaining(task.dueDate, task.completedDate);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-[#161b26]/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectTask(task)}
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-200 px-2 py-0.5 bg-[#1b2232] rounded border border-[#283248]">
                          {task.area}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-100 group-hover:text-white transition-colors">
                          {task.title}
                        </div>
                        {task.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {task.notes}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {renderNatureBadge(task.nature, task)}
                          {task.category && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              · {task.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                        <span className="font-medium">{task.assignee}</span>
                      </td>
                      <td
                        className="py-3 px-3 whitespace-nowrap text-center"
                        onClick={(e) => handleCycleStatus(e, task)}
                        title="Haz clic para alternar el estado de la tarea"
                      >
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-transform active:scale-95 ${
                            task.status === 'Completada'
                              ? 'text-emerald-400 bg-emerald-950/70 border-emerald-800 shadow-sm'
                              : task.status === 'En curso'
                              ? 'text-blue-400 bg-blue-950/70 border-blue-800'
                              : task.status === 'Urgente/Prioritaria'
                              ? 'text-red-400 bg-red-950/70 border-red-800 animate-pulse'
                              : 'text-slate-400 bg-slate-900 border-slate-700'
                          }`}
                        >
                          {task.status === 'Completada' && <Check className="w-3 h-3" />}
                          <span>{task.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-300">
                        {formatDateLocale(task.dueDate)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${daysInfo.badgeClass}`}>
                          {daysInfo.status === 'vencida' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                          {daysInfo.status === 'urgente_48h' && <Clock className="w-3 h-3 text-amber-400" />}
                          {daysInfo.status === 'completada' && <Check className="w-3 h-3 text-emerald-400" />}
                          {daysInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          task.priority === 'Urgente'
                            ? 'text-red-300 bg-red-950/70 border border-red-800'
                            : task.priority === 'Alta'
                            ? 'text-amber-300 bg-amber-950/50'
                            : 'text-slate-400'
                        }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {task.lastModifiedBy ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-[11px] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>{task.lastModifiedBy.name}</span>
                              <span className="text-blue-400 font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-blue-950/60 border border-blue-800/40">
                                {task.lastModifiedBy.profile}
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5 text-slate-500" />
                              {task.lastModifiedAt || 'Reciente'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Planilla base</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(task.nature || 'Fija Mensual') === 'Fija Mensual' && onToggleMonthlyRecurrence && (() => {
                            const isMonthlyStopped = Boolean(
                              task.monthlyRecurrenceStopped ||
                                isMonthlyTaskStoppedForPeriod(task.area, task.title, task.monthPeriod || currentPeriod, tasks)
                            );
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleMonthlyRecurrence(task, !isMonthlyStopped);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                  isMonthlyStopped
                                    ? 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                                    : 'bg-amber-950/70 hover:bg-amber-900 text-amber-200 border-amber-700/60'
                                }`}
                                title={
                                  isMonthlyStopped
                                    ? 'Reactivar la repetición automática mensual de esta tarea para los próximos meses'
                                    : 'Frenar la repetición mensual de esta tarea de aquí en adelante'
                                }
                              >
                                {isMonthlyStopped ? 'Reactivar Rep.' : 'Frenar Rep.'}
                              </button>
                            );
                          })()}
                          {task.nature === 'Fija Semanal' && onToggleWeeklyRecurrence && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleWeeklyRecurrence(task, !task.weeklyRecurrenceStopped);
                              }}
                              className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                task.weeklyRecurrenceStopped
                                  ? 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                                  : 'bg-purple-950/70 hover:bg-purple-900 text-purple-200 border-purple-700/60'
                              }`}
                              title={
                                task.weeklyRecurrenceStopped
                                  ? 'Reactivar la repetición automática semanal de esta tarea'
                                  : 'Parar la repetición semanal de esta tarea para futuras semanas'
                              }
                            >
                              {task.weeklyRecurrenceStopped ? 'Reactivar Sem.' : 'Parar Sem.'}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(task);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-[#1b2232] hover:bg-[#252e44] rounded border border-[#2b354c] transition-colors"
                            title="Abrir detalle / Editar tarea / Hilo de seguimiento"
                          >
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span>{task.commentsCount || 0}</span>
                          </button>
                          {onDeleteTask && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`¿Deseas retirar la tarea "${task.title}" de la planilla?`)) {
                                  onDeleteTask(task.id);
                                }
                              }}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/40 transition-colors"
                              title="Retirar tarea de esta planilla"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                      {isFilteringOutCompleted && completedInActiveTab > 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 text-emerald-400 border border-emerald-700/60 flex items-center justify-center mb-1">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-bold text-white">
                            ¡Puesto al día! No hay tareas pendientes en este puesto.
                          </span>
                          <span className="text-xs text-slate-400 max-w-md">
                            Todas las {completedInActiveTab} tarea{completedInActiveTab === 1 ? '' : 's'} de este puesto están completadas.
                          </span>
                          <button
                            onClick={toggleHideCompleted}
                            className="mt-2 px-3.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Mostrar las {completedInActiveTab} tareas completadas</span>
                          </button>
                        </div>
                      ) : (
                        `No hay tareas registradas para el puesto ${activeTabDef.label} con los filtros seleccionados.`
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
        /* KANBAN VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kanbanColumns.map((colStatus) => {
            const tasksInCol = filteredTasks.filter((t) => t.status === colStatus);
            const colColorClass =
              colStatus === 'Completada' ? 'border-t-emerald-500' :
              colStatus === 'En curso' ? 'border-t-blue-500' :
              colStatus === 'Urgente/Prioritaria' ? 'border-t-red-500' :
              'border-t-slate-500';

            return (
              <div
                key={colStatus}
                className={`bg-[#121620] border border-[#22293b] border-t-4 ${colColorClass} rounded-2xl p-3.5 shadow flex flex-col`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22293b]">
                  <span className="text-xs font-bold text-slate-200">
                    {colStatus}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.2 rounded-full bg-[#1c2232] text-slate-300">
                    {tasksInCol.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[620px] pr-1">
                  {tasksInCol.map((task) => {
                    const daysInfo = calculateDaysRemaining(task.dueDate, task.completedDate);
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className="p-3 bg-[#161b26] hover:bg-[#1a2130] border border-[#252c3e] rounded-xl shadow-sm cursor-pointer transition-all hover:translate-y-[-1px] group"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-[#252c3e] text-slate-300 rounded shrink-0">
                            {task.area}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold shrink-0 ${daysInfo.badgeClass}`}>
                            {daysInfo.label}
                          </span>
                        </div>

                        <h4 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-2">
                          {task.title}
                        </h4>

                        {task.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {task.notes}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#222838] text-[10px] text-slate-400">
                          <span className="truncate max-w-[120px] font-medium text-slate-300">
                            {task.assignee}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {task.commentsCount || 0}
                            </span>
                            <button
                              onClick={(e) => handleCycleStatus(e, task)}
                              className="text-[10px] font-bold text-blue-400 hover:text-white px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/40"
                              title="Avanzar estado"
                            >
                              Cambiar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {tasksInCol.length === 0 && (
                    colStatus === 'Completada' && isFilteringOutCompleted && completedInActiveTab > 0 ? (
                      <div className="py-6 px-3 rounded-xl bg-[#141a24] border border-dashed border-emerald-800/60 text-center text-xs space-y-2">
                        <EyeOff className="w-5 h-5 text-emerald-400 mx-auto" />
                        <p className="font-semibold text-slate-200">
                          {completedInActiveTab} tarea{completedInActiveTab === 1 ? '' : 's'} oculta{completedInActiveTab === 1 ? '' : 's'}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-snug">
                          Modo limpio activo para enfocarse en tareas pendientes.
                        </p>
                        <button
                          onClick={toggleHideCompleted}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Mostrar en el tablero
                        </button>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Sin tareas en esta columna
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
