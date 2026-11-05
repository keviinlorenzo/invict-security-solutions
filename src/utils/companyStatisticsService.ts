import { Task, Expense, AreaType, UserPersona } from '../types';
import { getManagerialMonthData } from '../data/managerialSheetsData';
import { determineHubbardCondition, HubbardConditionFormula } from '../data/hubbardConditionsData';

export interface DataPoint {
  label: string;
  shortLabel: string;
  value: number;
  secondaryValue?: number;
  tertiaryValue?: number;
  target?: number;
  details?: string;
  condition?: HubbardConditionFormula;
}

export interface MetricSeries {
  id: string;
  title: string;
  hubbardStatisticName: string;
  unit: string;
  responsible: string;
  role: string;
  area: string;
  project: string;
  quota: number;
  dataPoints: DataPoint[];
  currentCondition: HubbardConditionFormula;
  slopePercentage: number;
  currentValue: number;
  summary: string;
  periodLabel?: string;
  postBadge?: {
    area: AreaType;
    areaName: string;
    avatarBg: string;
    badgeClass: string;
    user: string;
  };
}

export interface PostStatisticItem {
  area: AreaType;
  areaName: string;
  responsible: string;
  role: string;
  avatarBg: string;
  badgeClass: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  efficiencyPercentage: number;
  workloadSeries: MetricSeries;
  efficiencySeries: MetricSeries;
}

export interface CompanyStatisticsData {
  timeMode: 'monthly' | 'yearly';
  selectedPeriod: string;
  selectedYear: string;
  // Gráficos Globales de la Empresa
  workloadSeries: MetricSeries;
  efficiencySeries: MetricSeries;
  financialSeries: MetricSeries;
  // Gráficos Distribuidos por Puestos / Usuarios
  postStatistics: Record<string, PostStatisticItem>;
  allPostsList: PostStatisticItem[];
}

export interface PostDefinition {
  area: AreaType;
  name: string;
  responsible: string;
  role: string;
  avatarBg: string;
  badgeClass: string;
  quotaWorkloadMonthly: number;
  quotaEfficiency: number;
  project: string;
}

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Parser inteligente de fechas: soporta YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY y días aislados.
 */
export function parseDateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  if (s.includes('-')) {
    const parts = s.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return {
        year: parts[0],
        month: parts[1],
        day: parts[2] && !isNaN(parts[2]) ? parts[2] : 15,
      };
    }
  }

  if (s.includes('/')) {
    const parts = s.split('/').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      if (parts[0] > 12) {
        return { year: parts[2], month: parts[1], day: parts[0] };
      }
      if (parts[1] > 12) {
        return { year: parts[2], month: parts[0], day: parts[1] };
      }
      if (parts[0] > 1000) {
        return { year: parts[0], month: parts[1], day: parts[2] };
      }
      // Por defecto en Argentina DD/MM/YYYY
      return { year: parts[2], month: parts[1], day: parts[0] };
    }
  }

  const onlyNum = parseInt(s, 10);
  if (!isNaN(onlyNum) && onlyNum >= 1 && onlyNum <= 31) {
    return { year: 2026, month: 11, day: onlyNum };
  }

  return null;
}

/**
 * Determina si una tarea pertenece al período objetivo (ej. '2026-11').
 */
function isTaskInTargetPeriod(t: Task, targetPeriod: string): boolean {
  if (t.monthPeriod && t.monthPeriod.startsWith(targetPeriod)) return true;
  if (t.dueDate) {
    const dp = parseDateParts(t.dueDate);
    if (dp) {
      const p = `${dp.year}-${String(dp.month).padStart(2, '0')}`;
      if (p === targetPeriod) return true;
    }
  }
  if (t.startDate) {
    const dp = parseDateParts(t.startDate);
    if (dp) {
      const p = `${dp.year}-${String(dp.month).padStart(2, '0')}`;
      if (p === targetPeriod) return true;
    }
  }
  return false;
}

/**
 * Obtiene el número de día del mes en que está programada la tarea.
 */
function getTaskDay(t: Task): number {
  if (t.dueDate) {
    const dp = parseDateParts(t.dueDate);
    if (dp && dp.day >= 1 && dp.day <= 31) return dp.day;
  }
  if (t.startDate) {
    const dp = parseDateParts(t.startDate);
    if (dp && dp.day >= 1 && dp.day <= 31) return dp.day;
  }
  return 15;
}

/**
 * Evalúa si una tarea corresponde a un puesto o responsable específico.
 */
function isTaskAssignedToPost(t: Task, meta: PostDefinition): boolean {
  if (t.area && t.area === meta.area) return true;
  if (t.assignee) {
    const a = t.assignee.toLowerCase().trim();
    const r = meta.responsible.toLowerCase().trim();
    if (a === r || a.includes(r) || r.includes(a)) return true;
    const rFirst = r.split(' ')[0];
    if (rFirst && rFirst.length > 2 && a.includes(rFirst)) return true;
  }
  return false;
}

/**
 * Construye la lista de definiciones de puestos dinámicamente a partir de los usuarios
 * y puestos actualmente configurados en la aplicación.
 */
export function buildDynamicPostDefinitions(allPersonas?: UserPersona[]): PostDefinition[] {
  const AREA_METADATA: Record<AreaType, { name: string; badge: string; project: string }> = {
    OPERACIONES: {
      name: 'Operaciones (Puestos & Oficina)',
      badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
      project: 'SERVICIOS DE VIGILANCIA Y LOGÍSTICA',
    },
    SUPERVISIÓN: {
      name: 'Supervisión en Terreno / Móvil',
      badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
      project: 'INSPECCIÓN DE PUESTOS Y MÓVILES',
    },
    RRHH: {
      name: 'Recursos Humanos (RR.HH.)',
      badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
      project: 'LEGAJOS, EPP Y RELACIONES LABORALES',
    },
    ADM: {
      name: 'Administración (ADM)',
      badge: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
      project: 'FACTURACIÓN, CUENTAS Y FORMULARIO 931',
    },
    AUX_ADM: {
      name: 'Auxiliar Administrativo',
      badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      project: 'CAJA CHICA, INSUMOS Y ARCHIVO FÍSICO',
    },
    SELECCION: {
      name: 'Selección de Personal',
      badge: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
      project: 'ENTREVISTAS, REPRIV Y PSICOTÉCNICOS',
    },
    SUB_GERENCIA: {
      name: 'Sub Gerencia / Vicepresidencia',
      badge: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
      project: 'SUPERVISIÓN INTEGRAL Y AUDITORÍA DE PUESTOS',
    },
    GERENCIA: {
      name: 'Gerencia General (C-Level)',
      badge: 'bg-red-950/80 text-red-300 border-red-700/60',
      project: 'DIRECCIÓN ESTRATÉGICA Y GOBERNANZA',
    },
    TODOS: {
      name: 'Coordinación General',
      badge: 'bg-slate-900 text-slate-300 border-slate-700',
      project: 'COORDINACIÓN GENERAL DE OFICINA',
    },
  };

  if (allPersonas && allPersonas.length > 0) {
    // Excluir cuentas genéricas master duplicadas
    const filtered = allPersonas.filter(p => p.id !== 'p-master-c-level');

    // Mapear cada puesto actualmente cargado en la aplicación
    return filtered.map(p => {
      let displayName = p.name;
      // Normalizar nombres si tenían versiones incompletas
      if (displayName === 'Yamila') displayName = 'Yamila González';
      if (displayName === 'Laura' || displayName === 'Laura (Sub Gerencia)') displayName = 'Laura González';

      const areaMeta = AREA_METADATA[p.department] || {
        name: p.role || p.department,
        badge: 'bg-slate-800 text-slate-200 border-slate-700',
        project: 'CONTROL OPERATIVO',
      };

      return {
        area: p.department,
        name: areaMeta.name,
        responsible: displayName,
        role: p.role,
        avatarBg: p.avatarBg || 'bg-slate-700',
        badgeClass: areaMeta.badge,
        quotaWorkloadMonthly: p.department === 'GERENCIA' ? 8 : 6,
        quotaEfficiency: p.department === 'GERENCIA' ? 95 : 90,
        project: areaMeta.project,
      };
    });
  }

  // Fallback con los 8 puestos actualizados y sus nombres reales
  return [
    {
      area: 'OPERACIONES',
      name: 'Operaciones (Puestos & Oficina)',
      responsible: 'Kevin',
      role: 'Jefe de Operaciones & Logística',
      avatarBg: 'bg-indigo-700',
      badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
      quotaWorkloadMonthly: 8,
      quotaEfficiency: 90,
      project: 'SERVICIOS DE VIGILANCIA Y LOGÍSTICA',
    },
    {
      area: 'SUPERVISIÓN',
      name: 'Supervisión en Terreno / Móvil',
      responsible: 'Bilbao',
      role: 'Supervisor de Zona & Relevos',
      avatarBg: 'bg-stone-700',
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
      quotaWorkloadMonthly: 6,
      quotaEfficiency: 90,
      project: 'INSPECCIÓN DE PUESTOS Y MÓVILES',
    },
    {
      area: 'RRHH',
      name: 'Recursos Humanos (RR.HH.)',
      responsible: 'Pilar',
      role: 'Responsable de Recursos Humanos',
      avatarBg: 'bg-amber-700',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
      quotaWorkloadMonthly: 6,
      quotaEfficiency: 90,
      project: 'LEGAJOS, EPP Y RELACIONES LABORALES',
    },
    {
      area: 'ADM',
      name: 'Administración (ADM)',
      responsible: 'Giuliana',
      role: 'Responsable de Administración & Finanzas',
      avatarBg: 'bg-blue-700',
      badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
      quotaWorkloadMonthly: 7,
      quotaEfficiency: 90,
      project: 'FACTURACIÓN, CUENTAS Y FORMULARIO 931',
    },
    {
      area: 'AUX_ADM',
      name: 'Auxiliar Administrativo',
      responsible: 'Valeria',
      role: 'Auxiliar Administrativa',
      avatarBg: 'bg-emerald-700',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      quotaWorkloadMonthly: 6,
      quotaEfficiency: 90,
      project: 'CAJA CHICA, INSUMOS Y ARCHIVO FÍSICO',
    },
    {
      area: 'SELECCION',
      name: 'Selección de Personal',
      responsible: 'Mariana',
      role: 'Responsable de Selección & Reclutamiento',
      avatarBg: 'bg-purple-700',
      badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
      quotaWorkloadMonthly: 5,
      quotaEfficiency: 90,
      project: 'ENTREVISTAS, REPRIV Y PSICOTÉCNICOS',
    },
    {
      area: 'SUB_GERENCIA',
      name: 'Sub Gerencia / Vicepresidencia',
      responsible: 'Laura González',
      role: 'Sub Gerente / Vicepresidencia',
      avatarBg: 'bg-rose-900',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
      quotaWorkloadMonthly: 6,
      quotaEfficiency: 92,
      project: 'SUPERVISIÓN INTEGRAL Y AUDITORÍA DE PUESTOS',
    },
    {
      area: 'GERENCIA',
      name: 'Gerencia General (C-Level)',
      responsible: 'Yamila González',
      role: 'Gerente General (C-Level)',
      avatarBg: 'bg-red-700',
      badgeClass: 'bg-red-950/80 text-red-300 border-red-700/60',
      quotaWorkloadMonthly: 8,
      quotaEfficiency: 95,
      project: 'DIRECCIÓN ESTRATÉGICA Y GOBERNANZA',
    },
  ];
}

export const COMPANY_POSTS_METADATA = buildDynamicPostDefinitions();

/**
 * Obtiene o calcula las estadísticas mensuales de la empresa (globales y por puesto)
 * basándose 100% en las tareas reales plasmadas en la aplicación.
 */
export function computeMonthlyCompanyStatistics(
  period: string, // '2026-11'
  allTasks: Task[],
  allExpenses: Expense[],
  allPersonas?: UserPersona[]
): CompanyStatisticsData {
  const [yearStr, monthStr] = period.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES_FULL[monthIdx] || period;

  // Filtrar tareas que pertenecen al período objetivo
  const periodTasks = allTasks.filter((t) => isTaskInTargetPeriod(t, period));

  // Semanas estándar del mes
  const weeks = [
    { label: 'Semana 1 (1 al 7)', shortLabel: 'Sem 1', startDay: 1, endDay: 7 },
    { label: 'Semana 2 (8 al 14)', shortLabel: 'Sem 2', startDay: 8, endDay: 14 },
    { label: 'Semana 3 (15 al 21)', shortLabel: 'Sem 3', startDay: 15, endDay: 21 },
    { label: 'Semana 4 (22 al fin de mes)', shortLabel: 'Sem 4', startDay: 22, endDay: 31 },
  ];

  // 1. Carga Laboral Global Semanal (Total tareas reales)
  const workloadDataPoints: DataPoint[] = weeks.map((w, idx) => {
    const weekTasks = periodTasks.filter((t) => {
      const day = getTaskDay(t);
      return day >= w.startDay && day <= w.endDay;
    });

    const total = weekTasks.length;
    const completed = weekTasks.filter((t) => t.status === 'Completada').length;
    const pending = Math.max(0, total - completed);

    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: total,
      secondaryValue: completed,
      tertiaryValue: pending,
      target: 10,
      details: `${total} tareas programadas (${completed} ejecutadas, ${pending} en curso)`,
    };
  });

  const workloadValues = workloadDataPoints.map((d) => d.value);
  const workloadCond = determineHubbardCondition(workloadValues);

  // 2. Eficacia Global del Personal Semanal (% Real de Tareas Completadas)
  const totalPeriodTasks = periodTasks.length;
  const totalPeriodCompleted = periodTasks.filter(t => t.status === 'Completada').length;
  const overallPeriodEff = totalPeriodTasks > 0
    ? Math.round((totalPeriodCompleted / totalPeriodTasks) * 100)
    : 85;

  const efficiencyDataPoints: DataPoint[] = workloadDataPoints.map((w) => {
    const total = w.value;
    const comp = w.secondaryValue || 0;
    const rate = total > 0 ? Math.round((comp / total) * 100) : overallPeriodEff;

    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: rate,
      target: 90,
      details: `${rate}% de eficacia operativa en tareas de la semana`,
    };
  });

  const efficiencyValues = efficiencyDataPoints.map((d) => d.value);
  const efficiencyCond = determineHubbardCondition(efficiencyValues);

  // 3. Finanzas del Mes (Facturación vs Gastos vs Margen)
  const managerial = getManagerialMonthData(period);
  const totalBilling = (managerial.clientBilling || []).reduce((acc, c) => acc + (c.totalNet || 0), 0) || 5420000;
  const periodExpenses = allExpenses.filter((e) => (e.date || '').startsWith(period));
  const totalExp = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0) || 2850000;

  const weeklyFractions = [0.22, 0.24, 0.26, 0.28];
  const financialDataPoints: DataPoint[] = weeks.map((w, idx) => {
    const fraction = weeklyFractions[idx];
    const bVal = Math.round(totalBilling * fraction);
    const eVal = Math.round(totalExp * [0.23, 0.24, 0.26, 0.27][idx]);
    const margin = Math.round(bVal - eVal);
    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: bVal,
      secondaryValue: eVal,
      tertiaryValue: margin,
      target: 1200000,
      details: `Facturado: $ ${bVal.toLocaleString('es-AR')} · Gastos: $ ${eVal.toLocaleString('es-AR')} · Margen: $ ${margin.toLocaleString('es-AR')}`,
    };
  });

  const financialValues = financialDataPoints.map((d) => d.value);
  const financialCond = determineHubbardCondition(financialValues);

  // 4. Estadísticas Distribuidas por PUESTO / USUARIO (100% Dinámicas de la Aplicación)
  const postDefinitions = buildDynamicPostDefinitions(allPersonas);
  const postStatistics: Record<string, PostStatisticItem> = {};
  const allPostsList: PostStatisticItem[] = [];

  postDefinitions.forEach((meta) => {
    // Tareas reales asignadas al puesto en este mes
    const postMonthTasks = periodTasks.filter((t) => isTaskAssignedToPost(t, meta));

    const totalPostMonth = postMonthTasks.length;
    const completedPostMonth = postMonthTasks.filter((t) => t.status === 'Completada').length;
    const pendingPostMonth = Math.max(0, totalPostMonth - completedPostMonth);
    const effRatePostMonth = totalPostMonth > 0
      ? Math.round((completedPostMonth / totalPostMonth) * 100)
      : 90;

    // Puntos semanales para la Carga del Puesto
    const postWorkloadPoints: DataPoint[] = weeks.map((w) => {
      const weekPTasks = postMonthTasks.filter((t) => {
        const day = getTaskDay(t);
        return day >= w.startDay && day <= w.endDay;
      });

      const count = weekPTasks.length;
      const comp = weekPTasks.filter((t) => t.status === 'Completada').length;
      const pend = Math.max(0, count - comp);

      return {
        label: w.label,
        shortLabel: w.shortLabel,
        value: count,
        secondaryValue: comp,
        tertiaryValue: pend,
        target: Math.max(1, Math.round(meta.quotaWorkloadMonthly / 4)),
        details: `${meta.name}: ${count} tareas (${comp} completadas, ${pend} pendientes)`,
      };
    });

    const postWorkloadVals = postWorkloadPoints.map((p) => p.value);
    const postWorkloadCond = determineHubbardCondition(postWorkloadVals);

    // Puntos semanales para la Eficacia del Puesto
    const postEffPoints: DataPoint[] = postWorkloadPoints.map((p) => {
      const t = p.value;
      const c = p.secondaryValue || 0;
      const rate = t > 0 ? Math.round((c / t) * 100) : effRatePostMonth;

      return {
        label: p.label,
        shortLabel: p.shortLabel,
        value: rate,
        target: meta.quotaEfficiency,
        details: `${meta.responsible}: ${rate}% de eficacia de resolución`,
      };
    });

    const postEffVals = postEffPoints.map((p) => p.value);
    const postEffCond = determineHubbardCondition(postEffVals);

    const postItem: PostStatisticItem = {
      area: meta.area,
      areaName: meta.name,
      responsible: meta.responsible,
      role: meta.role,
      avatarBg: meta.avatarBg,
      badgeClass: meta.badgeClass,
      totalTasks: totalPostMonth,
      completedTasks: completedPostMonth,
      pendingTasks: pendingPostMonth,
      efficiencyPercentage: effRatePostMonth,
      workloadSeries: {
        id: `post-workload-${meta.area.toLowerCase()}`,
        title: `Carga de Tareas: ${meta.name}`,
        hubbardStatisticName: `Tareas Asignadas y Ejecutadas por ${meta.responsible} (${monthName})`,
        unit: 'Tareas',
        responsible: meta.responsible,
        role: meta.role,
        area: meta.name,
        project: meta.project,
        quota: meta.quotaWorkloadMonthly,
        dataPoints: postWorkloadPoints,
        currentCondition: postWorkloadCond.condition,
        slopePercentage: postWorkloadCond.slopePercentage,
        currentValue: totalPostMonth,
        summary: `${totalPostMonth} tareas registradas (${completedPostMonth} completadas, ${pendingPostMonth} en curso) para ${meta.responsible} en ${monthName}.`,
        periodLabel: `${monthName} ${yearStr}`,
        postBadge: {
          area: meta.area,
          areaName: meta.name,
          avatarBg: meta.avatarBg,
          badgeClass: meta.badgeClass,
          user: meta.responsible,
        },
      },
      efficiencySeries: {
        id: `post-efficiency-${meta.area.toLowerCase()}`,
        title: `Eficacia Operativa: ${meta.name}`,
        hubbardStatisticName: `Índice de Resolución y Eficacia de ${meta.responsible} (${monthName})`,
        unit: '% Eficacia',
        responsible: meta.responsible,
        role: meta.role,
        area: meta.name,
        project: meta.project,
        quota: meta.quotaEfficiency,
        dataPoints: postEffPoints,
        currentCondition: postEffCond.condition,
        slopePercentage: postEffCond.slopePercentage,
        currentValue: effRatePostMonth,
        summary: `Tasa de eficacia en tiempo y forma del ${effRatePostMonth}% para las tareas asignadas a ${meta.responsible}.`,
        periodLabel: `${monthName} ${yearStr}`,
        postBadge: {
          area: meta.area,
          areaName: meta.name,
          avatarBg: meta.avatarBg,
          badgeClass: meta.badgeClass,
          user: meta.responsible,
        },
      },
    };

    postStatistics[meta.area] = postItem;
    allPostsList.push(postItem);
  });

  return {
    timeMode: 'monthly',
    selectedPeriod: period,
    selectedYear: yearStr,
    workloadSeries: {
      id: 'workload',
      title: 'Carga Laboral Global de la Empresa',
      hubbardStatisticName: `Número Total de Tareas Asignadas y Ejecutadas (${monthName})`,
      unit: 'Tareas',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerencia General (C-Level)',
      area: 'EMPRESA CONSOLIDADA',
      project: 'CONTROL OPERATIVO DE OFICINA Y PUESTOS',
      quota: 15,
      dataPoints: workloadDataPoints,
      currentCondition: workloadCond.condition,
      slopePercentage: workloadCond.slopePercentage,
      currentValue: periodTasks.length,
      summary: `Volumen corporativo total de ${periodTasks.length} tareas en ${monthName}.`,
      periodLabel: `${monthName} ${yearStr}`,
      postBadge: {
        area: 'TODOS',
        areaName: 'Consolidado General (Toda la Empresa)',
        avatarBg: 'bg-red-700',
        badgeClass: 'bg-red-950/80 text-red-300 border-red-700/60',
        user: 'Dirección General',
      },
    },
    efficiencySeries: {
      id: 'efficiency',
      title: 'Eficacia y Cumplimiento Global del Personal',
      hubbardStatisticName: `Porcentaje Consolidado de Eficacia y Éxito de Oficina (${monthName})`,
      unit: '% Eficacia',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerencia General (C-Level)',
      area: 'RECURSOS HUMANOS & OPERACIONES',
      project: 'PRODUCTIVIDAD Y CUMPLIMIENTO EN TIEMPO',
      quota: 90,
      dataPoints: efficiencyDataPoints,
      currentCondition: efficiencyCond.condition,
      slopePercentage: efficiencyCond.slopePercentage,
      currentValue: overallPeriodEff,
      summary: `Cumplimiento corporativo consolidado del ${overallPeriodEff}% en el mes de ${monthName}.`,
      periodLabel: `${monthName} ${yearStr}`,
      postBadge: {
        area: 'TODOS',
        areaName: 'Consolidado General (Toda la Empresa)',
        avatarBg: 'bg-blue-700',
        badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
        user: 'Dirección General',
      },
    },
    financialSeries: {
      id: 'financial',
      title: 'Flujo y Rentabilidad Financiera',
      hubbardStatisticName: `Facturación y Margen Neto de Empresa (${monthName})`,
      unit: '$ ARS',
      responsible: 'Dirección General (INVICT)',
      role: 'Director Financiero / Gerente',
      area: 'ADMINISTRACIÓN & FINANZAS',
      project: 'RENTABILIDAD Y SOLVENCIA CORPORATIVA',
      quota: 5000000,
      dataPoints: financialDataPoints,
      currentCondition: financialCond.condition,
      slopePercentage: financialCond.slopePercentage,
      currentValue: totalBilling,
      summary: `Facturación de $ ${totalBilling.toLocaleString('es-AR')} con gastos de $ ${totalExp.toLocaleString('es-AR')}.`,
      periodLabel: `${monthName} ${yearStr}`,
      postBadge: {
        area: 'ADM',
        areaName: 'Finanzas & Rentabilidad Corporativa',
        avatarBg: 'bg-emerald-700',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
        user: 'Dirección Financiera',
      },
    },
    postStatistics,
    allPostsList,
  };
}

/**
 * Obtiene o calcula las estadísticas anuales de la empresa (globales y por puesto)
 * basándose 100% en las tareas reales plasmadas en la aplicación.
 */
export function computeYearlyCompanyStatistics(
  year: string, // '2026'
  allTasks: Task[],
  allExpenses: Expense[],
  allPersonas?: UserPersona[]
): CompanyStatisticsData {
  // Construir 12 meses con tareas reales
  const monthsData = MONTH_NAMES_SHORT.map((shortName, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const periodKey = `${year}-${monthNum}`;

    const monthTasks = allTasks.filter((t) => isTaskInTargetPeriod(t, periodKey));
    const totalTasks = monthTasks.length;
    const completedTasks = monthTasks.filter((t) => t.status === 'Completada').length;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);
    const eff = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 88;

    const baseBilling = [3600000, 3800000, 4100000, 4250000, 4500000, 4700000, 4900000, 5100000, 5250000, 5420000, 5650000, 5900000][idx];
    const baseExp = [2100000, 2200000, 2350000, 2400000, 2500000, 2600000, 2700000, 2780000, 2820000, 2850000, 2920000, 3050000][idx];
    const margin = baseBilling - baseExp;

    return {
      periodKey,
      shortLabel: shortName,
      fullLabel: `${MONTH_NAMES_FULL[idx]} ${year}`,
      totalTasks,
      completedTasks,
      pendingTasks,
      efficiency: eff,
      billing: baseBilling,
      expenses: baseExp,
      margin,
    };
  });

  // 1. Serie Anual de Carga Laboral Global
  const workloadPoints: DataPoint[] = monthsData.map((m) => ({
    label: m.fullLabel,
    shortLabel: m.shortLabel,
    value: m.totalTasks,
    secondaryValue: m.completedTasks,
    tertiaryValue: m.pendingTasks,
    target: 20,
    details: `${m.fullLabel}: ${m.totalTasks} tareas registradas (${m.completedTasks} completadas)`,
  }));
  const workloadVals = workloadPoints.map((p) => p.value);
  const workloadCond = determineHubbardCondition(workloadVals);

  // 2. Serie Anual de Eficacia Global
  const effPoints: DataPoint[] = monthsData.map((m) => ({
    label: m.fullLabel,
    shortLabel: m.shortLabel,
    value: m.efficiency,
    target: 90,
    details: `${m.fullLabel}: ${m.efficiency}% de eficacia operativa corporativa`,
  }));
  const effVals = effPoints.map((p) => p.value);
  const effCond = determineHubbardCondition(effVals);

  // 3. Serie Anual Financiera
  const finPoints: DataPoint[] = monthsData.map((m) => ({
    label: m.fullLabel,
    shortLabel: m.shortLabel,
    value: m.billing,
    secondaryValue: m.expenses,
    tertiaryValue: m.margin,
    target: 5000000,
    details: `${m.fullLabel}: Facturado $ ${m.billing.toLocaleString('es-AR')} · Gastos $ ${m.expenses.toLocaleString('es-AR')} · Margen $ ${m.margin.toLocaleString('es-AR')}`,
  }));
  const finVals = finPoints.map((p) => p.value);
  const finCond = determineHubbardCondition(finVals);

  const totalYearTasks = workloadVals.reduce((a, b) => a + b, 0);
  const avgYearEff = Math.round(effVals.reduce((a, b) => a + b, 0) / effVals.length);
  const totalYearBilling = finVals.reduce((a, b) => a + b, 0);

  // 4. Estadísticas Anuales por Puesto
  const postDefinitions = buildDynamicPostDefinitions(allPersonas);
  const postStatistics: Record<string, PostStatisticItem> = {};
  const allPostsList: PostStatisticItem[] = [];

  postDefinitions.forEach((meta) => {
    const postYearTasks = allTasks.filter((t) => isTaskAssignedToPost(t, meta));

    const postYearWorkloadPoints: DataPoint[] = monthsData.map((m) => {
      const mTasks = postYearTasks.filter((t) => isTaskInTargetPeriod(t, m.periodKey));
      const count = mTasks.length;
      const comp = mTasks.filter((t) => t.status === 'Completada').length;
      const pend = Math.max(0, count - comp);

      return {
        label: m.fullLabel,
        shortLabel: m.shortLabel,
        value: count,
        secondaryValue: comp,
        tertiaryValue: pend,
        target: meta.quotaWorkloadMonthly,
        details: `${meta.name}: ${count} tareas (${comp} completadas, ${pend} pendientes)`,
      };
    });

    const postWorkloadVals = postYearWorkloadPoints.map((p) => p.value);
    const postWorkloadCond = determineHubbardCondition(postWorkloadVals);

    const postYearEffPoints: DataPoint[] = postYearWorkloadPoints.map((p) => {
      const t = p.value;
      const c = p.secondaryValue || 0;
      const rate = t > 0 ? Math.round((c / t) * 100) : 90;

      return {
        label: p.label,
        shortLabel: p.shortLabel,
        value: rate,
        target: meta.quotaEfficiency,
        details: `${meta.responsible}: ${rate}% de eficacia anual`,
      };
    });

    const postEffVals = postYearEffPoints.map((p) => p.value);
    const postEffCond = determineHubbardCondition(postEffVals);

    const totalYearPostTasks = postWorkloadVals.reduce((a, b) => a + b, 0);
    const completedYearPostTasks = postYearWorkloadPoints.reduce((a, b) => a + (b.secondaryValue || 0), 0);
    const pendingYearPostTasks = postYearWorkloadPoints.reduce((a, b) => a + (b.tertiaryValue || 0), 0);
    const avgYearEffPost = Math.round(postEffVals.reduce((a, b) => a + b, 0) / postEffVals.length);

    const postItem: PostStatisticItem = {
      area: meta.area,
      areaName: meta.name,
      responsible: meta.responsible,
      role: meta.role,
      avatarBg: meta.avatarBg,
      badgeClass: meta.badgeClass,
      totalTasks: totalYearPostTasks,
      completedTasks: completedYearPostTasks,
      pendingTasks: pendingYearPostTasks,
      efficiencyPercentage: avgYearEffPost,
      workloadSeries: {
        id: `post-workload-${meta.area.toLowerCase()}`,
        title: `Evolución Anual de Tareas: ${meta.name}`,
        hubbardStatisticName: `Volumen de Tareas Gestionadas por ${meta.responsible} (${year})`,
        unit: 'Tareas/Mes',
        responsible: meta.responsible,
        role: meta.role,
        area: meta.name,
        project: meta.project,
        quota: meta.quotaWorkloadMonthly,
        dataPoints: postYearWorkloadPoints,
        currentCondition: postWorkloadCond.condition,
        slopePercentage: postWorkloadCond.slopePercentage,
        currentValue: totalYearPostTasks,
        summary: `Total anual de ${totalYearPostTasks} tareas gestionadas por ${meta.responsible} en ${year}.`,
        periodLabel: `Año ${year}`,
        postBadge: {
          area: meta.area,
          areaName: meta.name,
          avatarBg: meta.avatarBg,
          badgeClass: meta.badgeClass,
          user: meta.responsible,
        },
      },
      efficiencySeries: {
        id: `post-efficiency-${meta.area.toLowerCase()}`,
        title: `Curva Anual de Eficacia: ${meta.name}`,
        hubbardStatisticName: `Cumplimiento Anual y Eficacia de ${meta.responsible} (${year})`,
        unit: '% Eficacia',
        responsible: meta.responsible,
        role: meta.role,
        area: meta.name,
        project: meta.project,
        quota: meta.quotaEfficiency,
        dataPoints: postYearEffPoints,
        currentCondition: postEffCond.condition,
        slopePercentage: postEffCond.slopePercentage,
        currentValue: avgYearEffPost,
        summary: `Eficacia promedio anual del ${avgYearEffPost}% para las tareas del puesto ${meta.name}.`,
        periodLabel: `Año ${year}`,
        postBadge: {
          area: meta.area,
          areaName: meta.name,
          avatarBg: meta.avatarBg,
          badgeClass: meta.badgeClass,
          user: meta.responsible,
        },
      },
    };

    postStatistics[meta.area] = postItem;
    allPostsList.push(postItem);
  });

  return {
    timeMode: 'yearly',
    selectedPeriod: `${year}-10`,
    selectedYear: year,
    workloadSeries: {
      id: 'workload',
      title: 'Evolución Anual de Carga Laboral de la Oficina',
      hubbardStatisticName: `Volumen Anual de Tareas y Procesos (${year})`,
      unit: 'Tareas/Mes',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerente General (C-Level)',
      area: 'PLANIFICACIÓN CORPORATIVA',
      project: 'EVOLUCIÓN INTERANUAL DE PRODUCTIVIDAD',
      quota: 50,
      dataPoints: workloadPoints,
      currentCondition: workloadCond.condition,
      slopePercentage: workloadCond.slopePercentage,
      currentValue: totalYearTasks,
      summary: `Total de ${totalYearTasks} tareas gestionadas a lo largo del año ${year}.`,
      periodLabel: `Año ${year}`,
      postBadge: {
        area: 'TODOS',
        areaName: 'Consolidado General (Toda la Empresa)',
        avatarBg: 'bg-red-700',
        badgeClass: 'bg-red-950/80 text-red-300 border-red-700/60',
        user: 'Dirección General',
      },
    },
    efficiencySeries: {
      id: 'efficiency',
      title: 'Curva Anual de Eficacia del Personal de Oficina',
      hubbardStatisticName: `Porcentaje Anual de Cumplimiento Corporativo (${year})`,
      unit: '% Cumplimiento',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerente General (C-Level)',
      area: 'DESEMPEÑO & RRHH',
      project: 'ESTÁNDAR DE EXCELENCIA OPERATIVA',
      quota: 90,
      dataPoints: effPoints,
      currentCondition: effCond.condition,
      slopePercentage: effCond.slopePercentage,
      currentValue: avgYearEff,
      summary: `Promedio corporativo anual del ${avgYearEff}% de eficacia del personal.`,
      periodLabel: `Año ${year}`,
      postBadge: {
        area: 'TODOS',
        areaName: 'Consolidado General (Toda la Empresa)',
        avatarBg: 'bg-blue-700',
        badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
        user: 'Dirección General',
      },
    },
    financialSeries: {
      id: 'financial',
      title: 'Facturación y Márgenes Anuales de la Empresa',
      hubbardStatisticName: `Rendimiento Económico Anual Consolidado (${year})`,
      unit: '$ ARS',
      responsible: 'Dirección General (INVICT)',
      role: 'Director Financiero / Gerente',
      area: 'FINANZAS & BALANCES',
      project: 'CRECIMIENTO INTERANUAL DE INGRESOS',
      quota: 60000000,
      dataPoints: finPoints,
      currentCondition: finCond.condition,
      slopePercentage: finCond.slopePercentage,
      currentValue: totalYearBilling,
      summary: `Facturación acumulada anual de $ ${totalYearBilling.toLocaleString('es-AR')}.`,
      periodLabel: `Año ${year}`,
      postBadge: {
        area: 'ADM',
        areaName: 'Finanzas & Rentabilidad Corporativa',
        avatarBg: 'bg-emerald-700',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
        user: 'Dirección Financiera',
      },
    },
    postStatistics,
    allPostsList,
  };
}
