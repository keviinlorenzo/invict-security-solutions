import React, { useState } from 'react';
import { Task, Expense, UserPersona, AreaType, ExecutiveReportData, ShiftType } from '../types';
import { calculateDaysRemaining, formatCurrencyARS, formatDateLocale, formatPeriodName } from '../utils/dateUtils';
import { exportExecutiveReportToPDF, exportTasksToPDF } from '../utils/pdfExportUtils';
import { exportExecutiveReportToCSV, exportTasksToCSV } from '../utils/exportUtils';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  Building,
  Award,
  Layers,
  ChevronRight,
  Sparkles,
  Calendar,
  BarChart3,
  Filter,
  ArrowUpDown,
  Flame,
  AlertCircle,
  HelpCircle,
  Activity,
  Compass
} from 'lucide-react';
import { InvictLogo } from './InvictLogo';

interface ExecutiveReportsViewProps {
  tasks: Task[];
  expenses: Expense[];
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  currentUser: UserPersona;
  allPersonas: UserPersona[];
  onSelectTask?: (task: Task) => void;
}

const DEFAULT_POST_METADATA: Record<AreaType, { name: string; fallbackOfficer: string; color: string }> = {
  OPERACIONES: { name: 'Operaciones (Puestos & Guardias)', fallbackOfficer: 'Kevin Lorenzo', color: '#BE2629' },
  SUPERVISIÓN: { name: 'Supervisión en Terreno', fallbackOfficer: 'Bilbao / Tejera', color: '#F59E0B' },
  RRHH: { name: 'Recursos Humanos', fallbackOfficer: 'Pilar', color: '#10B981' },
  ADM: { name: 'Administración', fallbackOfficer: 'Giuliana', color: '#3B82F6' },
  AUX_ADM: { name: 'Auxiliar Administrativo', fallbackOfficer: 'Kevin', color: '#06B6D4' },
  SELECCION: { name: 'Selección de Personal', fallbackOfficer: 'Mariana', color: '#A855F7' },
  GERENCIA: { name: 'Gerencia General (C-Level)', fallbackOfficer: 'Yamila / Laura / Domingo', color: '#BE2629' },
  TODOS: { name: 'Consolidado General', fallbackOfficer: 'Directorio', color: '#94A3B8' },
};

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({
  tasks,
  expenses,
  currentPeriod,
  onPeriodChange,
  currentUser,
  allPersonas,
  onSelectTask,
}) => {
  const [selectedObjectiveFilter, setSelectedObjectiveFilter] = useState<string>('TODOS');
  const [workloadFilter, setWorkloadFilter] = useState<'ALL' | 'BOTTLENECK' | 'HIGH_LOAD'>('ALL');
  const [workloadSort, setWorkloadSort] = useState<'LOAD_DESC' | 'BOTTLENECK_FIRST' | 'RATE_ASC' | 'NAME'>('LOAD_DESC');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Filter for period
  const periodTasks = tasks.filter(t => (t.monthPeriod || '2026-10') === currentPeriod);
  const periodExpenses = expenses.filter(e => e.date.startsWith(currentPeriod));
  const effectiveExpenses = periodExpenses.length > 0 ? periodExpenses : expenses;

  // Compute metrics
  const totalTasks = periodTasks.length;
  const completedTasks = periodTasks.filter(t => t.status === 'Completada').length;
  const inProgressTasks = periodTasks.filter(t => t.status === 'En curso').length;
  const notStartedTasks = periodTasks.filter(t => t.status === 'No iniciada').length;

  let overdueTasks = 0;
  let urgentTasks = 0;
  periodTasks.forEach(t => {
    if (t.priority === 'Urgente') urgentTasks++;
    if (t.status !== 'Completada') {
      const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
      if (status === 'vencida') overdueTasks++;
    }
  });

  const complianceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalExpenseAmount = effectiveExpenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetUtilization = Math.round((totalExpenseAmount / 3200000) * 100);

  const supervisionTasks = periodTasks.filter(t => t.area === 'SUPERVISIÓN');
  const supervisionCompleted = supervisionTasks.filter(t => t.status === 'Completada').length;
  const supervisionRate = supervisionTasks.length > 0 ? Math.round((supervisionCompleted / supervisionTasks.length) * 100) : 0;

  // Area Breakdown calculation
  // Helper to dynamically get the current assigned officer name from allPersonas
  const getOfficerForArea = (area: AreaType): string => {
    const meta = DEFAULT_POST_METADATA[area];
    if (!allPersonas || allPersonas.length === 0) return meta?.fallbackOfficer || '';
    const match = allPersonas.find(p => p.department === area);
    return match ? match.name : (meta?.fallbackOfficer || '');
  };

  const dynamicPostNames: Record<AreaType, { name: string; officer: string; color: string }> = {
    OPERACIONES: { name: DEFAULT_POST_METADATA.OPERACIONES.name, officer: getOfficerForArea('OPERACIONES'), color: DEFAULT_POST_METADATA.OPERACIONES.color },
    SUPERVISIÓN: { name: DEFAULT_POST_METADATA.SUPERVISIÓN.name, officer: getOfficerForArea('SUPERVISIÓN'), color: DEFAULT_POST_METADATA.SUPERVISIÓN.color },
    RRHH: { name: DEFAULT_POST_METADATA.RRHH.name, officer: getOfficerForArea('RRHH'), color: DEFAULT_POST_METADATA.RRHH.color },
    ADM: { name: DEFAULT_POST_METADATA.ADM.name, officer: getOfficerForArea('ADM'), color: DEFAULT_POST_METADATA.ADM.color },
    AUX_ADM: { name: DEFAULT_POST_METADATA.AUX_ADM.name, officer: getOfficerForArea('AUX_ADM'), color: DEFAULT_POST_METADATA.AUX_ADM.color },
    SELECCION: { name: DEFAULT_POST_METADATA.SELECCION.name, officer: getOfficerForArea('SELECCION'), color: DEFAULT_POST_METADATA.SELECCION.color },
    GERENCIA: { name: DEFAULT_POST_METADATA.GERENCIA.name, officer: getOfficerForArea('GERENCIA'), color: DEFAULT_POST_METADATA.GERENCIA.color },
    TODOS: { name: DEFAULT_POST_METADATA.TODOS.name, officer: 'Directorio', color: DEFAULT_POST_METADATA.TODOS.color },
  };

  const areas: AreaType[] = ['OPERACIONES', 'SUPERVISIÓN', 'RRHH', 'ADM', 'AUX_ADM', 'SELECCION', 'GERENCIA'];
  const areaBreakdown = areas.map(areaKey => {
    const aTasks = periodTasks.filter(t => t.area === areaKey);
    const total = aTasks.length;
    const completed = aTasks.filter(t => t.status === 'Completada').length;
    let overdue = 0;
    let pending = 0;
    aTasks.forEach(t => {
      if (t.status !== 'Completada') {
        pending++;
        const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
        if (status === 'vencida') overdue++;
      }
    });
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      area: areaKey,
      areaName: dynamicPostNames[areaKey].name,
      responsible: dynamicPostNames[areaKey].officer,
      total,
      completed,
      pending,
      overdue,
      rate,
    };
  });

  // Priority Breakdown calculation (replacing turnos since all staff work in same office)
  const priorities: Array<Task['priority']> = ['Urgente', 'Alta', 'Normal', 'Baja'];
  const priorityBreakdown = priorities.map(priority => {
    const pTasks = periodTasks.filter(t => t.priority === priority);
    const total = pTasks.length;
    const completed = pTasks.filter(t => t.status === 'Completada').length;
    return {
      priority,
      total,
      completed,
      active: total - completed,
    };
  });

  // --- WORKLOAD COMPARISON PER INDIVIDUAL COLLABORATOR & ASSIGNED POST ---
  const collaboratorWorkloadRaw = allPersonas.map((persona) => {
    const firstName = persona.name.split(' ')[0].toLowerCase();
    const assignedTasks = periodTasks.filter(t => {
      const matchName = t.assignee.toLowerCase().includes(firstName);
      const matchArea = t.area === persona.department;
      return matchName || (t.assignee.toLowerCase().includes(persona.role.toLowerCase().slice(0, 5)) && matchArea);
    });
    const total = assignedTasks.length;
    const completed = assignedTasks.filter(t => t.status === 'Completada').length;
    const inProgress = assignedTasks.filter(t => t.status === 'En curso').length;
    let overdue = 0;
    assignedTasks.forEach(t => {
      if (t.status !== 'Completada') {
        const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
        if (status === 'vencida') overdue++;
      }
    });
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isBottleneck = total >= 2 && (rate < 60 || overdue > 0 || total >= 5);
    
    let bottleneckSeverity: 'CRITICAL' | 'WARNING' | 'CLEAR' = 'CLEAR';
    let bottleneckDiagnostic = 'Carga equilibrada y ritmo dentro de SLA';
    
    if (overdue > 0 && rate < 50) {
      bottleneckSeverity = 'CRITICAL';
      bottleneckDiagnostic = `Cuello de botella crítico: ${overdue} tarea(s) vencida(s) y ${rate}% de eficacia`;
    } else if (overdue > 0) {
      bottleneckSeverity = 'WARNING';
      bottleneckDiagnostic = `Demora activa: ${overdue} tarea(s) vencida(s)`;
    } else if (total >= 5 && rate < 60) {
      bottleneckSeverity = 'WARNING';
      bottleneckDiagnostic = `Sobrecarga de volumen (${total} tareas) con baja resolución (${rate}%)`;
    } else if (rate >= 75) {
      bottleneckDiagnostic = 'Óptimo: alta tasa de resolución dentro de plazo';
    }

    return {
      persona,
      total,
      completed,
      inProgress,
      overdue,
      rate,
      isBottleneck,
      bottleneckSeverity,
      bottleneckDiagnostic,
    };
  });

  // Filter and sort collaborator workload
  let filteredCollaborators = collaboratorWorkloadRaw.filter(c => {
    if (workloadFilter === 'BOTTLENECK') return c.isBottleneck;
    if (workloadFilter === 'HIGH_LOAD') return c.total >= 3;
    return true;
  });

  filteredCollaborators.sort((a, b) => {
    if (workloadSort === 'LOAD_DESC') return b.total - a.total;
    if (workloadSort === 'BOTTLENECK_FIRST') {
      if (a.isBottleneck !== b.isBottleneck) return a.isBottleneck ? -1 : 1;
      return b.overdue - a.overdue;
    }
    if (workloadSort === 'RATE_ASC') return a.rate - b.rate;
    return a.persona.name.localeCompare(b.persona.name);
  });

  const maxCollaboratorTasks = Math.max(...collaboratorWorkloadRaw.map(c => c.total), 1);
  const totalBottlenecks = collaboratorWorkloadRaw.filter(c => c.isBottleneck).length;
  const topLoadedCollaborator = [...collaboratorWorkloadRaw].sort((a, b) => b.total - a.total)[0];

  const reportData: ExecutiveReportData = {
    period: currentPeriod,
    periodName: formatPeriodName(currentPeriod),
    generatedDate: new Date().toLocaleDateString('es-AR'),
    generatedBy: `${currentUser.name} (${currentUser.role})`,
    totalTasks,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    urgentTasks,
    complianceRate,
    totalExpenses: totalExpenseAmount,
    budgetUtilization,
    areaBreakdown,
    shiftBreakdown: [],
  };

  const handleDownloadPDF = () => {
    const filename = `INVICT_Informe_Ejecutivo_${currentPeriod}.pdf`;
    exportExecutiveReportToPDF(reportData, periodTasks, effectiveExpenses, filename);
    setReportFeedback(`Informe Ejecutivo en PDF (${filename}) generado con membrete oficial.`);
    setTimeout(() => setReportFeedback(null), 5000);
  };

  const handleDownloadCSV = () => {
    const filename = `INVICT_Informe_Ejecutivo_${currentPeriod}.csv`;
    exportExecutiveReportToCSV(reportData, periodTasks, effectiveExpenses, filename);
    setReportFeedback(`Planilla CSV de auditoría ejecutiva (${filename}) descargada.`);
    setTimeout(() => setReportFeedback(null), 5000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-gradient-to-r from-[#121622] via-[#161c29] to-[#121622] border border-[#232d42] rounded-2xl shadow-xl">
        <div className="flex items-start gap-3.5">
          <InvictLogo size="sm" variant="isotype" />
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/40 rounded">
                Auditoría C-Level
              </span>
              <span className="text-xs text-slate-300 font-semibold">{formatPeriodName(currentPeriod)}</span>
              <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                Membrete Oficial
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Informes Ejecutivos & Comparativa de Carga
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
              Consolidación mensual de indicadores para Dirección General: balance de carga de trabajo individual vs. completadas, identificación de cuellos de botella y control general de oficina central.
            </p>
          </div>
        </div>

        {/* Quick Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161c28] hover:bg-[#20283a] text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-bold transition-all active:scale-95 shadow cursor-pointer"
            title="Exportar archivo CSV enriquecido para Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Planilla CSV</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/50 transition-all active:scale-95 cursor-pointer"
            title="Descargar reporte formal en PDF de 3 páginas con sellos institucionales"
          >
            <FileText className="w-4 h-4" />
            <span>Descargar Informe PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2 bg-[#161c28] hover:bg-[#20283a] text-slate-300 hover:text-white border border-[#253046] rounded-xl text-xs transition-colors cursor-pointer"
            title="Imprimir vista de informe"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {reportFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{reportFeedback}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">Verificado</span>
        </div>
      )}

      {/* 4 Main Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cumplimiento Global</span>
            <div className="p-2 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tabular-nums">
              {complianceRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({completedTasks}/{totalTasks} resueltas)
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
            <span>Sin iniciar: {notStartedTasks}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cuellos de Botella</span>
            <div className="p-2 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-red-400 tabular-nums">
              {totalBottlenecks}
            </span>
            <span className="text-xs text-slate-400">
              perfiles en riesgo ({overdueTasks} vencidas)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {totalBottlenecks === 0
                ? 'Flujo operativo sin cuellos de botella'
                : 'Requiere redistribución de tareas por Gerencia'}
            </span>
          </p>
          <div className="text-[11px] text-red-400 font-semibold mt-2">
            {totalBottlenecks === 0 ? 'Capacidad de respuesta óptima' : 'Atención en tareas y puestos críticos'}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Control de Gastos de Oficina</span>
            <div className="p-2 rounded-xl bg-blue-950/50 border border-blue-800/50 text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white tabular-nums">
              {formatCurrencyARS(totalExpenseAmount)}
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
            <span>{budgetUtilization}% utilizado</span>
          </div>
        </div>

        {/* KPI 4: Sector Supervisión */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Sector Supervisión</span>
            <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-800/50 text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tabular-nums">
              {supervisionRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({supervisionCompleted}/{supervisionTasks.length} resueltas)
            </span>
          </div>
          <div className="w-full bg-[#1b2232] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${supervisionRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
            <span>Móviles y rondas</span>
            <span className="text-amber-300 font-semibold">Métricas segregadas</span>
          </div>
        </div>
      </div>

      {/* --- COMPARATIVE WORKLOAD BAR CHART BY INDIVIDUAL COLLABORATOR --- */}
      <div className="bg-[#121620] border border-[#232d42] rounded-2xl shadow-xl overflow-hidden">
        {/* Section Header with Controls */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#141926] via-[#182030] to-[#141926] border-b border-[#252f44] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/40 mt-0.5">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Comparativa de Carga de Trabajo & Detección de Cuellos de Botella
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Por Colaborador Individual
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Gráfico de barras comparativo de <strong>Tareas Totales Asignadas</strong> vs. <strong>Tareas Completadas</strong> para identificar asimetrías de volumen, saturación operativa y puestos en riesgo.
              </p>
            </div>
          </div>

          {/* Interactive Filters & Sorters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#0d1017] p-1 rounded-xl border border-[#222a3d] text-xs">
              <button
                type="button"
                onClick={() => setWorkloadFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  workloadFilter === 'ALL'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({collaboratorWorkloadRaw.length})
              </button>
              <button
                type="button"
                onClick={() => setWorkloadFilter('BOTTLENECK')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  workloadFilter === 'BOTTLENECK'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-red-300'
                }`}
              >
                <Flame className="w-3 h-3 text-red-400" />
                <span>Cuellos de Botella ({totalBottlenecks})</span>
              </button>
            </div>

            <select
              value={workloadSort}
              onChange={(e) => setWorkloadSort(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-[#0d1017] border border-[#222a3d] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#BE2629] cursor-pointer"
            >
              <option value="LOAD_DESC">Ordenar: Mayor Carga Total</option>
              <option value="BOTTLENECK_FIRST">Ordenar: Cuellos de Botella Primero</option>
              <option value="RATE_ASC">Ordenar: Menor Eficacia (% Cumplimiento)</option>
              <option value="NAME">Ordenar: Alfabético</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 bg-[#0e121a] border-b border-[#1c2333] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#3b82f6] shadow" />
              <span className="font-semibold text-slate-300">Barra 1: Tareas Totales Asignadas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#10b981] shadow" />
              <span className="font-semibold text-slate-300">Barra 2: Tareas Completadas (Resueltas)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold text-red-400">Indicador de Cuello de Botella</span>
            </div>
          </div>

          {topLoadedCollaborator && (
            <div className="text-[11px] font-mono text-slate-400">
              Mayor Carga: <strong className="text-white">{topLoadedCollaborator.persona.name}</strong> ({topLoadedCollaborator.total} tareas)
            </div>
          )}
        </div>

        {/* Comparative Bars List */}
        <div className="p-5 space-y-4">
          {filteredCollaborators.map((item) => {
            const totalWidthPct = Math.max(Math.round((item.total / maxCollaboratorTasks) * 100), 4);
            const completedWidthPct = Math.max(Math.round((item.completed / maxCollaboratorTasks) * 100), item.completed > 0 ? 4 : 0);
            const isCritical = item.bottleneckSeverity === 'CRITICAL';

            return (
              <div
                key={item.persona.id}
                className={`p-4 rounded-2xl border transition-all ${
                  item.isBottleneck
                    ? 'bg-gradient-to-r from-red-950/20 via-[#161a26] to-[#121620] border-red-900/50 shadow-md'
                    : 'bg-[#151a26] border-[#222c40] hover:border-[#2e3b54]'
                }`}
              >
                {/* Header row: Collaborator Info & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow ${item.persona.avatarBg}`}>
                      {item.persona.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {item.persona.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-[#222a3d] text-slate-300 border border-[#2d3850]">
                          {item.persona.department}
                        </span>
                        {item.isBottleneck && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            isCritical
                              ? 'bg-red-950 text-red-300 border border-red-700 animate-pulse'
                              : 'bg-amber-950 text-amber-300 border border-amber-700'
                          }`}>
                            <Flame className="w-3 h-3 text-red-400" />
                            <span>Cuello de Botella</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {item.persona.role} · <span className="font-mono text-slate-400">{item.persona.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Scorecard */}
                  <div className="flex items-center gap-3 text-right self-end sm:self-center font-mono">
                    <div>
                      <span className="text-xs text-slate-400 block font-sans">Eficacia</span>
                      <span className={`text-sm font-black ${item.rate >= 75 ? 'text-emerald-400' : (item.rate >= 50 ? 'text-blue-400' : 'text-red-400')}`}>
                        {item.rate}%
                      </span>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div>
                      <span className="text-xs text-slate-400 block font-sans">Vencidas</span>
                      <span className={`text-sm font-black ${item.overdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {item.overdue}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Paired Bar Chart Visualization */}
                <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
                  {/* Bar 1: Total Tasks */}
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-[11px] font-bold text-slate-400 shrink-0 text-right">
                      Totales ({item.total}):
                    </span>
                    <div className="flex-1 bg-[#0b0e14] h-5 rounded-lg p-0.5 overflow-hidden flex items-center">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                        style={{ width: `${totalWidthPct}%` }}
                      >
                        <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                          {item.total}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bar 2: Completed Tasks */}
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-[11px] font-bold text-emerald-400 shrink-0 text-right">
                      Completadas ({item.completed}):
                    </span>
                    <div className="flex-1 bg-[#0b0e14] h-5 rounded-lg p-0.5 overflow-hidden flex items-center">
                      {item.completed > 0 ? (
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-md transition-all duration-500 flex items-center justify-end px-2"
                          style={{ width: `${completedWidthPct}%` }}
                        >
                          <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                            {item.completed}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 pl-2 font-mono">0 resueltas</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Diagnostic Footer */}
                <div className="mt-2.5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Activity className={`w-3.5 h-3.5 ${item.isBottleneck ? 'text-red-400' : 'text-emerald-400'}`} />
                    <span className={item.isBottleneck ? 'text-red-300 font-semibold' : 'text-slate-300'}>
                      {item.bottleneckDiagnostic}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    En curso: {item.inProgress} · Pendientes: {item.total - item.completed}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredCollaborators.length === 0 && (
            <div className="p-8 text-center text-slate-400 bg-[#0e121a] rounded-2xl border border-[#222a3d]">
              No hay colaboradores que coincidan con el filtro seleccionado.
            </div>
          )}
        </div>

        {/* Managerial Insights for Gerencia */}
        <div className="p-4 bg-gradient-to-r from-[#111724] via-[#161c29] to-[#111724] border-t border-[#232d42] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              <strong>Dictamen Operativo C-Level:</strong> {totalBottlenecks > 0
                ? `Se recomienda que Gerencia General redistribuya las tareas con mora en Operaciones y reasigne recursos en la oficina central.`
                : `Distribución de carga equilibrada sin cuellos de botella detectados en el período actual.`}
            </span>
          </div>
          <button
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 rounded-lg bg-[#20283a] hover:bg-[#2a354c] text-slate-200 hover:text-white font-bold transition-colors cursor-pointer shrink-0"
          >
            Adjuntar al PDF
          </button>
        </div>
      </div>

      {/* Post Performance Matrix Table */}
      <div className="bg-[#121620] border border-[#22293b] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 bg-[#161c29] border-b border-[#252f44] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#BE2629]" />
              <span>Matriz de Desempeño por Puesto de Trabajo</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tasa de cumplimiento, tareas resueltas y mora por cada área de la oficina central
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Período: {formatPeriodName(currentPeriod)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#141824] border-b border-[#22293b] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Puesto / Área</th>
                <th className="py-3 px-4">Responsable Asignado</th>
                <th className="py-3 px-4 text-center">Total Tareas</th>
                <th className="py-3 px-4 text-center">Completadas</th>
                <th className="py-3 px-4 text-center">En Curso</th>
                <th className="py-3 px-4 text-center">Vencidas</th>
                <th className="py-3 px-4 text-right">Eficacia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2433]">
              {areaBreakdown.map((row) => (
                <tr key={row.area} className="hover:bg-[#161b26] transition-colors">
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: dynamicPostNames[row.area].color }}
                      />
                      <span>{row.areaName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                    {row.responsible}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono font-bold text-white">
                    {row.total}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono font-bold text-emerald-400">
                    {row.completed}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono text-blue-400">
                    {row.pending}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono">
                    <span className={row.overdue > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                      {row.overdue}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-20 bg-[#1b2232] h-2 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${row.rate}%`,
                            backgroundColor: row.rate >= 75 ? '#10B981' : (row.rate >= 50 ? '#3B82F6' : '#EF4444')
                          }}
                        />
                      </div>
                      <span className="font-mono font-bold text-white text-xs">
                        {row.rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Priority Breakdown & Sede Única de Oficina */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between border-b border-[#22293b] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Distribución por Prioridad de Tareas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumen y resolución según criticidad en la oficina
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              Tareas de Oficina
            </span>
          </div>

          <div className="space-y-3">
            {priorityBreakdown.map((s) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              const prioColor = s.priority === 'Urgente'
                ? 'text-red-400 bg-red-950/60 border-red-800/60'
                : s.priority === 'Alta'
                ? 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                : s.priority === 'Normal'
                ? 'text-blue-400 bg-blue-950/60 border-blue-800/60'
                : 'text-slate-400 bg-slate-900 border-slate-700';

              const barColor = s.priority === 'Urgente'
                ? 'bg-[#BE2629]'
                : s.priority === 'Alta'
                ? 'bg-amber-500'
                : s.priority === 'Normal'
                ? 'bg-blue-500'
                : 'bg-slate-500';

              return (
                <div key={s.priority} className="p-3 rounded-xl bg-[#161b26] border border-[#252c3e] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${prioColor}`}>
                      Prioridad {s.priority}
                    </span>
                    <span className="font-mono text-slate-300">
                      {s.completed} de {s.total} resueltas ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#0d1017] h-2 rounded-full overflow-hidden">
                    <div
                      className={`${barColor} h-full rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unified Corporate Central Office */}
        <div className="p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between border-b border-[#22293b] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Sede Central · Trabajo en Equipo Integrado
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Todos los puestos y áreas operamos desde la misma oficina
              </p>
            </div>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#161b26] border border-[#252c3e] flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Gerencia General (C-Level)</span>
                <span className="text-slate-400 text-[11px]">Dirección ejecutiva, planificación estratégica y toma de decisiones</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Oficina Central
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#161b26] border border-[#252c3e] flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Operaciones & Supervisión</span>
                <span className="text-slate-400 text-[11px]">Coordinación operativa general y control de servicios desde la sede</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Oficina Central
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#161b26] border border-[#252c3e] flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Administración & Finanzas</span>
                <span className="text-slate-400 text-[11px]">Facturación a clientes, cuentas por pagar y rendición contable</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                Oficina Central
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#161b26] border border-[#252c3e] flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Recursos Humanos, Selección & Auxiliar</span>
                <span className="text-slate-400 text-[11px]">Gestión de personal, legajos, altas/bajas, compras y archivo documental</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Oficina Central
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
