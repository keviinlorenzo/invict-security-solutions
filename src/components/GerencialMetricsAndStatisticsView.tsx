import React, { useState, useMemo, useRef } from 'react';
import { Task, Expense, UserPersona } from '../types';
import {
  computeMonthlyCompanyStatistics,
  computeYearlyCompanyStatistics,
  CompanyStatisticsData
} from '../utils/companyStatisticsService';
import { HubbardStatisticGraph } from './statistics/HubbardStatisticGraph';
import { HubbardConditionModal } from './statistics/HubbardConditionModal';
import {
  HubbardConditionFormula,
  HubbardConditionId,
  HUBBARD_CONDITIONS
} from '../data/hubbardConditionsData';
import {
  BarChart3,
  LineChart as LineChartIcon,
  Layers,
  Calendar,
  Clock,
  TrendingUp,
  Download,
  BookOpen,
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Activity,
  Lock,
  Flame,
  Zap,
  Users,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { formatPeriodName, getAdjacentPeriod } from '../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface GerencialMetricsAndStatisticsViewProps {
  tasks: Task[];
  expenses: Expense[];
  currentPeriod: string;
  onPeriodChange: (period: string) => void;
  currentPersona?: UserPersona;
  isGerencia: boolean;
  isSubGerencia?: boolean;
  onNavigateToTasks?: () => void;
  onNavigateToDashboard?: () => void;
}

export const GerencialMetricsAndStatisticsView: React.FC<GerencialMetricsAndStatisticsViewProps> = ({
  tasks,
  expenses,
  currentPeriod,
  onPeriodChange,
  currentPersona,
  isGerencia,
  isSubGerencia = false,
  onNavigateToTasks,
  onNavigateToDashboard,
}) => {
  // 1. Estados Principales de Control
  const [timeMode, setTimeMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [focusedMetric, setFocusedMetric] = useState<'all' | 'workload' | 'efficiency' | 'financial' | 'clients' | 'conditions'>('all');
  const [chartTypePreference, setChartTypePreference] = useState<'line' | 'bar' | 'mixed'>('line');
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Estado del Modal de Fórmulas Hubbard
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [selectedFormulaId, setSelectedFormulaId] = useState<HubbardConditionId>('normal');

  // 2. Cálculo de Datos Estadísticos (Mensual o Anual)
  const statsData: CompanyStatisticsData = useMemo(() => {
    if (timeMode === 'monthly') {
      return computeMonthlyCompanyStatistics(currentPeriod, tasks, expenses);
    } else {
      return computeYearlyCompanyStatistics(selectedYear, tasks, expenses);
    }
  }, [timeMode, currentPeriod, selectedYear, tasks, expenses]);

  const handleOpenConditionFormula = (condition: HubbardConditionFormula) => {
    setSelectedFormulaId(condition.id);
    setIsFormulaModalOpen(true);
  };

  // Exportar Reporte de Estadísticas a PDF
  const handleExportStatsPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Red Corporate Bar
    doc.setFillColor(190, 38, 41);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Header Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVICT SECURITY SOLUTIONS S.A.', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('INFORME ESTADÍSTICO GERENCIAL & FÓRMULAS DE LAS CONDICIONES HUBBARD', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 12, { align: 'right' });

    // Title
    doc.setTextColor(20, 25, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const subTitleText =
      timeMode === 'monthly'
        ? `ANÁLISIS ESTADÍSTICO MENSUAL · ${formatPeriodName(currentPeriod).toUpperCase()}`
        : `EVOLUCIÓN ESTADÍSTICA INTERANUAL · AÑO ${selectedYear}`;
    doc.text(subTitleText, 14, 29);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Evaluación de carga laboral, eficacia operativa, rendimiento económico y condiciones de funcionamiento corporativo.',
      14,
      35
    );

    // Summary Table
    const summaryRows = [
      [
        statsData.workloadSeries.title,
        statsData.workloadSeries.currentValue.toString(),
        statsData.workloadSeries.unit,
        statsData.workloadSeries.currentCondition.badgeTitle,
        `${statsData.workloadSeries.slopePercentage >= 0 ? '+' : ''}${statsData.workloadSeries.slopePercentage}%`,
        statsData.workloadSeries.responsible,
      ],
      [
        statsData.efficiencySeries.title,
        `${statsData.efficiencySeries.currentValue}%`,
        statsData.efficiencySeries.unit,
        statsData.efficiencySeries.currentCondition.badgeTitle,
        `${statsData.efficiencySeries.slopePercentage >= 0 ? '+' : ''}${statsData.efficiencySeries.slopePercentage}%`,
        statsData.efficiencySeries.responsible,
      ],
      [
        statsData.financialSeries.title,
        `$ ${statsData.financialSeries.currentValue.toLocaleString('es-AR')}`,
        statsData.financialSeries.unit,
        statsData.financialSeries.currentCondition.badgeTitle,
        `${statsData.financialSeries.slopePercentage >= 0 ? '+' : ''}${statsData.financialSeries.slopePercentage}%`,
        statsData.financialSeries.responsible,
      ],
      [
        statsData.clientReportsSeries.title,
        statsData.clientReportsSeries.currentValue.toString(),
        statsData.clientReportsSeries.unit,
        statsData.clientReportsSeries.currentCondition.badgeTitle,
        `${statsData.clientReportsSeries.slopePercentage >= 0 ? '+' : ''}${statsData.clientReportsSeries.slopePercentage}%`,
        statsData.clientReportsSeries.responsible,
      ],
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Estadística Corporativa', 'Valor Actual', 'Unidad', 'Condición Hubbard Detectada', 'Tendencia', 'Responsable']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { bottom: 15, left: 14, right: 14 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(140, 150, 165);
      doc.text(
        `INVICT Security Solutions S.A. · Sistema de Gestión Gerencial y Matriz Operativa · Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    doc.save(`INVICT_Estadisticas_Gerenciales_${timeMode === 'monthly' ? currentPeriod : selectedYear}.pdf`);
  };

  // Exportar Reporte de Estadísticas Completo a JPG
  const handleExportStatsJPG = async () => {
    if (!dashboardRef.current || isExportingJPG) return;
    try {
      setIsExportingJPG(true);
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        backgroundColor: '#090b0f',
        useCORS: true,
        logging: false,
        windowWidth: 1400,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const periodLabel = timeMode === 'monthly' ? currentPeriod : selectedYear;
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `INVICT_Metricas_Gerenciales_Conjunto_${periodLabel}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exportando conjunto de métricas a JPG:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  return (
    <div ref={dashboardRef} className="space-y-6">
      {/* 1. Header Principal y Tarjeta de Identificación */}
      <div className="p-5 bg-[#121620] border border-[#232b3d] rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Sector Exclusivo de Gerencia General (C-Level)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300 font-semibold">
              Tecnología Administrativa Hubbard
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
            Métricas y Estadísticas Corporativas
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Panel directivo integral con análisis de tendencias, gráficas de líneas y barras, evaluación de la carga laboral y fórmulas exactas de las condiciones para optimizar la toma de decisiones empresariales.
          </p>
        </div>

        {/* Acciones Superiores */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedFormulaId('normal');
              setIsFormulaModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b2333] hover:bg-[#253046] text-white font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
            title="Consultar el manual oficial de Fórmulas de las Condiciones de Existencia"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Fórmulas de las Condiciones</span>
          </button>

          <button
            type="button"
            onClick={handleExportStatsPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            title="Exportar estadísticas a documento oficial PDF"
          >
            <Download className="w-4 h-4" />
            <span>Exportar (PDF)</span>
          </button>

          <button
            type="button"
            disabled={isExportingJPG}
            onClick={handleExportStatsJPG}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Exportar todo el panel de métricas en conjunto como imagen JPG en alta resolución"
          >
            {isExportingJPG ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span>Exportar (JPG)</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Control de Vistas (Mensual vs Anual + Selector de Gráfico Enfocado + Tipo de Gráfico) */}
      <div className="p-4 bg-[#141926] border border-[#232c3f] rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Izquierda: Selector de Modo Temporal (Mensual vs Anual) y Período */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-[#0d1017] border border-[#263148] p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setTimeMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeMode === 'monthly'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gráficos Mensuales
            </button>
            <button
              type="button"
              onClick={() => setTimeMode('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeMode === 'yearly'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gráficos Anuales
            </button>
          </div>

          {/* Selector de Período Mensual o Anual */}
          {timeMode === 'monthly' ? (
            <div className="flex items-center gap-1.5 bg-[#0e121c] border border-[#263148] px-2.5 py-1 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <button
                type="button"
                onClick={() => onPeriodChange(getAdjacentPeriod(currentPeriod, 'prev'))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-white font-mono px-1">
                {formatPeriodName(currentPeriod)}
              </span>
              <button
                type="button"
                onClick={() => onPeriodChange(getAdjacentPeriod(currentPeriod, 'next'))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-[#0e121c] border border-[#263148] px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400 font-semibold">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-white font-bold font-mono focus:outline-none cursor-pointer"
              >
                <option value="2026" className="bg-[#141926] text-white">2026 (Ejercicio Actual)</option>
                <option value="2025" className="bg-[#141926] text-white">2025 (Histórico)</option>
                <option value="2024" className="bg-[#141926] text-white">2024 (Histórico)</option>
              </select>
            </div>
          )}
        </div>

        {/* Derecha: Selector de Métrica a Enfocar y Tipo de Trazado */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Métrica */}
          <div className="flex items-center gap-2 bg-[#0e121c] border border-[#263148] px-3 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-slate-400 font-semibold">Mostrar:</span>
            <select
              value={focusedMetric}
              onChange={(e) => setFocusedMetric(e.target.value as any)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer max-w-[210px] truncate"
            >
              <option value="all" className="bg-[#141926] text-white">Todas las Métricas Corporativas</option>
              <option value="workload" className="bg-[#141926] text-white">1. Carga Laboral de la Oficina</option>
              <option value="efficiency" className="bg-[#141926] text-white">2. Eficacia del Personal</option>
              <option value="financial" className="bg-[#141926] text-white">3. Rendimiento Financiero</option>
              <option value="clients" className="bg-[#141926] text-white">4. Informes & Casos de Clientes</option>
              <option value="conditions" className="bg-[#141926] text-white">5. Matriz de Fórmulas Hubbard</option>
            </select>
          </div>

          {/* Preferencia de Gráficos (Línea / Barra / Mixto) */}
          <div className="flex items-center bg-[#0d1017] border border-[#263148] p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setChartTypePreference('line')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                chartTypePreference === 'line'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Trazado de Líneas continuas"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Líneas</span>
            </button>
            <button
              type="button"
              onClick={() => setChartTypePreference('bar')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                chartTypePreference === 'bar'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Barras comparativas"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Barras</span>
            </button>
            <button
              type="button"
              onClick={() => setChartTypePreference('mixed')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                chartTypePreference === 'mixed'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Gráfico combinado"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixto</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Tarjetas Resumen Ejecutivo (KPI Scorecards Corporativos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Carga Laboral Total */}
        <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Carga Laboral Total
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
              {timeMode === 'monthly' ? 'Mes' : `Año ${selectedYear}`}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {statsData.workloadSeries.currentValue}{' '}
            <span className="text-xs font-normal text-slate-400">tareas</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1f2738]">
            <span>Tendencia:</span>
            <span
              className={`font-mono font-bold ${
                statsData.workloadSeries.slopePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {statsData.workloadSeries.slopePercentage >= 0 ? '+' : ''}
              {statsData.workloadSeries.slopePercentage}%
            </span>
          </div>
        </div>

        {/* KPI 2: Eficacia Promedio del Personal */}
        <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Eficacia del Personal
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300">
              Meta: 90%
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {statsData.efficiencySeries.currentValue}%
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1f2738]">
            <span>Estado:</span>
            <span className="font-bold text-emerald-400">
              {statsData.efficiencySeries.currentValue >= 85 ? 'Excelente Desempeño' : 'En Supervisión'}
            </span>
          </div>
        </div>

        {/* KPI 3: Facturación Consolidada */}
        <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Facturación a Clientes
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
              Consolidado
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            $ {Math.round(statsData.financialSeries.currentValue / 1000).toLocaleString('es-AR')}{' '}
            <span className="text-xs font-normal text-slate-400">mil</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1f2738]">
            <span>Margen Operativo:</span>
            <span className="font-mono font-bold text-emerald-400">+47% Bruto</span>
          </div>
        </div>

        {/* KPI 4: Condición Operativa General de la Empresa */}
        <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
              Condición Hubbard Global
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300">
              Diagnóstico
            </span>
          </div>
          <div
            className="text-lg font-black mt-1 truncate"
            style={{ color: statsData.workloadSeries.currentCondition.color }}
          >
            {statsData.workloadSeries.currentCondition.name}
          </div>
          <button
            type="button"
            onClick={() => handleOpenConditionFormula(statsData.workloadSeries.currentCondition)}
            className="text-left text-[11px] text-cyan-400 hover:text-cyan-300 font-bold mt-2 pt-2 border-t border-[#1f2738] flex items-center justify-between cursor-pointer"
          >
            <span>Ver fórmula aplicable</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Contenedores de Gráficos Oficiales */}
      <div className="space-y-6">
        {/* GRÁFICO 1: CARGA LABORAL GLOBAL */}
        {(focusedMetric === 'all' || focusedMetric === 'workload') && (
          <HubbardStatisticGraph
            series={statsData.workloadSeries}
            chartTypePreference={chartTypePreference}
            onSelectCondition={handleOpenConditionFormula}
            accentColor="#BE2629"
          />
        )}

        {/* GRÁFICO 2: EFICACIA DEL PERSONAL */}
        {(focusedMetric === 'all' || focusedMetric === 'efficiency') && (
          <HubbardStatisticGraph
            series={statsData.efficiencySeries}
            chartTypePreference={chartTypePreference}
            onSelectCondition={handleOpenConditionFormula}
            accentColor="#3b82f6"
          />
        )}

        {/* GRÁFICO 3: FINANZAS Y RENTABILIDAD */}
        {(focusedMetric === 'all' || focusedMetric === 'financial') && (
          <HubbardStatisticGraph
            series={statsData.financialSeries}
            chartTypePreference={chartTypePreference}
            onSelectCondition={handleOpenConditionFormula}
            accentColor="#10b981"
            isCurrency
          />
        )}

        {/* GRÁFICO 4: INFORMES Y CASOS DE CLIENTES */}
        {(focusedMetric === 'all' || focusedMetric === 'clients') && (
          <HubbardStatisticGraph
            series={statsData.clientReportsSeries}
            chartTypePreference={chartTypePreference}
            onSelectCondition={handleOpenConditionFormula}
            accentColor="#a855f7"
          />
        )}
      </div>

      {/* 5. Matriz Completa de las Fórmulas de las Condiciones Hubbard */}
      {(focusedMetric === 'all' || focusedMetric === 'conditions') && (
        <div className="p-5 bg-[#121620] border border-[#232b3d] rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#20293a] pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Matriz de las Fórmulas de las Condiciones (Hubbard College)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Guía ejecutiva de acción directa ante cada inclinación de las estadísticas de INVICT Security Solutions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFormulaId('normal');
                setIsFormulaModalOpen(true);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer self-start sm:self-auto"
            >
              Abrir manual completo en ventana ampliada →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Inexistencia */}
            <div
              onClick={() => {
                setSelectedFormulaId('inexistencia');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#141926] border border-slate-700 hover:border-slate-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-slate-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
                  <Activity className="w-4 h-4 text-slate-400" />
                  1. Inexistencia
                </span>
                <span className="text-[10px] font-mono text-slate-400">Nivel Cero</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                1. Línea de comunicación · 2. Dese a conocer · 3. Descubra lo que se necesita o desea · 4. Hágalo, prodúzcalo y/o preséntelo.
              </p>
              <span className="text-[11px] text-cyan-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver 4 pasos detallados →
              </span>
            </div>

            {/* 2. Peligro */}
            <div
              onClick={() => {
                setSelectedFormulaId('peligro_superior');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#1f1317] border border-red-700/70 hover:border-red-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-red-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-red-400">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  2. Peligro
                </span>
                <span className="text-[10px] font-mono text-red-300 bg-red-950 px-1.5 py-0.5 rounded">Caída Abrupta</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                Para el Superior: 1. Pase por alto · 2. Resuelva la situación · 3. Asigne Peligro al área · 4. Reorganice la unidad · 5. Política firme.
              </p>
              <span className="text-[11px] text-red-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver pasos de Superior e Individuo →
              </span>
            </div>

            {/* 3. Emergencia */}
            <div
              onClick={() => {
                setSelectedFormulaId('emergencia');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#1e1912] border border-amber-700/70 hover:border-amber-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-amber-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
                  <Flame className="w-4 h-4 text-amber-400" />
                  3. Emergencia
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded">Estancamiento</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                1. Promocione (Produzca) · 2. Cambie su forma de actuar · 3. Economice · 4. Prepárese para dar el servicio · 5. Más estricta disciplina.
              </p>
              <span className="text-[11px] text-amber-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver 5 pasos de Emergencia →
              </span>
            </div>

            {/* 4. Normal */}
            <div
              onClick={() => {
                setSelectedFormulaId('normal');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#111926] border border-blue-700/70 hover:border-blue-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-blue-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  4. Normal
                </span>
                <span className="text-[10px] font-mono text-blue-300 bg-blue-950 px-1.5 py-0.5 rounded">Aumento Gradual</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                1. NO CAMBIAR NADA (mantener el aumento) · 2. Ética muy poco severa · 3. Examinar cuidadosamente la mejora · 4. Remediar rápido si empeora.
              </p>
              <span className="text-[11px] text-blue-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver 4 pasos de Operación Normal →
              </span>
            </div>

            {/* 5. Afluencia */}
            <div
              onClick={() => {
                setSelectedFormulaId('afluencia');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#101e18] border border-emerald-700/70 hover:border-emerald-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-emerald-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                  <Award className="w-4 h-4 text-emerald-400" />
                  5. Afluencia
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded">Subida Empinada</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                1. Economice (sin derroche) · 2. Pague todas sus deudas · 3. Invierta en mejorar el servicio · 4. Descubra qué causó la Afluencia y refuércelo.
              </p>
              <span className="text-[11px] text-emerald-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver Afluencia Financiera y de Acción →
              </span>
            </div>

            {/* 6. Poder */}
            <div
              onClick={() => {
                setSelectedFormulaId('poder');
                setIsFormulaModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#181324] border border-purple-700/70 hover:border-purple-500 transition-all cursor-pointer group shadow"
            >
              <div className="flex items-center justify-between text-purple-300 mb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-purple-400">
                  <Zap className="w-4 h-4 text-purple-400" />
                  6. Poder
                </span>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-1.5 py-0.5 rounded">Cima Sostenida</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                1. No desconectarse · 2. Registro de líneas de comunicación · 3. Redactar funciones en detalle · 4. Hacer que el puesto se pueda ocupar.
              </p>
              <span className="text-[11px] text-purple-400 group-hover:underline font-semibold mt-2 inline-block">
                Ver Poder y Cambio de Poder →
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fórmulas de las Condiciones */}
      <HubbardConditionModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
        initialConditionId={selectedFormulaId}
      />
    </div>
  );
};
