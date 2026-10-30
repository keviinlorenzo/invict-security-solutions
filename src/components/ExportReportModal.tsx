import React, { useState } from 'react';
import { Task, Expense, ExecutiveReportData, AreaType, ShiftType, UserPersona } from '../types';
import {
  X,
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle,
  Calendar,
  Award,
  Sparkles,
  Printer
} from 'lucide-react';
import { InvictLogo } from './InvictLogo';
import {
  exportTasksToCSV,
  exportExpensesToCSV,
  exportExecutiveReportToCSV,
  exportConsolidatedCSV
} from '../utils/exportUtils';
import {
  exportTasksToPDF,
  exportExpensesToPDF,
  exportExecutiveReportToPDF
} from '../utils/pdfExportUtils';
import { formatPeriodName, getAvailablePeriodsList, calculateDaysRemaining } from '../utils/dateUtils';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  expenses: Expense[];
  currentPeriod: string;
  allPersonas?: UserPersona[];
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  expenses,
  currentPeriod,
  allPersonas,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const availablePeriods = getAvailablePeriodsList();
  const periodTasks = tasks.filter(t => (t.monthPeriod || '2026-10') === selectedPeriod);
  const periodExpenses = expenses.filter(e => e.date.startsWith(selectedPeriod));
  const effectiveExpenses = periodExpenses.length > 0 ? periodExpenses : expenses;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  // Helper to build ExecutiveReportData
  const buildReportData = (): ExecutiveReportData => {
    const totalTasks = periodTasks.length;
    const completedTasks = periodTasks.filter(t => t.status === 'Completada').length;
    const inProgressTasks = periodTasks.filter(t => t.status === 'En curso').length;
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
    const totalExpenses = effectiveExpenses.reduce((sum, e) => sum + e.amount, 0);
    const budgetUtilization = Math.round((totalExpenses / 3200000) * 100);

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
      const getResponsible = (area: AreaType, def: string) => {
        const found = allPersonas?.find(p => p.department === area);
        return found ? found.name : def;
      };
      return {
        area: areaKey,
        areaName: areaKey === 'OPERACIONES' ? 'Operaciones' : (areaKey === 'SUPERVISIÓN' ? 'Supervisión Operativa' : (areaKey === 'RRHH' ? 'Recursos Humanos' : (areaKey === 'ADM' ? 'Administración' : (areaKey === 'AUX_ADM' ? 'Auxiliar Adm.' : (areaKey === 'SELECCION' ? 'Selección' : 'Gerencia'))))),
        responsible: areaKey === 'OPERACIONES' ? getResponsible('OPERACIONES', 'Kevin') : (areaKey === 'SUPERVISIÓN' ? getResponsible('SUPERVISIÓN', 'Bilbao') : (areaKey === 'RRHH' ? getResponsible('RRHH', 'Pilar') : (areaKey === 'ADM' ? getResponsible('ADM', 'Giuliana') : (areaKey === 'AUX_ADM' ? getResponsible('AUX_ADM', 'Kevin') : (areaKey === 'SELECCION' ? getResponsible('SELECCION', 'Mariana') : getResponsible('GERENCIA', 'Yamila')))))),
        total,
        completed,
        pending,
        overdue,
        rate,
      };
    });

    const shifts: ShiftType[] = ['Mañana', 'Tarde', 'Noche', 'Rotativo', 'General'];
    const shiftBreakdown = shifts.map(shift => {
      const sTasks = periodTasks.filter(t => (t.shiftType || 'General') === shift);
      const total = sTasks.length;
      const completed = sTasks.filter(t => t.status === 'Completada').length;
      return { shift, total, completed, active: total - completed };
    });

    return {
      period: selectedPeriod,
      periodName: formatPeriodName(selectedPeriod),
      generatedDate: new Date().toLocaleDateString('es-AR'),
      generatedBy: 'Dirección General (INVICT)',
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      urgentTasks,
      complianceRate,
      totalExpenses,
      budgetUtilization,
      areaBreakdown,
      shiftBreakdown,
    };
  };

  const handleExportExecutivePDF = () => {
    const reportData = buildReportData();
    const filename = `INVICT_Informe_Ejecutivo_${selectedPeriod}.pdf`;
    exportExecutiveReportToPDF(reportData, periodTasks, effectiveExpenses, filename);
    showStatus(`Informe Ejecutivo oficial en PDF (${selectedPeriod}) generado con éxito.`);
  };

  const handleExportExecutiveCSV = () => {
    const reportData = buildReportData();
    const filename = `INVICT_Informe_Ejecutivo_${selectedPeriod}.csv`;
    exportExecutiveReportToCSV(reportData, periodTasks, effectiveExpenses, filename);
    showStatus(`Planilla CSV de auditoría ejecutiva (${selectedPeriod}) descargada.`);
  };

  const handleExportTasksCSV = () => {
    const filename = `INVICT_Tareas_${selectedPeriod}.csv`;
    exportTasksToCSV(periodTasks, filename);
    showStatus(`Planilla CSV de tareas (${periodTasks.length} registros) descargada.`);
  };

  const handleExportTasksPDF = () => {
    const filename = `INVICT_Tareas_${selectedPeriod}.pdf`;
    exportTasksToPDF(periodTasks, filename);
    showStatus(`Documento PDF de tareas operativas generado.`);
  };

  const handleExportExpensesCSV = () => {
    const filename = `INVICT_Gastos_${selectedPeriod}.csv`;
    exportExpensesToCSV(effectiveExpenses, filename);
    showStatus(`Planilla CSV de gastos descargada.`);
  };

  const handleExportExpensesPDF = () => {
    const filename = `INVICT_Gastos_${selectedPeriod}.pdf`;
    exportExpensesToPDF(effectiveExpenses, filename);
    showStatus(`Informe PDF de rendición de gastos generado.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-3xl bg-[#121620] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <InvictLogo size="sm" variant="isotype" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Centro de Exportaciones Oficiales (PDF & CSV)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#BE2629]/20 text-red-300 border border-[#BE2629]/40">
                  C-Level & Operaciones
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Genera reportes ejecutivos listos para imprimir con membrete oficial y planillas para Excel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className="p-3 bg-emerald-950/80 border-b border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Period Selector Bar */}
        <div className="p-4 bg-[#0e121a] border-b border-[#1f2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-[#BE2629]" />
            <span className="font-semibold">Período Mensual a Exportar:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-[#161c29] border border-[#2d3a52] rounded-xl px-3 py-1.5 text-white font-bold focus:outline-none focus:border-[#BE2629] cursor-pointer"
            >
              {availablePeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.id === currentPeriod ? '(Seleccionado)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Award className="w-3.5 h-3.5 text-[#BE2629]" />
            <span>Membrete oficial: <strong>Dirección General INVICT S.A.</strong></span>
          </div>
        </div>

        {/* Export Modules List */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Option 1: Executive C-Level Report */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#171f2e] via-[#141b28] to-[#171f2e] border-2 border-[#BE2629]/60 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm">
                  1. Informe Ejecutivo Avanzado C-Level (3 Páginas)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  Prioritario
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Scorecard ejecutivo con porcentaje de resolución global, rendimiento por puesto, balance de tareas de oficina y seguimiento de cartas documento Andreani.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportExecutiveCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#1b2333] hover:bg-[#253046] text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportExecutivePDF}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/50 transition-all active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>

          {/* Option 2: Tasks Matrix */}
          <div className="p-4 rounded-2xl bg-[#131722] border border-[#222a3a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">
                  2. Matriz de Tareas de Oficina ({formatPeriodName(selectedPeriod)})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {periodTasks.length} tareas
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Listado con responsables de área asignados, plazos de entrega y alertas de vencimiento.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportTasksCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2333] hover:bg-[#253046] text-slate-200 border border-[#2d3a52] rounded-xl text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportTasksPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2333] hover:bg-[#253046] text-slate-200 border border-[#2d3a52] rounded-xl text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Option 3: Expenses */}
          <div className="p-4 rounded-2xl bg-[#131722] border border-[#222a3a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">
                  3. Rendición de Gastos de Oficina / Caja Chica
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {effectiveExpenses.length} comprobantes
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Comprobantes de combustible YPF, multas REPRIV, uniformes y mantenimiento con estado de pago.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportExpensesCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2333] hover:bg-[#253046] text-slate-200 border border-[#2d3a52] rounded-xl text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportExpensesPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2333] hover:bg-[#253046] text-slate-200 border border-[#2d3a52] rounded-xl text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141926] border-t border-[#202737] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <span>ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1b2232] hover:bg-[#252f44] text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
