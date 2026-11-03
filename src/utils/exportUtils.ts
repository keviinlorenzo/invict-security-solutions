import { Task, Expense, ExecutiveReportData } from '../types';
import {
  ClientBillingItem,
  EmployeeSalaryItem,
  FixedExpenseItem,
  BankExpenseItem,
  ClientProfitabilityItem,
  parseFlexibleHours
} from '../data/managerialSheetsData';
import { calculateDaysRemaining, formatCurrencyARS, formatDateLocale } from './dateUtils';

function escapeCSV(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function downloadFile(content: string, fileName: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTasksToCSV(tasks: Task[], fileName = 'INVICT_Planilla_Tareas.csv') {
  const headers = [
    'ID',
    'Puesto / Área',
    'Naturaleza',
    'Período Mensual',
    'Nombre de Tarea',
    'Responsable Asignado',
    'Email Responsable',
    'Estado',
    'Prioridad',
    'Fecha Inicio',
    'Fecha Límite',
    'Días Restantes / Alerta',
    'Categoría',
    'Observaciones & Novedades',
    'Última Modificación',
  ];

  const rows = tasks.map((t) => {
    const daysInfo = calculateDaysRemaining(t.dueDate, t.completedDate);
    const modInfo = t.lastModifiedBy ? `${t.lastModifiedBy.name} (${t.lastModifiedAt || ''})` : 'Planilla base';
    return [
      escapeCSV(t.id),
      escapeCSV(t.area),
      escapeCSV(t.nature || 'Fija Mensual'),
      escapeCSV(t.monthPeriod || '2026-10'),
      escapeCSV(t.title),
      escapeCSV(t.assignee),
      escapeCSV(t.assigneeEmail || ''),
      escapeCSV(t.status),
      escapeCSV(t.priority),
      escapeCSV(t.startDate || ''),
      escapeCSV(t.dueDate),
      escapeCSV(daysInfo.label),
      escapeCSV(t.category || ''),
      escapeCSV(t.notes || ''),
      escapeCSV(modInfo),
    ].join(';');
  });

  const watermarkHeader = '# ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A - Matriz de Tareas de Oficina\n';
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}

export function exportExpensesToCSV(expenses: Expense[], fileName = 'INVICT_Gastos_Oficina.csv') {
  const headers = [
    'ID',
    'Fecha',
    'Categoría',
    'Proveedor',
    'N° Factura / Comprobante',
    'Subtotal / Neto Gravado ($)',
    'Tasa IVA (%)',
    'Monto IVA ($)',
    'Retenciones ($)',
    'Total a Pagar / Monto ($ ARS)',
    'Estado de Pago',
    'Método de Pago',
    'Fecha Pago / Entrega Cheque',
    'Fecha Débito en Cuenta (Cheque/E-Check)',
    'N° Cheque / E-Check',
    'Responsable',
    'Detalle / Observaciones',
  ];

  const rows = expenses.map((e) => {
    const subtotal = e.subtotal !== undefined ? e.subtotal : Math.round(e.amount / 1.21);
    const vatRate = e.vatRate !== undefined ? e.vatRate : 21;
    const vatAmount = e.vatAmount !== undefined ? e.vatAmount : (e.amount - subtotal);
    const withholdings = e.withholdings !== undefined ? e.withholdings : 0;
    const isCheck = e.paymentMethod === 'Cheque Físico' || e.paymentMethod === 'E-Check';
    const payOrDeliveryDate = isCheck ? (e.checkDeliveryDate || e.date) : (e.paymentDate || e.date);
    const debitDate = isCheck ? (e.checkDebitDate || '') : '';

    return [
      escapeCSV(e.id),
      escapeCSV(e.date),
      escapeCSV(e.category),
      escapeCSV(e.provider),
      escapeCSV(e.invoiceNumber),
      escapeCSV(subtotal),
      escapeCSV(`${vatRate}%`),
      escapeCSV(vatAmount),
      escapeCSV(withholdings),
      escapeCSV(e.amount),
      escapeCSV(e.paymentStatus),
      escapeCSV(e.paymentMethod || 'Efectivo'),
      escapeCSV(payOrDeliveryDate),
      escapeCSV(debitDate),
      escapeCSV(e.checkNumber || ''),
      escapeCSV(e.responsible),
      escapeCSV(e.notes || ''),
    ].join(';');
  });

  const watermarkHeader = '# ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A - Rendición de Gastos de Oficina\n';
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}

// -------------------------------------------------------------
// MANAGERIAL SPREADSHEETS (EXCEL) CSV EXPORTERS - FILTER-AWARE
// -------------------------------------------------------------

export function exportClientsToCSV(clients: ClientBillingItem[], period: string = '2026-10', fileName?: string) {
  const headers = [
    'Cliente',
    'Tarifa Hora ($)',
    'Horas Totales (hs)',
    'Subtotal ($)',
    'IVA (21%) ($)',
    'Retenciones ($)',
    'Total Neto Facturado ($)',
    'Estado Cobranza',
    'N° Factura',
    'Fecha Vto.',
  ];

  const rows = clients.map((c) => {
    const hInfo = parseFlexibleHours(c.totalHoursInput !== undefined ? c.totalHoursInput : c.totalHours);
    const subtotal = Math.round(c.hourlyRate * hInfo.decimalHours);
    return [
      escapeCSV(c.clientName),
      escapeCSV(c.hourlyRate),
      escapeCSV(hInfo.formattedLabel),
      escapeCSV(subtotal),
      escapeCSV(c.vatAmount),
      escapeCSV(c.withholdings),
      escapeCSV(c.totalNet),
      escapeCSV(c.status),
      escapeCSV(c.invoiceNumber || ''),
      escapeCSV(c.dueDate || ''),
    ].join(';');
  });

  const watermarkHeader = `# INVICT SECURITY SOLUTIONS S.A. - CLIENTES (FACTURACIÓN) - PERÍODO: ${period}\n`;
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName || `INVICT_Clientes_Facturacion_${period}.csv`, 'text/csv;charset=utf-8;');
}

export function exportSalariesToCSV(salaries: EmployeeSalaryItem[], period: string = '2026-10', fileName?: string) {
  const headers = [
    '#',
    'Apellido y Nombre',
    'Objetivo / Función',
    'Recibo ($)',
    'X ($)',
    'Sueldo Neto ($)',
    'Anticipo Solicitado ($)',
    'Neto Cobrado ($)',
    'Estado Pago',
  ];

  const rows = salaries.map((s) => {
    const recAmt = s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary;
    const extAmt = s.extraAmount !== undefined ? s.extraAmount : 0;
    const netSalary = Math.round(recAmt + extAmt);
    const netoCobrado = Math.max(0, netSalary - s.advance);
    return [
      escapeCSV(s.index),
      escapeCSV(s.fullName),
      escapeCSV(s.objectiveOrRole),
      escapeCSV(recAmt),
      escapeCSV(extAmt),
      escapeCSV(netSalary),
      escapeCSV(s.advance),
      escapeCSV(netoCobrado),
      escapeCSV(s.status),
    ].join(';');
  });

  const watermarkHeader = `# INVICT SECURITY SOLUTIONS S.A. - SUELDOS PERSONAL - PERÍODO: ${period}\n`;
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName || `INVICT_Sueldos_Personal_${period}.csv`, 'text/csv;charset=utf-8;');
}

export function exportFixedExpensesToCSV(fixedExpenses: FixedExpenseItem[], period: string = '2026-10', fileName?: string) {
  const headers = [
    'Categoría',
    'Concepto / Detalle',
    'Monto Final ($)',
    'Estado',
    'Comentarios & Observaciones',
  ];

  const rows = fixedExpenses.map((f) => [
    escapeCSV(f.category),
    escapeCSV(f.concept),
    escapeCSV(f.amount),
    escapeCSV(f.status),
    escapeCSV(f.comment || ''),
  ].join(';'));

  const watermarkHeader = `# INVICT SECURITY SOLUTIONS S.A. - GASTOS FIJOS SOCIETARIOS - PERÍODO: ${period}\n`;
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName || `INVICT_Gastos_Fijos_${period}.csv`, 'text/csv;charset=utf-8;');
}

export function exportBankExpensesToCSV(bankExpenses: BankExpenseItem[], period: string = '2026-10', fileName?: string) {
  const headers = [
    'Banco / Entidad',
    'Concepto / Comisión / Débito',
    'Monto ($)',
    'Fecha Débito',
    'Referencia / Comprobante',
    'Estado',
    'Comentario',
  ];

  const rows = bankExpenses.map((b) => [
    escapeCSV(b.bank),
    escapeCSV(b.concept),
    escapeCSV(b.amount),
    escapeCSV(b.date || ''),
    escapeCSV(b.reference || ''),
    escapeCSV(b.status),
    escapeCSV(b.comment || ''),
  ].join(';'));

  const watermarkHeader = `# INVICT SECURITY SOLUTIONS S.A. - GASTOS BANCARIOS - PERÍODO: ${period}\n`;
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName || `INVICT_Gastos_Bancarios_${period}.csv`, 'text/csv;charset=utf-8;');
}

export function exportProfitabilityToCSV(profitability: ClientProfitabilityItem[], period: string = '2026-10', fileName?: string) {
  const headers = [
    'Cliente',
    'Facturación Neta ($)',
    'Costo Directo ($)',
    'Margen Bruto ($)',
    'Margen Neto ($)',
    'Margen Neto (%)',
  ];

  const rows = profitability.map((p) => [
    escapeCSV(p.clientName),
    escapeCSV(p.netBilling),
    escapeCSV(p.directCost),
    escapeCSV(p.grossMargin),
    escapeCSV(p.netMargin),
    escapeCSV(`${p.netMarginPercent}%`),
  ].join(';'));

  const watermarkHeader = `# INVICT SECURITY SOLUTIONS S.A. - RENTABILIDAD POR CLIENTE - PERÍODO: ${period}\n`;
  const csvContent = '\uFEFF' + watermarkHeader + headers.map(escapeCSV).join(';') + '\n' + rows.join('\n');
  downloadFile(csvContent, fileName || `INVICT_Rentabilidad_Clientes_${period}.csv`, 'text/csv;charset=utf-8;');
}

export function exportExecutiveReportToCSV(
  reportData: ExecutiveReportData,
  tasks: Task[],
  expenses: Expense[],
  fileName = 'INVICT_Informe_Ejecutivo_Avanzado.csv'
) {
  const summaryHeader = [
    '# ==========================================================================',
    '# INVICT SECURITY SOLUTIONS S.A. - INFORME EJECUTIVO Y AUDITORÍA C-LEVEL',
    `# Período Auditado: ${reportData.periodName} (${reportData.period})`,
    `# Fecha de Emisión: ${reportData.generatedDate} | Emitido por: ${reportData.generatedBy}`,
    '# ==========================================================================',
    '',
    '### INDICADORES CLAVE DE RENDIMIENTO (KPIs) ###',
    `Cumplimiento Global:;${reportData.complianceRate}%;(${reportData.completedTasks} de ${reportData.totalTasks} tareas concluidas)`,
    `Tareas en Curso:;${reportData.inProgressTasks}`,
    `Tareas Vencidas / En Mora:;${reportData.overdueTasks}`,
    `Tareas Urgentes:;${reportData.urgentTasks}`,
    `Total Gastos Mendoza:;$ ${reportData.totalExpenses.toLocaleString('es-AR')} ARS;(Presupuesto $3.2M - ${reportData.budgetUtilization}% ejecutado)`,
    '',
    '### SECCIÓN 1: RENDIMIENTO POR PUESTO DE TRABAJO ###',
    ['Puesto', 'Responsable', 'Total Tareas', 'Completadas', 'En Curso', 'Vencidas', '% Cumplimiento'].map(escapeCSV).join(';'),
  ];

  const areaRows = reportData.areaBreakdown.map(a => [
    escapeCSV(a.areaName),
    escapeCSV(a.responsible),
    escapeCSV(a.total),
    escapeCSV(a.completed),
    escapeCSV(a.pending),
    escapeCSV(a.overdue),
    escapeCSV(`${a.rate}%`),
  ].join(';'));

  const tasksSection = [
    '',
    '### SECCIÓN 2: MATRIZ DE TAREAS DE OFICINA CENTRAL ###',
    ['Área', 'Tarea', 'Responsable', 'Estado', 'Prioridad', 'Límite', 'Alerta', 'Notas'].map(escapeCSV).join(';'),
  ];

  const taskRows = tasks.map(t => {
    const daysInfo = calculateDaysRemaining(t.dueDate, t.completedDate);
    return [
      escapeCSV(t.area),
      escapeCSV(t.title),
      escapeCSV(t.assignee),
      escapeCSV(t.status),
      escapeCSV(t.priority),
      escapeCSV(t.dueDate),
      escapeCSV(daysInfo.label),
      escapeCSV(t.notes || '')
    ].join(';');
  });

  const finalCSV = [
    '\uFEFF' + summaryHeader.join('\n'),
    ...areaRows,
    tasksSection.join('\n'),
    ...taskRows,
  ].join('\n');

  downloadFile(finalCSV, fileName, 'text/csv;charset=utf-8;');
}

export function exportConsolidatedReportToCSV(
  tasks: Task[],
  expenses: Expense[],
  fileName = 'INVICT_Reporte_Consolidado_Gerencial.csv'
) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completada').length;
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const summarySection = [
    '# ======================================================',
    '# INVICT SECURITY SOLUTIONS S.A. - INFORME CONSOLIDADO C-LEVEL',
    `# Fecha de Auditoría: ${new Date().toISOString().slice(0, 10)}`,
    `# Total Tareas: ${totalTasks} | Completadas: ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%)`,
    `# Total Gastos de Oficina: $ ${totalExpenses.toLocaleString('es-AR')} ARS`,
    '# ======================================================',
    '',
    '### SECCION 1: MATRIZ DE TAREAS DE OFICINA CENTRAL ###',
  ].join('\n');

  const taskHeaders = [
    'Área', 'Naturaleza', 'Período', 'Tarea', 'Responsable', 'Estado', 'Prioridad', 'Límite', 'Alerta', 'Notas'
  ];

  const taskRows = tasks.map(t => {
    const daysInfo = calculateDaysRemaining(t.dueDate, t.completedDate);
    return [
      escapeCSV(t.area),
      escapeCSV(t.nature || 'Fija Mensual'),
      escapeCSV(t.monthPeriod || '2026-10'),
      escapeCSV(t.title),
      escapeCSV(t.assignee),
      escapeCSV(t.status),
      escapeCSV(t.priority),
      escapeCSV(t.dueDate),
      escapeCSV(daysInfo.label),
      escapeCSV(t.notes || '')
    ].join(';');
  });

  const expenseSection = [
    '',
    '### SECCION 2: RENDICION DE GASTOS DE OFICINA ###',
    ['Fecha', 'Categoría', 'Proveedor', 'Factura', 'Monto ARS', 'Estado', 'Responsable'].map(escapeCSV).join(';')
  ].join('\n');

  const expenseRows = expenses.map(e => [
    escapeCSV(e.date),
    escapeCSV(e.category),
    escapeCSV(e.provider),
    escapeCSV(e.invoiceNumber),
    escapeCSV(e.amount),
    escapeCSV(e.paymentStatus),
    escapeCSV(e.responsible)
  ].join(';'));

  const finalCSV = [
    '\uFEFF' + summarySection,
    taskHeaders.map(escapeCSV).join(';'),
    ...taskRows,
    expenseSection,
    ...expenseRows
  ].join('\n');

  downloadFile(finalCSV, fileName, 'text/csv;charset=utf-8;');
}

export const exportConsolidatedCSV = exportConsolidatedReportToCSV;
