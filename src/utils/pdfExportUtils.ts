import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, Expense, ExecutiveReportData } from '../types';
import {
  ClientBillingItem,
  EmployeeSalaryItem,
  FixedExpenseItem,
  BankExpenseItem,
  ClientProfitabilityItem
} from '../data/managerialSheetsData';
import { calculateDaysRemaining, formatCurrencyARS, formatDateLocale } from './dateUtils';

const BRAND_RED: [number, number, number] = [190, 38, 41]; // #BE2629
const DARK_BG: [number, number, number] = [18, 22, 32];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

function addWatermarkAndHeader(
  doc: jsPDF,
  title: string,
  subtitle: string
) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Top Brand Bar
    doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Brand Title & Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVICT SECURITY SOLUTIONS S.A.', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('SEGURIDAD PRIVADA & CUSTODIA · SEDE CENTRAL', 14, 15);

    // Date stamp on right
    const dateStamp = `Fecha: ${new Date().toLocaleDateString('es-AR')}`;
    doc.text(dateStamp, pageWidth - 14, 12, { align: 'right' });

    // Document header info (first page only)
    if (i === 1) {
      doc.setTextColor(20, 25, 35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text(subtitle, 14, 34);
    }

    // Bottom Watermark & Creator Citation (Required by User)
    doc.setDrawColor(220, 225, 230);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
    doc.text('INVICT Security Solutions S.A. · Sistema de Gestión', 14, pageHeight - 7);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(
      `Página ${i} de ${pageCount} · Documento Oficial Reservado para Directorio C-Level`,
      pageWidth - 14,
      pageHeight - 7,
      { align: 'right' }
    );
  }
}

export function exportTasksToPDF(tasks: Task[], fileName = 'INVICT_Matriz_Tareas.pdf') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tableRows = tasks.map((t, idx) => {
    const daysInfo = calculateDaysRemaining(t.dueDate, t.completedDate);
    return [
      idx + 1,
      t.area,
      t.title,
      t.assignee,
      t.status,
      formatDateLocale(t.dueDate),
      daysInfo.label,
      t.priority,
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [[
      '#',
      'Puesto / Área',
      'Nombre de la Tarea',
      'Responsable',
      'Estado',
      'Límite',
      'Alerta',
      'Prioridad',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 24 },
      6: { cellWidth: 26 },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 28, fontStyle: 'bold' },
      9: { cellWidth: 16, halign: 'center' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    'Matriz Operativa y Control de Tareas Diarias',
    `Control de puestos de vigilancia, turnos de guardia y plazos de entrega · Total: ${tasks.length} tareas`
  );
  doc.save(fileName);
}

export function exportExpensesToPDF(expenses: Expense[], fileName = 'INVICT_Gastos_Mendoza.pdf') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const tableRows: any[] = expenses.map((e, idx) => [
    idx + 1,
    formatDateLocale(e.date),
    e.category,
    e.provider,
    e.invoiceNumber,
    formatCurrencyARS(e.amount),
    e.paymentStatus,
    e.responsible,
  ]);

  tableRows.push([
    '',
    '',
    'TOTAL GENERAL',
    '',
    '',
    formatCurrencyARS(totalAmount),
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [[
      '#',
      'Fecha',
      'Categoría',
      'Proveedor',
      'N° Factura',
      'Monto ($ ARS)',
      'Estado',
      'Responsable',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35 },
      3: { cellWidth: 40 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 25 },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    'Auditoría y Rendición de Gastos de Oficina',
    `Egresos en uniformes, combustible, tasas REPRIV y compras de oficina · Total: ${formatCurrencyARS(totalAmount)}`
  );
  doc.save(fileName);
}

// -------------------------------------------------------------
// MANAGERIAL SPREADSHEETS (EXCEL) PDF EXPORTERS - FILTER-AWARE
// -------------------------------------------------------------

export function exportClientsToPDF(
  clients: ClientBillingItem[],
  period: string = '2026-10',
  fileName = `INVICT_Planilla_Clientes_${period}.pdf`
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalNetSum = clients.reduce((acc, c) => acc + c.totalNet, 0);
  const totalHoursSum = clients.reduce((acc, c) => acc + c.totalHours, 0);

  const tableRows: any[] = clients.map((c, idx) => [
    idx + 1,
    c.clientName,
    formatCurrencyARS(c.hourlyRate),
    `${c.totalHours} hs`,
    formatCurrencyARS(c.hourlyRate * c.totalHours),
    formatCurrencyARS(c.vatAmount),
    formatCurrencyARS(c.withholdings),
    formatCurrencyARS(c.totalNet),
    c.status,
    c.invoiceNumber || '-',
    c.dueDate || '-',
  ]);

  tableRows.push([
    '',
    'TOTAL FACTURACIÓN CLIENTES',
    '',
    `${totalHoursSum} hs`,
    '',
    '',
    '',
    formatCurrencyARS(totalNetSum),
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [[
      '#',
      'Cliente',
      'Tarifa Hora',
      'Horas Totales',
      'Subtotal',
      'IVA (21%)',
      'Retenciones',
      'Total Neto',
      'Estado',
      'Factura',
      'Vencimiento',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 24, halign: 'center' },
      10: { cellWidth: 22, halign: 'center' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Planilla Gerencial: Clientes & Facturación Mensual (${period})`,
    `Cálculo automatizado de contratos, horas de vigilancia, IVA y retenciones impositivas · Facturación Neta: ${formatCurrencyARS(totalNetSum)}`
  );

  doc.save(fileName);
}

export function exportSalariesToPDF(
  salaries: EmployeeSalaryItem[],
  period: string = '2026-10',
  fileName = `INVICT_Planilla_Sueldos_${period}.pdf`
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalRecibo = salaries.reduce((acc, s) => acc + (s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary), 0);
  const totalExtra = salaries.reduce((acc, s) => acc + (s.extraAmount || 0), 0);
  const totalNet = totalRecibo + totalExtra;
  const totalAdv = salaries.reduce((acc, s) => acc + s.advance, 0);
  const totalCobrado = Math.max(0, totalNet - totalAdv);

  const tableRows: any[] = salaries.map((s) => {
    const recAmt = s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary;
    const extAmt = s.extraAmount !== undefined ? s.extraAmount : 0;
    const netSueldo = Math.round(recAmt + extAmt);
    const netoCobrado = Math.max(0, netSueldo - s.advance);
    return [
      s.index,
      s.fullName,
      s.objectiveOrRole,
      formatCurrencyARS(recAmt),
      formatCurrencyARS(extAmt),
      formatCurrencyARS(netSueldo),
      formatCurrencyARS(s.advance),
      formatCurrencyARS(netoCobrado),
      s.status,
    ];
  });

  tableRows.push([
    '',
    'TOTALES CONSOLIDADOS',
    '',
    formatCurrencyARS(totalRecibo),
    formatCurrencyARS(totalExtra),
    formatCurrencyARS(totalNet),
    formatCurrencyARS(totalAdv),
    formatCurrencyARS(totalCobrado),
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [[
      '#',
      'Apellido y Nombre',
      'Objetivo / Función',
      'Recibo ($)',
      'X ($)',
      'Sueldo Neto ($)',
      'Anticipo ($)',
      'Neto Cobrado ($)',
      'Estado',
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 46, fontStyle: 'bold' },
      2: { cellWidth: 52 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 20, halign: 'center' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Planilla Gerencial: Sueldos Personal de Vigilancia (${period})`,
    `Nómina operativa, sueldos netos, deducciones de anticipos y saldos a liquidar · Total Neto Nómina: ${formatCurrencyARS(totalNet)}`
  );

  doc.save(fileName);
}

export function exportFixedExpensesToPDF(
  fixedExpenses: FixedExpenseItem[],
  period: string = '2026-10',
  fileName = `INVICT_Planilla_Gastos_Fijos_${period}.pdf`
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalAmount = fixedExpenses.reduce((acc, f) => acc + f.amount, 0);

  const tableRows: any[] = fixedExpenses.map((f, idx) => [
    idx + 1,
    f.category,
    f.concept,
    formatCurrencyARS(f.amount),
    f.status,
    f.comment || '-',
  ]);

  tableRows.push([
    '',
    'TOTAL GASTOS FIJOS',
    '',
    formatCurrencyARS(totalAmount),
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Categoría', 'Concepto / Servicio Societario', 'Monto ($ ARS)', 'Estado', 'Comentarios']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 75 },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Planilla Gerencial: Gastos Fijos Societarios (${period})`,
    `Alquiler sede, pólizas de seguros, cánones REPRIV y asesorías corporativas · Total Egresos: ${formatCurrencyARS(totalAmount)}`
  );

  doc.save(fileName);
}

export function exportBankExpensesToPDF(
  bankExpenses: BankExpenseItem[],
  period: string = '2026-10',
  fileName = `INVICT_Planilla_Gastos_Bancarios_${period}.pdf`
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalAmount = bankExpenses.reduce((acc, b) => acc + b.amount, 0);

  const tableRows: any[] = bankExpenses.map((b, idx) => [
    idx + 1,
    b.bank,
    b.concept,
    formatCurrencyARS(b.amount),
    b.date || '-',
    b.reference || '-',
    b.status,
    b.comment || '-',
  ]);

  tableRows.push([
    '',
    'TOTAL GASTOS BANCARIOS',
    '',
    formatCurrencyARS(totalAmount),
    '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Banco / Entidad', 'Concepto / Comisión', 'Monto ($ ARS)', 'Fecha', 'Referencia', 'Estado', 'Comentarios']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 65 },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Planilla Gerencial: Gastos Bancarios & Débitos Fiscales (${period})`,
    `Impuesto Ley 25.413, comisiones de cuentas corrientes y débitos automáticos · Total Bancario: ${formatCurrencyARS(totalAmount)}`
  );

  doc.save(fileName);
}

export function exportProfitabilityToPDF(
  profitability: ClientProfitabilityItem[],
  period: string = '2026-10',
  fileName = `INVICT_Planilla_Rentabilidad_${period}.pdf`
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totFact = profitability.reduce((a, b) => a + b.netBilling, 0);
  const totDirect = profitability.reduce((a, b) => a + b.directCost, 0);
  const totBruto = profitability.reduce((a, b) => a + b.grossMargin, 0);
  const totNeto = profitability.reduce((a, b) => a + b.netMargin, 0);
  const pct = totFact > 0 ? Math.round((totNeto / totFact) * 100) : 0;

  const tableRows: any[] = profitability.map((p, idx) => [
    idx + 1,
    p.clientName,
    formatCurrencyARS(p.netBilling),
    formatCurrencyARS(p.directCost),
    formatCurrencyARS(p.grossMargin),
    formatCurrencyARS(p.netMargin),
    `${p.netMarginPercent}%`,
  ]);

  tableRows.push([
    '',
    'TOTALES CONSOLIDADOS',
    formatCurrencyARS(totFact),
    formatCurrencyARS(totDirect),
    formatCurrencyARS(totBruto),
    formatCurrencyARS(totNeto),
    `${pct}%`,
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Cliente', 'Facturación Neta', 'Costo Directo', 'Margen Bruto', 'Margen Neto', '% Margen']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_RED,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
      5: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
    },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Planilla Gerencial: Rentabilidad Neta por Cliente (${period})`,
    `Análisis de margen neto por contrato de seguridad · Margen Consolidado: ${formatCurrencyARS(totNeto)} (${pct}%)`
  );

  doc.save(fileName);
}

export function exportExecutiveReportToPDF(
  reportData: ExecutiveReportData,
  tasks: Task[],
  expenses: Expense[],
  fileName = 'INVICT_Informe_Ejecutivo_Avanzado.pdf'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // 1. Executive Scorecard Box
  autoTable(doc, {
    startY: 38,
    head: [['INDICADORES CLAVE DE GESTIÓN Y AUDITORÍA (C-LEVEL)', 'VALOR', 'ESTADO']],
    body: [
      ['Cumplimiento Global de Matriz', `${reportData.complianceRate}% (${reportData.completedTasks} de ${reportData.totalTasks} concluidas)`, reportData.complianceRate >= 75 ? 'ÓPTIMO' : 'ATENCIÓN REQUERIDA'],
      ['Tareas Vencidas o en Mora', `${reportData.overdueTasks} tareas con plazo excedido`, reportData.overdueTasks === 0 ? 'AL DÍA' : 'REQUIERE ACCIÓN'],
      ['Tareas con Prioridad Urgente', `${reportData.urgentTasks} asignaciones críticas`, reportData.urgentTasks <= 2 ? 'CONTROLADO' : 'ALTO RIESGO'],
      ['Ejecución Presupuestaria de Oficina', `${formatCurrencyARS(reportData.totalExpenses)} (${reportData.budgetUtilization}% del presupuesto)`, reportData.budgetUtilization <= 90 ? 'EN TÉRMINO' : 'DESVÍO PRESUPUESTARIO'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: DARK_BG,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8 },
    margin: { bottom: 8, left: 14, right: 14 },
  });

  // 2. Performance by Post table
  const currentY1 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 25, 35);
  doc.text('1. RENDIMIENTO Y EFICACIA POR PUESTO DE TRABAJO', 14, currentY1 - 2);

  const areaRows = reportData.areaBreakdown.map((a, idx) => [
    idx + 1,
    a.areaName,
    a.responsible,
    a.total,
    a.completed,
    a.pending,
    a.overdue,
    `${a.rate}%`,
  ]);

  autoTable(doc, {
    startY: currentY1,
    head: [['#', 'Puesto / Sector', 'Responsable Habitual', 'Total', 'Completadas', 'En Curso', 'Vencidas', '% Cumplimiento']],
    body: areaRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 24, halign: 'center' },
      7: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
    },
    margin: { bottom: 14, left: 14, right: 14 },
  });

  // 3. New Page: Detailed Tasks Matrix
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 25, 35);
  doc.text('2. MATRIZ DE TAREAS DE OFICINA CENTRAL', 14, 30);

  const taskRows = tasks.slice(0, 18).map((t, idx) => {
    const daysInfo = calculateDaysRemaining(t.dueDate, t.completedDate);
    return [
      idx + 1,
      t.area,
      t.title.slice(0, 50),
      t.assignee,
      t.status,
      formatDateLocale(t.dueDate),
      daysInfo.label,
    ];
  });

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Área', 'Tarea de Oficina', 'Responsable', 'Estado', 'Límite', 'Alerta']],
    body: taskRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 32 },
      4: { cellWidth: 26 },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 30, fontStyle: 'bold' },
    },
    margin: { bottom: 14, left: 14, right: 14 },
  });

  // 4. Financial
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 25, 35);
  doc.text('3. RENDICIÓN DE GASTOS DE OFICINA', 14, 30);

  const expenseRows = expenses.slice(0, 12).map((e, idx) => [
    idx + 1,
    formatDateLocale(e.date),
    e.category,
    e.provider,
    formatCurrencyARS(e.amount),
    e.paymentStatus,
    e.responsible,
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Fecha', 'Categoría', 'Proveedor', 'Monto ($ ARS)', 'Estado', 'Responsable']],
    body: expenseRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    margin: { bottom: 18, left: 14, right: 14 },
  });

  addWatermarkAndHeader(
    doc,
    `Informe Gerencial Consolidado de Gestión y Auditoría C-Level - ${reportData.periodName}`,
    'Auditoría integral mensual: Matriz operativa, control de turnos y rendición de caja'
  );

  doc.save(fileName);
}

export const exportConsolidatedPDF = exportExecutiveReportToPDF;
