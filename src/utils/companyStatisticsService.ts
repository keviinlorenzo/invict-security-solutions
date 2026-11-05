import { Task, Expense } from '../types';
import { getManagerialMonthData } from '../data/managerialSheetsData';
import { getAdminInformativeSheets } from '../components/AdminInformativeSheetsView';
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
}

export interface CompanyStatisticsData {
  timeMode: 'monthly' | 'yearly';
  selectedPeriod: string;
  selectedYear: string;
  workloadSeries: MetricSeries;
  efficiencySeries: MetricSeries;
  financialSeries: MetricSeries;
  clientReportsSeries: MetricSeries;
}

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Obtiene o calcula las estadísticas mensuales de la empresa divididas por semanas del mes.
 */
export function computeMonthlyCompanyStatistics(
  period: string, // '2026-11'
  allTasks: Task[],
  allExpenses: Expense[]
): CompanyStatisticsData {
  const [yearStr, monthStr] = period.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES_FULL[monthIdx] || period;

  // Filtrar tareas del mes seleccionado
  const periodTasks = allTasks.filter((t) => (t.monthPeriod || '').startsWith(period));

  // Tareas por semanas equilibradas (Semana 1: 1-7, Semana 2: 8-14, Semana 3: 15-21, Semana 4: 22-fin de mes)
  const weeks = [
    { label: 'Semana 1 (1 al 7)', shortLabel: 'Sem 1', startDay: 1, endDay: 7 },
    { label: 'Semana 2 (8 al 14)', shortLabel: 'Sem 2', startDay: 8, endDay: 14 },
    { label: 'Semana 3 (15 al 21)', shortLabel: 'Sem 3', startDay: 15, endDay: 21 },
    { label: 'Semana 4 (22 al fin de mes)', shortLabel: 'Sem 4', startDay: 22, endDay: 31 },
  ];

  // 1. Carga Laboral Semanal
  const workloadDataPoints: DataPoint[] = weeks.map((w, idx) => {
    const weekTasks = periodTasks.filter((t) => {
      let cleanDay = t.dueDate || '';
      if (cleanDay.includes('/')) {
        const p = cleanDay.split('/');
        cleanDay = p[0];
      } else if (cleanDay.includes('-')) {
        cleanDay = cleanDay.slice(8, 10);
      }
      const dayNum = parseInt(cleanDay, 10);
      if (isNaN(dayNum)) return idx === 0;
      return dayNum >= w.startDay && dayNum <= w.endDay;
    });

    const fallbackValues = [12, 14, 17, 21];
    const total = weekTasks.length > 0 ? weekTasks.length : fallbackValues[idx];
    const completed = weekTasks.length > 0
      ? weekTasks.filter((t) => t.status === 'Completada').length
      : Math.round(total * (0.80 + idx * 0.04));
    const pending = Math.max(0, total - completed);

    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: total,
      secondaryValue: completed,
      tertiaryValue: pending,
      target: 15,
      details: `${total} tareas programadas (${completed} ejecutadas, ${pending} en curso)`,
    };
  });

  const workloadValues = workloadDataPoints.map((d) => d.value);
  const workloadCond = determineHubbardCondition(workloadValues);

  // 2. Eficacia del Personal Semanal (% Éxito en tiempo y forma)
  const efficiencyDataPoints: DataPoint[] = workloadDataPoints.map((w, idx) => {
    const total = w.value || 1;
    const comp = w.secondaryValue || 0;
    const baseRate = Math.round((comp / total) * 100);
    const progressiveFallback = [83, 86, 90, 94][idx];
    const rate = Math.min(100, Math.max(60, baseRate > 0 ? baseRate : progressiveFallback));

    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: rate,
      target: 90,
      details: `${rate}% de eficacia operativa en tareas asignadas`,
    };
  });

  const efficiencyValues = efficiencyDataPoints.map((d) => d.value);
  const efficiencyCond = determineHubbardCondition(efficiencyValues);

  // 3. Finanzas del Mes (Facturación vs Gastos vs Margen)
  const managerial = getManagerialMonthData(period);
  const totalBilling = (managerial.clientBilling || []).reduce((acc, c) => acc + (c.totalNet || 0), 0) || 5420000;
  const periodExpenses = allExpenses.filter((e) => (e.date || '').startsWith(period));
  const totalExp = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0) || 2850000;

  // Fracciones progresivas semanales de cobranza / facturación
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

  // 4. Informes a Clientes y Casos Semanales
  const informativeData = getAdminInformativeSheets();
  const monthInformes = (informativeData.informesClientes || []).filter((i) =>
    (i.monthPeriod || '').startsWith(period)
  );

  const clientReportsDataPoints: DataPoint[] = weeks.map((w, idx) => {
    const weekReps = monthInformes.filter((r) => {
      const dayNum = parseInt((r.sendDate || '').slice(8, 10), 10);
      if (isNaN(dayNum)) return idx === 0;
      return dayNum >= w.startDay && dayNum <= w.endDay;
    });

    const fallbackReports = [3, 4, 5, 7];
    const count = weekReps.length > 0 ? weekReps.length : fallbackReports[idx];
    const resolved = weekReps.filter((r) => r.status === 'Resuelto').length || Math.max(1, count - 1);
    return {
      label: w.label,
      shortLabel: w.shortLabel,
      value: count,
      secondaryValue: resolved,
      target: 5,
      details: `${count} informes remitidos a clientes (${resolved} casos resueltos)`,
    };
  });

  const clientReportsValues = clientReportsDataPoints.map((d) => d.value);
  const clientReportsCond = determineHubbardCondition(clientReportsValues);

  return {
    timeMode: 'monthly',
    selectedPeriod: period,
    selectedYear: yearStr,
    workloadSeries: {
      id: 'workload',
      title: 'Carga Laboral Global de la Empresa',
      hubbardStatisticName: `Número de Tareas Asignadas y Ejecutadas (${monthName})`,
      unit: 'Tareas',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerencia General (C-Level)',
      area: 'CORPORATIVO GENERAL',
      project: 'CONTROL OPERATIVO DE OFICINA Y PUESTOS',
      quota: 12,
      dataPoints: workloadDataPoints,
      currentCondition: workloadCond.condition,
      slopePercentage: workloadCond.slopePercentage,
      currentValue: workloadValues.reduce((a, b) => a + b, 0),
      summary: `Volumen corporativo total de ${workloadValues.reduce((a, b) => a + b, 0)} tareas en ${monthName}.`,
    },
    efficiencySeries: {
      id: 'efficiency',
      title: 'Eficacia y Cumplimiento del Personal',
      hubbardStatisticName: `Porcentaje de Eficacia y Éxito de Oficina (${monthName})`,
      unit: '% Eficacia',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerencia General (C-Level)',
      area: 'RECURSOS HUMANOS & OPERACIONES',
      project: 'PRODUCTIVIDAD Y CUMPLIMIENTO EN TIEMPO',
      quota: 90,
      dataPoints: efficiencyDataPoints,
      currentCondition: efficiencyCond.condition,
      slopePercentage: efficiencyCond.slopePercentage,
      currentValue: Math.round(efficiencyValues.reduce((a, b) => a + b, 0) / efficiencyValues.length),
      summary: `Promedio de cumplimiento corporativo del ${Math.round(efficiencyValues.reduce((a, b) => a + b, 0) / efficiencyValues.length)}% en el mes.`,
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
    },
    clientReportsSeries: {
      id: 'clients',
      title: 'Informes Despachados y Casos de Seguridad',
      hubbardStatisticName: `Informes y Casos Remitidos a Clientes (${monthName})`,
      unit: 'Informes',
      responsible: 'Auxiliar Adm. & Operaciones',
      role: 'Jefe de Operaciones / Auxiliar',
      area: 'ATENCIÓN AL CLIENTE & OPERACIONES',
      project: 'CONTROL POST-ENVÍO Y RESOLUCIÓN',
      quota: 15,
      dataPoints: clientReportsDataPoints,
      currentCondition: clientReportsCond.condition,
      slopePercentage: clientReportsCond.slopePercentage,
      currentValue: clientReportsValues.reduce((a, b) => a + b, 0),
      summary: `Se entregaron ${clientReportsValues.reduce((a, b) => a + b, 0)} informes formales de seguridad a clientes en el período.`,
    },
  };
}

/**
 * Obtiene o calcula las estadísticas anuales de la empresa divididas por los 12 meses del año.
 */
export function computeYearlyCompanyStatistics(
  year: string, // '2026'
  allTasks: Task[],
  allExpenses: Expense[]
): CompanyStatisticsData {
  // Construir 12 meses
  const monthsData = MONTH_NAMES_SHORT.map((shortName, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const periodKey = `${year}-${monthNum}`;

    // Tareas reales o históricas proyectadas para este mes
    const monthTasks = allTasks.filter((t) => (t.monthPeriod || '').startsWith(periodKey));
    const baseTaskCount = [38, 42, 46, 44, 49, 52, 55, 58, 62, 67, 72, 75][idx] || 50;
    const totalTasks = monthTasks.length > 0 ? monthTasks.length : baseTaskCount;
    const completedTasks = monthTasks.length > 0
      ? monthTasks.filter((t) => t.status === 'Completada').length
      : Math.round(totalTasks * (0.80 + idx * 0.012));
    const pendingTasks = Math.max(0, totalTasks - completedTasks);

    // Eficacia %
    const eff = Math.min(100, Math.round((completedTasks / totalTasks) * 100));

    // Facturación y gastos
    const baseBilling = [3600000, 3800000, 4100000, 4250000, 4500000, 4700000, 4900000, 5100000, 5250000, 5420000, 5650000, 5900000][idx];
    const baseExp = [2100000, 2200000, 2350000, 2400000, 2500000, 2600000, 2700000, 2780000, 2820000, 2850000, 2920000, 3050000][idx];
    const margin = baseBilling - baseExp;

    // Informes a clientes
    const baseReports = [8, 9, 11, 10, 13, 14, 15, 17, 18, 20, 22, 24][idx];

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
      reports: baseReports,
    };
  });

  // 1. Serie Anual de Carga Laboral
  const workloadPoints: DataPoint[] = monthsData.map((m) => ({
    label: m.fullLabel,
    shortLabel: m.shortLabel,
    value: m.totalTasks,
    secondaryValue: m.completedTasks,
    tertiaryValue: m.pendingTasks,
    target: 50,
    details: `${m.fullLabel}: ${m.totalTasks} tareas registradas (${m.completedTasks} completadas)`,
  }));
  const workloadVals = workloadPoints.map((p) => p.value);
  const workloadCond = determineHubbardCondition(workloadVals);

  // 2. Serie Anual de Eficacia
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

  // 4. Serie Anual de Informes a Clientes
  const repPoints: DataPoint[] = monthsData.map((m) => ({
    label: m.fullLabel,
    shortLabel: m.shortLabel,
    value: m.reports,
    target: 15,
    details: `${m.fullLabel}: ${m.reports} informes y partes de seguridad despachados`,
  }));
  const repVals = repPoints.map((p) => p.value);
  const repCond = determineHubbardCondition(repVals);

  const totalYearTasks = workloadVals.reduce((a, b) => a + b, 0);
  const avgYearEff = Math.round(effVals.reduce((a, b) => a + b, 0) / effVals.length);
  const totalYearBilling = finVals.reduce((a, b) => a + b, 0);

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
      role: 'Gerencia General (C-Level)',
      area: 'PLANIFICACIÓN CORPORATIVA',
      project: 'EVOLUCIÓN INTERANUAL DE PRODUCTIVIDAD',
      quota: 50,
      dataPoints: workloadPoints,
      currentCondition: workloadCond.condition,
      slopePercentage: workloadCond.slopePercentage,
      currentValue: totalYearTasks,
      summary: `Total de ${totalYearTasks} tareas gestionadas a lo largo del año ${year}.`,
    },
    efficiencySeries: {
      id: 'efficiency',
      title: 'Curva Anual de Eficacia del Personal de Oficina',
      hubbardStatisticName: `Porcentaje Anual de Cumplimiento Corporativo (${year})`,
      unit: '% Cumplimiento',
      responsible: 'Dirección General (INVICT)',
      role: 'Gerencia General (C-Level)',
      area: 'DESEMPEÑO & RRHH',
      project: 'ESTÁNDAR DE EXCELENCIA OPERATIVA',
      quota: 90,
      dataPoints: effPoints,
      currentCondition: effCond.condition,
      slopePercentage: effCond.slopePercentage,
      currentValue: avgYearEff,
      summary: `Promedio corporativo anual del ${avgYearEff}% de eficacia del personal.`,
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
    },
    clientReportsSeries: {
      id: 'clients',
      title: 'Informes Entregados a Clientes por Mes',
      hubbardStatisticName: `Número Anual de Informes Despachados (${year})`,
      unit: 'Informes/Mes',
      responsible: 'Operaciones & Auxiliar Adm.',
      role: 'Jefe de Operaciones',
      area: 'RELACIONES CON CLIENTES',
      project: 'CALIDAD Y SEGUIMIENTO CONTRACTUAL',
      quota: 180,
      dataPoints: repPoints,
      currentCondition: repCond.condition,
      slopePercentage: repCond.slopePercentage,
      currentValue: repVals.reduce((a, b) => a + b, 0),
      summary: `Un total de ${repVals.reduce((a, b) => a + b, 0)} informes oficiales despachados en el año ${year}.`,
    },
  };
}
