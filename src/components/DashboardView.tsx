import React from 'react';
import { Task, Expense, AreaType } from '../types';
import {
  CheckCircle2,
  AlertOctagon,
  DollarSign,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Filter,
  Shield,
  Building,
  Check,
  FileSpreadsheet,
  Users,
  Eye,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { calculateDaysRemaining, formatCurrencyARS, formatPeriodName } from '../utils/dateUtils';
import { MonthlyPeriodSelector } from './MonthlyPeriodSelector';

interface DashboardViewProps {
  tasks: Task[];
  expenses: Expense[];
  selectedArea: AreaType;
  onAreaChange: (area: AreaType) => void;
  onNavigateToTasks: () => void;
  onNavigateToReports?: () => void;
  onNavigateToExpenses: () => void;
  onNavigateToCalendar?: () => void;
  onSelectTask: (task: Task) => void;
  onOpenExportModal?: () => void;
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  onResetFixedTasks?: () => void;
  onExportPeriod?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  expenses,
  selectedArea,
  onAreaChange,
  onNavigateToTasks,
  onNavigateToReports,
  onNavigateToExpenses,
  onNavigateToCalendar,
  onSelectTask,
  onOpenExportModal,
  currentPeriod,
  onPeriodChange,
  onResetFixedTasks,
  onExportPeriod,
}) => {
  // Filter tasks by current period first
  const periodTasks = tasks.filter(t => (t.monthPeriod || '2026-10') === currentPeriod);
  const fixedTasksInPeriod = periodTasks.filter(t => (t.nature || 'Fija Mensual') === 'Fija Mensual');

  // Filter tasks by selected area
  const filteredTasks = selectedArea === 'TODOS'
    ? periodTasks
    : periodTasks.filter(t => t.area === selectedArea);

  // Compute general metrics
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'Completada').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'En curso').length;
  const notStartedTasks = filteredTasks.filter(t => t.status === 'No iniciada').length;
  const complianceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Critical tasks (overdue or < 48hs)
  const criticalTasks = filteredTasks.filter(t => {
    if (t.status === 'Completada') return false;
    const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
    return status === 'vencida' || status === 'urgente_48h' || t.priority === 'Urgente';
  });

  const overdueCount = filteredTasks.filter(t => {
    if (t.status === 'Completada') return false;
    const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
    return status === 'vencida';
  }).length;

  // Expenses calculations for current period
  const periodExpenses = expenses.filter(e => e.date.startsWith(currentPeriod));
  const totalExpenses = (periodExpenses.length > 0 ? periodExpenses : expenses).reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyBudget = 3200000;
  const budgetUtilization = Math.round((totalExpenses / monthlyBudget) * 100);

  // Distinguish Operaciones vs Supervisión metrics (Requirement: "no quiero que se junten las métricas del sector operativo con la de los supervisores de la empresa")
  const operacionesTasks = periodTasks.filter(t => t.area === 'OPERACIONES');
  const operacionesCompleted = operacionesTasks.filter(t => t.status === 'Completada').length;
  const operacionesRate = operacionesTasks.length > 0 ? Math.round((operacionesCompleted / operacionesTasks.length) * 100) : 0;

  const supervisionTasks = periodTasks.filter(t => t.area === 'SUPERVISIÓN');
  const supervisionCompleted = supervisionTasks.filter(t => t.status === 'Completada').length;
  const supervisionRate = supervisionTasks.length > 0 ? Math.round((supervisionCompleted / supervisionTasks.length) * 100) : 0;

  const areasList: { id: AreaType; label: string }[] = [
    { id: 'TODOS', label: 'Toda la Empresa' },
    { id: 'OPERACIONES', label: 'Operaciones (Puestos)' },
    { id: 'SUPERVISIÓN', label: 'Supervisión' },
    { id: 'RRHH', label: 'RR.HH.' },
    { id: 'ADM', label: 'Administración' },
    { id: 'AUX_ADM', label: 'Auxiliar Adm.' },
    { id: 'SELECCION', label: 'Selección' },
    { id: 'GERENCIA', label: 'Gerencia General' },
  ];

  return (
    <div className="space-y-6">
      {/* Monthly Period Control */}
      <MonthlyPeriodSelector
        currentPeriod={currentPeriod}
        onPeriodChange={onPeriodChange}
        onResetFixedTasks={onResetFixedTasks}
        onExportPeriod={onExportPeriod}
        totalTasksInPeriod={periodTasks.length}
        fixedTasksCount={fixedTasksInPeriod.length}
      />

      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-gradient-to-r from-[#121620] via-[#161c29] to-[#121620] border border-[#22293b] rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30 rounded">
              Auditoría en Tiempo Real
            </span>
            <span className="text-xs text-slate-300 font-semibold">{formatPeriodName(currentPeriod)}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Panel de Supervisión Gerencial C-Level
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Control directo para Gerencia General (Yamila, Laura y Domingo). Métricas segregadas de Operaciones y Supervisión, contingencias de oficina y control presupuestario.
          </p>
        </div>

        {/* Quick Area Filter Bar & Export Report Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0b0e14] border border-[#232938] rounded-xl">
            <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1 font-semibold">
              <Filter className="w-3 h-3 text-slate-400" />
              Filtrar:
            </span>
            {areasList.map((area) => {
              const isActive = selectedArea === area.id;
              return (
                <button
                  key={area.id}
                  onClick={() => onAreaChange(area.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#BE2629] text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-[#1a2130]'
                  }`}
                >
                  {area.label}
                </button>
              );
            })}
          </div>

          {onNavigateToReports && (
            <button
              onClick={onNavigateToReports}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 rounded-xl shadow transition-all cursor-pointer whitespace-nowrap"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Ver Informes C-Level</span>
            </button>
          )}

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              title="Descargar Informes Consolidados para Directorio o Auditorías Externas (PDF y CSV)"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#BE2629] hover:bg-[#a62b2e] rounded-xl shadow transition-colors active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Reporte</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cumplimiento Global */}
        <div
          onClick={onNavigateToTasks}
          className="p-5 bg-[#121620] border border-[#22293b] hover:border-[#38435c] rounded-2xl shadow transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cumplimiento del Mes</span>
            <div className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white tabular-nums">
              {complianceRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({completedTasks}/{totalTasks} tareas)
            </span>
          </div>
          <div className="w-full bg-[#1b2232] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${complianceRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
            <span>En curso: {inProgressTasks}</span>
            <span>No iniciadas: {notStartedTasks}</span>
          </div>
        </div>

        {/* KPI 2: Tareas en Riesgo */}
        <div
          onClick={onNavigateToTasks}
          className="p-5 bg-[#121620] border border-[#22293b] hover:border-[#38435c] rounded-2xl shadow transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tareas en Riesgo</span>
            <div className="p-2 rounded-xl bg-red-950/40 text-red-400 border border-red-800/40">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-red-400 tabular-nums">
              {criticalTasks.length}
            </span>
            <span className="text-xs text-slate-400">
              ({overdueCount} vencidas)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Requieren resolución prioritaria en la oficina</span>
          </p>
          <div className="text-[11px] text-[#BE2629] group-hover:underline flex items-center gap-1 mt-2 font-semibold">
            <span>Ver matriz operativa</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* KPI 3: Gastos de Oficina */}
        <div
          onClick={onNavigateToExpenses}
          className="p-5 bg-[#121620] border border-[#22293b] hover:border-[#38435c] rounded-2xl shadow transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gastos de Oficina</span>
            <div className="p-2 rounded-xl bg-blue-950/40 text-blue-400 border border-blue-800/40">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {formatCurrencyARS(totalExpenses)}
            </span>
          </div>
          <div className="w-full bg-[#1b2232] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetUtilization > 90 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
            <span>Presupuesto $3.2M</span>
            <span>{budgetUtilization}% ejecutado</span>
          </div>
        </div>

        {/* KPI 4: Sector Supervisión (Segregado de Operaciones) */}
        <div
          onClick={() => onAreaChange('SUPERVISIÓN')}
          className="p-5 bg-[#121620] border border-[#22293b] hover:border-amber-500/50 rounded-2xl shadow transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Sector Supervisión
            </span>
            <div className="p-2 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-800/40">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white tabular-nums">
              {supervisionRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({supervisionCompleted}/{supervisionTasks.length} tareas)
            </span>
          </div>
          <div className="w-full bg-[#1b2232] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${supervisionRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
            <span>Supervisores en ruta</span>
            <span className="text-amber-300 font-semibold">Segregado de guardia</span>
          </div>
        </div>
      </div>

      {/* Dedicated Card for Managerial Excel Spreadsheets in Gastos de Oficina */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#171d2b] via-[#1a2336] to-[#171d2b] border border-cyan-800/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Planillas Gerenciales (Excel) Reubicadas en "Gastos de Oficina"</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                Exclusivo Gerencia C-Level
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
              Las planillas interactivas de <strong>Clientes (Facturación)</strong>, <strong>Sueldos Personal (Neto)</strong>, <strong>Gastos Fijos</strong>, <strong>Gastos Bancarios</strong> y <strong>Rentabilidad</strong> están ahora integradas en el apartado <strong>Gastos de Oficina</strong>, garantizando que los demás administrativos no tengan acceso a ellas.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToExpenses}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>Abrir Planillas Gerenciales en Gastos de Oficina</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Strategic Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Critical Tasks */}
        <div className="lg:col-span-2 bg-[#121620] border border-[#22293b] rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#BE2629]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Foco Gerencial: Tareas que Requieren Decisión Inmediata
              </h2>
            </div>
            <button
              onClick={onNavigateToTasks}
              className="text-xs text-[#BE2629] hover:underline font-semibold cursor-pointer"
            >
              Ver todas ({periodTasks.length}) →
            </button>
          </div>

          <div className="space-y-3">
            {criticalTasks.slice(0, 5).map((task) => {
              const { label, badgeClass } = calculateDaysRemaining(task.dueDate, task.completedDate);
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#161b26] hover:bg-[#1a2130] border border-[#252c3e] rounded-xl transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[#252c3e] text-slate-300 rounded">
                        {task.area}
                      </span>
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5 flex-wrap">
                      <span>Resp: <strong className="text-slate-300">{task.assignee}</strong></span>
                      <span>·</span>
                      <span>Límite: {task.dueDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${badgeClass}`}>
                      {label}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-[#252c3e] text-slate-300 rounded font-mono">
                      {task.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {criticalTasks.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Excelente: No hay tareas vencidas ni en riesgo en esta área seleccionada.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Operaciones vs Supervisión Comparison */}
        <div className="bg-[#121620] border border-[#22293b] rounded-2xl p-5 shadow space-y-4">
          <div className="flex items-center justify-between border-b border-[#22293b] pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Puestos Segregados: Operaciones vs Supervisión
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
              Activo
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Operaciones */}
            <div className="p-3 bg-[#161b26] rounded-xl border border-[#252c3e] space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Operaciones (Guardias & Objetivos)
                </span>
                <span className="text-blue-300 font-mono text-[11px] font-bold">
                  {operacionesRate}% ({operacionesCompleted}/{operacionesTasks.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Control de relevos en puestos físicos, libro de guardia, rondas nocturnas y asignaciones operativas en clientes.
              </p>
            </div>

            {/* Supervisión */}
            <div className="p-3 bg-[#161b26] rounded-xl border border-[#252c3e] space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Compass className="w-3.5 h-3.5" />
                  Supervisión (Móviles & Rutas)
                </span>
                <span className="text-amber-300 font-mono text-[11px] font-bold">
                  {supervisionRate}% ({supervisionCompleted}/{supervisionTasks.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Auditorías en terreno, verificación de libros en puestos, actas de inspección y control de vehículos de ronda.
              </p>
            </div>

            {/* Administración & Finanzas */}
            <div className="p-3 bg-[#161b26] rounded-xl border border-[#252c3e] space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Users className="w-3.5 h-3.5" />
                  Administración & RR.HH.
                </span>
                <span className="text-emerald-400 text-[11px] font-mono">
                  En Curso
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Liquidación de sueldos netos, compras de insumos comunes y control de legajos de colaboradores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
