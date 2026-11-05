import React, { useState, useMemo, useRef } from 'react';
import { Task, Expense, UserPersona, AreaType } from '../types';
import {
  computeMonthlyCompanyStatistics,
  computeYearlyCompanyStatistics,
  CompanyStatisticsData,
  COMPANY_POSTS_METADATA,
  PostStatisticItem
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
  Loader2,
  Globe,
  UserCheck,
  Compass,
  FileSpreadsheet,
  ClipboardCheck,
  Crown
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
  // 1. Estados Principales de Control y Navegación
  const [viewScope, setViewScope] = useState<'global' | 'posts'>('global');
  const [selectedPostArea, setSelectedPostArea] = useState<'ALL' | AreaType>('ALL');
  const [postMetricType, setPostMetricType] = useState<'both' | 'workload' | 'efficiency'>('both');
  const [timeMode, setTimeMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [chartTypePreference, setChartTypePreference] = useState<'line' | 'bar' | 'mixed'>('line');
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Estado del Modal de Fórmulas Hubbard
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [selectedFormulaId, setSelectedFormulaId] = useState<HubbardConditionId>('normal');

  // 2. Cálculo de Datos Estadísticos (Mensual o Anual, Global y por Puestos)
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

  // Filtrado de puestos para la vista distribuida
  const displayedPosts = useMemo(() => {
    if (selectedPostArea === 'ALL') {
      return statsData.allPostsList;
    }
    return statsData.allPostsList.filter((p) => p.area === selectedPostArea);
  }, [statsData.allPostsList, selectedPostArea]);

  // Exportar Reporte de Estadísticas a PDF Oficial
  const handleExportStatsPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Barra Corporativa Roja
    doc.setFillColor(190, 38, 41);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Membrete
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVICT SECURITY SOLUTIONS S.A.', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('AUDITORÍA ESTADÍSTICA GERENCIAL & FÓRMULAS DE CONDICIONES HUBBARD', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 12, { align: 'right' });

    // Título Principal
    doc.setTextColor(20, 25, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const subTitleText =
      timeMode === 'monthly'
        ? `INFORME ESTADÍSTICO MENSUAL · ${formatPeriodName(currentPeriod).toUpperCase()}`
        : `EVOLUCIÓN INTERANUAL ESTADÍSTICA · AÑO ${selectedYear}`;
    doc.text(subTitleText, 14, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Evaluación consolidada de la empresa y desglose individual de desempeño por cada puesto y usuario responsable.',
      14,
      33
    );

    // Tabla de Métricas Globales
    const globalRows = [
      [
        'Carga Laboral Global',
        'Dirección General',
        statsData.workloadSeries.currentValue.toString(),
        'Tareas',
        statsData.workloadSeries.currentCondition.badgeTitle,
        `${statsData.workloadSeries.slopePercentage >= 0 ? '+' : ''}${statsData.workloadSeries.slopePercentage}%`,
      ],
      [
        'Eficacia del Personal',
        'Oficina y Puestos',
        `${statsData.efficiencySeries.currentValue}%`,
        '% Cumplimiento',
        statsData.efficiencySeries.currentCondition.badgeTitle,
        `${statsData.efficiencySeries.slopePercentage >= 0 ? '+' : ''}${statsData.efficiencySeries.slopePercentage}%`,
      ],
      [
        'Flujo y Rentabilidad Financiera',
        'Dirección Financiera',
        `$ ${statsData.financialSeries.currentValue.toLocaleString('es-AR')}`,
        '$ Facturación',
        statsData.financialSeries.currentCondition.badgeTitle,
        `${statsData.financialSeries.slopePercentage >= 0 ? '+' : ''}${statsData.financialSeries.slopePercentage}%`,
      ],
    ];

    autoTable(doc, {
      startY: 37,
      head: [['Métrica Global', 'Responsable', 'Valor Actual', 'Unidad', 'Condición Detectada', 'Tendencia']],
      body: globalRows,
      theme: 'striped',
      headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });

    // Tabla de Desglose por Puestos
    const postRows = statsData.allPostsList.map((p) => [
      p.areaName,
      `${p.responsible} (${p.role})`,
      `${p.totalTasks} tareas (${p.completedTasks} ejec.)`,
      `${p.efficiencyPercentage}%`,
      p.workloadSeries.currentCondition.badgeTitle,
      `${p.workloadSeries.slopePercentage >= 0 ? '+' : ''}${p.workloadSeries.slopePercentage}%`,
    ]);

    const finalY = (doc as any).lastAutoTable.finalY + 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 25, 35);
    doc.text('DESGLOSE ESTADÍSTICO INDIVIDUAL POR PUESTOS / USUARIOS', 14, finalY);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['Puesto Operativo', 'Usuario / Cargo', 'Carga de Tareas', 'Eficacia', 'Condición Detectada', 'Tendencia']],
      body: postRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      margin: { bottom: 15, left: 14, right: 14 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(140, 150, 165);
      doc.text(
        `INVICT Security Solutions S.A. · Tecnología Administrativa Hubbard · Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    }

    doc.save(`INVICT_Estadisticas_Gerenciales_${timeMode === 'monthly' ? currentPeriod : selectedYear}.pdf`);
  };

  // Exportar Reporte Completo a JPG
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
            Gráficos oficiales distribuidos por cada puesto y usuario de la empresa, junto al análisis global consolidado. Los gráficos respetan estrictamente los colores de la clasificación de las condiciones Hubbard y se actualizan dinámicamente con la actividad real.
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
            title="Exportar todo el panel en conjunto como imagen JPG en alta resolución"
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

      {/* 2. Barra Principal de Navegación: Global vs Por Puestos / Usuarios */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111520] p-1.5 rounded-2xl border border-[#20293d]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewScope('global')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewScope === 'global'
                ? 'bg-[#BE2629] text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-[#1a2130]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>1. Análisis Global de la Empresa</span>
          </button>
          <button
            type="button"
            onClick={() => setViewScope('posts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewScope === 'posts'
                ? 'bg-[#BE2629] text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-[#1a2130]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Gráficos por Puestos & Usuarios ({statsData.allPostsList.length})</span>
          </button>
        </div>

        {/* Tipo de Gráfico Preferido */}
        <div className="flex items-center bg-[#0d1017] border border-[#263148] p-0.5 rounded-xl text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartTypePreference('line')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              chartTypePreference === 'line'
                ? 'bg-[#BE2629] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Líneas continuas"
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Líneas</span>
          </button>
          <button
            type="button"
            onClick={() => setChartTypePreference('bar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              chartTypePreference === 'bar'
                ? 'bg-[#BE2629] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Barras"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Barras</span>
          </button>
          <button
            type="button"
            onClick={() => setChartTypePreference('mixed')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              chartTypePreference === 'mixed'
                ? 'bg-[#BE2629] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Combinado"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mixto</span>
          </button>
        </div>
      </div>

      {/* 3. Barra de Control de Período y Filtros Específicos */}
      <div className="p-4 bg-[#141926] border border-[#232c3f] rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Izquierda: Selector Mensual vs Anual y Período */}
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
              Mensual
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
              Anual
            </button>
          </div>

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

        {/* Derecha: Filtros para la vista por Puestos */}
        {viewScope === 'posts' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro de Puesto Específico */}
            <div className="flex items-center gap-2 bg-[#0e121c] border border-[#263148] px-3 py-1.5 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-slate-400 font-semibold">Puesto:</span>
              <select
                value={selectedPostArea}
                onChange={(e) => setSelectedPostArea(e.target.value as any)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer max-w-[210px] truncate"
              >
                <option value="ALL" className="bg-[#141926] text-white">Todos los Puestos (8 puestos)</option>
                {COMPANY_POSTS_METADATA.map((p) => (
                  <option key={p.area} value={p.area} className="bg-[#141926] text-white">
                    {p.name} ({p.responsible})
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Métrica del Puesto */}
            <div className="flex items-center bg-[#0d1017] border border-[#263148] p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setPostMetricType('both')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  postMetricType === 'both' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ambas
              </button>
              <button
                type="button"
                onClick={() => setPostMetricType('workload')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  postMetricType === 'workload' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Carga
              </button>
              <button
                type="button"
                onClick={() => setPostMetricType('efficiency')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  postMetricType === 'efficiency' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Eficacia
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Scorecards Ejecutivos Resumen */}
      {viewScope === 'global' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Carga Laboral Total */}
          <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Carga Laboral Consolidada
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

          {/* KPI 2: Eficacia Global del Personal */}
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

          {/* KPI 4: Condición Hubbard Global */}
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
      ) : (
        /* KPI Scorecards para la Vista por Puestos */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Puestos Auditados
            </span>
            <div className="text-2xl font-black font-mono text-white">
              {displayedPosts.length}{' '}
              <span className="text-xs font-normal text-slate-400">
                {displayedPosts.length === 1 ? 'puesto' : 'puestos'}
              </span>
            </div>
            <span className="text-[10px] text-cyan-400 block mt-2">Monitoreo activo en tiempo real</span>
          </div>

          <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Mayor Eficacia
            </span>
            {(() => {
              const bestEff = [...statsData.allPostsList].sort((a, b) => b.efficiencyPercentage - a.efficiencyPercentage)[0];
              return (
                <>
                  <div className="text-2xl font-black font-mono text-emerald-300">
                    {bestEff?.efficiencyPercentage || 0}%
                  </div>
                  <span className="text-[10px] text-slate-300 block mt-2 truncate">
                    {bestEff?.responsible} ({bestEff?.areaName})
                  </span>
                </>
              );
            })()}
          </div>

          <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
              Mayor Volumen de Carga
            </span>
            {(() => {
              const topWorkload = [...statsData.allPostsList].sort((a, b) => b.totalTasks - a.totalTasks)[0];
              return (
                <>
                  <div className="text-2xl font-black font-mono text-rose-300">
                    {topWorkload?.totalTasks || 0} tareas
                  </div>
                  <span className="text-[10px] text-slate-300 block mt-2 truncate">
                    {topWorkload?.responsible} ({topWorkload?.areaName})
                  </span>
                </>
              );
            })()}
          </div>

          <div className="p-4 bg-[#121620] border border-[#232b3d] rounded-2xl shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
              Condiciones Hubbard en Puestos
            </span>
            <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                Afluencia / Normal
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-xs">
                Poder
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-2">Colores sincronizados con la referencia</span>
          </div>
        </div>
      )}

      {/* 5. Gráficos Oficiales */}
      <div className="space-y-6">
        {viewScope === 'global' ? (
          <>
            {/* GRÁFICO GLOBAL 1: CARGA LABORAL */}
            <HubbardStatisticGraph
              series={statsData.workloadSeries}
              chartTypePreference={chartTypePreference}
              onSelectCondition={handleOpenConditionFormula}
            />

            {/* GRÁFICO GLOBAL 2: EFICACIA DEL PERSONAL */}
            <HubbardStatisticGraph
              series={statsData.efficiencySeries}
              chartTypePreference={chartTypePreference}
              onSelectCondition={handleOpenConditionFormula}
            />

            {/* GRÁFICO GLOBAL 3: FINANZAS Y RENTABILIDAD */}
            <HubbardStatisticGraph
              series={statsData.financialSeries}
              chartTypePreference={chartTypePreference}
              onSelectCondition={handleOpenConditionFormula}
              isCurrency
            />
          </>
        ) : (
          /* GRÁFICOS DISTRIBUIDOS POR PUESTOS / USUARIOS */
          <div className="space-y-8">
            {displayedPosts.map((post) => (
              <div key={post.area} className="space-y-4 p-4 rounded-2xl bg-[#0f131c] border border-[#1e273a]">
                {/* Cabecera del Puesto */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f283d]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 ${post.avatarBg}`}>
                      {post.responsible.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${post.badgeClass}`}>
                          {post.areaName}
                        </span>
                        <span className="text-xs text-slate-300 font-semibold">
                          Responsable: <strong className="text-white">{post.responsible}</strong>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">({post.role})</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {post.totalTasks} tareas registradas · {post.completedTasks} completadas · Eficacia: <strong className="text-emerald-400">{post.efficiencyPercentage}%</strong>
                      </p>
                    </div>
                  </div>

                  {/* Acciones de Condición Hubbard del Puesto */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-2.5 py-1 rounded-xl text-xs font-bold border"
                      style={{
                        color: post.workloadSeries.currentCondition.color,
                        borderColor: `${post.workloadSeries.currentCondition.color}60`,
                        backgroundColor: `${post.workloadSeries.currentCondition.color}15`,
                      }}
                    >
                      {post.workloadSeries.currentCondition.badgeTitle}
                    </span>
                  </div>
                </div>

                {/* Gráficos del Puesto (Carga y/o Eficacia) */}
                <div className="space-y-6">
                  {(postMetricType === 'both' || postMetricType === 'workload') && (
                    <HubbardStatisticGraph
                      series={post.workloadSeries}
                      chartTypePreference={chartTypePreference}
                      onSelectCondition={handleOpenConditionFormula}
                    />
                  )}

                  {(postMetricType === 'both' || postMetricType === 'efficiency') && (
                    <HubbardStatisticGraph
                      series={post.efficiencySeries}
                      chartTypePreference={chartTypePreference}
                      onSelectCondition={handleOpenConditionFormula}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Matriz Completa de las Fórmulas de las Condiciones Hubbard */}
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

      {/* Modal de Fórmulas de las Condiciones */}
      <HubbardConditionModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
        initialConditionId={selectedFormulaId}
      />
    </div>
  );
};
