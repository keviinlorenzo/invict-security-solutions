import React, { useState, useMemo } from 'react';
import {
  Expense,
  ExpenseCategory,
  UserPersona,
  computeExpenseFinancials
} from '../types';
import {
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  FileCheck,
  Download,
  FileText,
  Lock,
  ArrowRight,
  FileSpreadsheet,
  Calculator,
  RotateCcw,
  Copy,
  Check,
  Trash2,
  CopyPlus,
  Search,
  PieChart,
  Table as TableIcon,
  Receipt,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import { formatCurrencyARS, formatDateLocale } from '../utils/dateUtils';
import { exportExpensesToCSV } from '../utils/exportUtils';
import { exportExpensesToPDF } from '../utils/pdfExportUtils';
import { ManagerialFinancialSheets } from './ManagerialFinancialSheets';

interface ExpensesViewProps {
  expenses: Expense[];
  onOpenNewExpenseModal: () => void;
  onUpdatePaymentStatus: (id: string, status: 'Pagado' | 'Pendiente' | 'En Revisión') => void;
  onUpdateExpense?: (updatedExpense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onBatchUpdateExpenses?: (newExpenses: Expense[]) => void;
  onAddExpense?: (newExpData: Omit<Expense, 'id'>) => void;
  currentPersona?: UserPersona;
  onNavigateToDashboard?: () => void;
  currentPeriod?: string;
  onPeriodChange?: (period: string) => void;
  onNotify?: (msg: string) => void;
}

const GASTOS_COMUNES_CATEGORIES: ExpenseCategory[] = [
  'Compras de Insumos',
  'Viáticos Operativos',
  'Servicios de Oficina',
  'Mantenimiento / Ploteo',
  'Movilidad y Combustible',
  'Indumentaria / Uniformes',
];

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Indumentaria / Uniformes',
  'Movilidad y Combustible',
  'Multas REPRIV',
  'Mantenimiento / Ploteo',
  'Servicios de Oficina',
  'Telefonía y Conectividad',
  'Compras de Insumos',
  'Viáticos Operativos',
];

const VAT_RATES = [
  { label: '21% (General)', value: 21 },
  { label: '10.5% (Reducido)', value: 10.5 },
  { label: '27% (Servicios)', value: 27 },
  { label: '0% (Exento / Tasa)', value: 0 },
];

const WITHHOLDING_PRESETS = [
  { label: '0% Sin Retención', value: 0 },
  { label: '1% Ret. Combustible / Conv.', value: 1 },
  { label: '3% Ret. IIBB Mendoza', value: 3 },
  { label: '4% Ret. Ganancias Proveedores', value: 4 },
  { label: '6% Ret. SUSS Seguridad', value: 6 },
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onOpenNewExpenseModal,
  onUpdatePaymentStatus,
  onUpdateExpense,
  onDeleteExpense,
  onBatchUpdateExpenses,
  onAddExpense,
  currentPersona,
  onNavigateToDashboard,
  currentPeriod = '2026-10',
  onPeriodChange,
  onNotify,
}) => {
  const [gerenciaSectionTab, setGerenciaSectionTab] = useState<'gastos_oficina' | 'planillas_excel'>('gastos_oficina');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'summary'>('spreadsheet');
  const [showRestrictedNoticeModal, setShowRestrictedNoticeModal] = useState<string | null>(null);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedExpenseForItems, setSelectedExpenseForItems] = useState<Expense | null>(null);

  const isGerencia = Boolean(
    currentPersona && (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE')
  );
  const isSubGerencia = Boolean(
    currentPersona && (currentPersona.department === 'SUB_GERENCIA' || currentPersona.profileType === 'SUB_GERENTE')
  );
  const isExecutive = isGerencia || isSubGerencia;

  // If user is NOT Gerencia (demás administrativos), restrict to Gastos Comunes only and exclude Gerencia-responsible expenses
  const visibleExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!isGerencia) {
        const respLower = (e.responsible || '').toLowerCase();
        const isGerenciaResp =
          respLower.includes('gerencia') ||
          respLower.includes('dirección general') ||
          respLower.includes('direccion general') ||
          respLower.includes('yamila') ||
          respLower.includes('laura') ||
          respLower.includes('domingo');
        if (isGerenciaResp) return false;
        return GASTOS_COMUNES_CATEGORIES.includes(e.category);
      }
      return true;
    });
  }, [expenses, isGerencia]);

  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter((e) => {
      if (selectedCategory !== 'TODAS' && e.category !== selectedCategory) return false;
      if (statusFilter !== 'TODOS' && e.paymentStatus !== statusFilter) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchesProvider = e.provider.toLowerCase().includes(q);
        const matchesInvoice = e.invoiceNumber.toLowerCase().includes(q);
        const matchesResp = e.responsible.toLowerCase().includes(q);
        const matchesNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchesProvider && !matchesInvoice && !matchesResp && !matchesNotes) return false;
      }
      return true;
    });
  }, [visibleExpenses, selectedCategory, statusFilter, searchTerm]);

  // Totals calculated dynamically using formulas
  const calculatedTotals = useMemo(() => {
    let sumSubtotal = 0;
    let sumVat = 0;
    let sumWithholdings = 0;
    let sumTotal = 0;
    let paidTotal = 0;
    let pendingTotal = 0;

    visibleExpenses.forEach((exp) => {
      const subtotal = exp.subtotal !== undefined
        ? exp.subtotal
        : Math.round(exp.amount / 1.21);
      const vatRate = exp.vatRate !== undefined ? exp.vatRate : 21;
      const vatAmount = exp.vatAmount !== undefined
        ? exp.vatAmount
        : Math.round(subtotal * (vatRate / 100));
      const withholdings = exp.withholdings !== undefined ? exp.withholdings : 0;
      const total = exp.amount;

      sumSubtotal += subtotal;
      sumVat += vatAmount;
      sumWithholdings += withholdings;
      sumTotal += total;

      if (exp.paymentStatus === 'Pagado') {
        paidTotal += total;
      } else {
        pendingTotal += total;
      }
    });

    return {
      subtotal: sumSubtotal,
      vat: sumVat,
      withholdings: sumWithholdings,
      total: sumTotal,
      paid: paidTotal,
      pending: pendingTotal,
    };
  }, [visibleExpenses]);

  const availableCategories = isGerencia ? ALL_CATEGORIES : GASTOS_COMUNES_CATEGORIES;

  // Breakdown by category
  const categoriesBreakdown = useMemo(() => {
    return availableCategories.map((cat) => {
      const total = visibleExpenses
        .filter((e) => e.category === cat)
        .reduce((acc, curr) => acc + curr.amount, 0);
      const count = visibleExpenses.filter((e) => e.category === cat).length;
      const percentage = calculatedTotals.total > 0 ? Math.round((total / calculatedTotals.total) * 100) : 0;
      return { category: cat, total, percentage, count };
    }).sort((a, b) => b.total - a.total);
  }, [availableCategories, visibleExpenses, calculatedTotals.total]);

  // SPREADSHEET FORMULA HANDLERS
  // -------------------------------------------------------------
  const handleCellChange = (
    expenseId: string,
    field: keyof Expense,
    val: string | number
  ) => {
    const target = expenses.find((e) => e.id === expenseId);
    if (!target) return;

    const currentSubtotal = target.subtotal !== undefined
      ? target.subtotal
      : Math.round(target.amount / 1.21);
    const currentVatRate = target.vatRate !== undefined ? target.vatRate : 21;
    const currentWithholdingRate = target.withholdingRate !== undefined ? target.withholdingRate : 0;
    const currentWithholdings = target.withholdings !== undefined ? target.withholdings : 0;

    let newSubtotal = currentSubtotal;
    let newVatRate = currentVatRate;
    let newWithholdingRate = currentWithholdingRate;
    let newWithholdings = currentWithholdings;
    let newTotal = target.amount;

    const updatedExpense: Expense = { ...target };

    if (field === 'subtotal') {
      newSubtotal = Math.max(0, parseFloat(String(val)) || 0);
      const calc = computeExpenseFinancials(newSubtotal, newVatRate, newWithholdingRate);
      updatedExpense.subtotal = calc.subtotal;
      updatedExpense.vatAmount = calc.vatAmount;
      updatedExpense.withholdings = calc.withholdings;
      updatedExpense.amount = calc.totalAmount;
    } else if (field === 'vatRate') {
      newVatRate = parseFloat(String(val)) || 0;
      const calc = computeExpenseFinancials(newSubtotal, newVatRate, newWithholdingRate, newWithholdings);
      updatedExpense.vatRate = newVatRate;
      updatedExpense.vatAmount = calc.vatAmount;
      updatedExpense.amount = calc.totalAmount;
    } else if (field === 'withholdingRate') {
      newWithholdingRate = parseFloat(String(val)) || 0;
      const calc = computeExpenseFinancials(newSubtotal, newVatRate, newWithholdingRate);
      updatedExpense.withholdingRate = newWithholdingRate;
      updatedExpense.withholdings = calc.withholdings;
      updatedExpense.amount = calc.totalAmount;
    } else if (field === 'withholdings') {
      newWithholdings = Math.max(0, parseFloat(String(val)) || 0);
      const vatAmount = updatedExpense.vatAmount !== undefined
        ? updatedExpense.vatAmount
        : Math.round(newSubtotal * (newVatRate / 100));
      newTotal = Math.max(0, newSubtotal + vatAmount - newWithholdings);
      updatedExpense.withholdings = newWithholdings;
      updatedExpense.amount = newTotal;
    } else if (field === 'amount') {
      newTotal = Math.max(0, parseFloat(String(val)) || 0);
      updatedExpense.amount = newTotal;
      // Auto-reverse calculate Subtotal if needed
      updatedExpense.subtotal = Math.round(newTotal / (1 + (newVatRate / 100)));
      updatedExpense.vatAmount = newTotal - updatedExpense.subtotal;
    } else if (field === 'provider') {
      updatedExpense.provider = String(val);
    } else if (field === 'invoiceNumber') {
      updatedExpense.invoiceNumber = String(val);
    } else if (field === 'date') {
      updatedExpense.date = String(val);
    } else if (field === 'category') {
      updatedExpense.category = val as ExpenseCategory;
    } else if (field === 'responsible') {
      updatedExpense.responsible = String(val);
    } else if (field === 'notes') {
      updatedExpense.notes = String(val);
    } else if (field === 'paymentStatus') {
      updatedExpense.paymentStatus = val as 'Pagado' | 'Pendiente' | 'En Revisión';
    } else if (field === 'paymentMethod') {
      updatedExpense.paymentMethod = val as any;
    } else if (field === 'paymentDate') {
      updatedExpense.paymentDate = String(val);
    } else if (field === 'checkDeliveryDate') {
      updatedExpense.checkDeliveryDate = String(val);
    } else if (field === 'checkDebitDate') {
      updatedExpense.checkDebitDate = String(val);
    } else if (field === 'checkNumber') {
      updatedExpense.checkNumber = String(val);
    }

    if (onUpdateExpense) {
      onUpdateExpense(updatedExpense);
    } else if (onBatchUpdateExpenses) {
      onBatchUpdateExpenses(expenses.map((e) => (e.id === expenseId ? updatedExpense : e)));
    }
  };

  // Add new row with interactive formulas pre-populated
  const handleAddNewExpenseRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    const initialSubtotal = 100000;
    const initialVatRate = 21;
    const initialWithholdingRate = 0;
    const formulaResult = computeExpenseFinancials(initialSubtotal, initialVatRate, initialWithholdingRate);

    const newRow: Expense = {
      id: `exp-${Date.now()}`,
      date: today,
      category: 'Compras de Insumos',
      provider: 'Nuevo Proveedor S.A.',
      invoiceNumber: `FC-A 0001-${Math.floor(100000 + Math.random() * 900000)}`,
      subtotal: formulaResult.subtotal,
      vatRate: formulaResult.vatRate,
      vatAmount: formulaResult.vatAmount,
      withholdingRate: formulaResult.withholdingRate,
      withholdings: formulaResult.withholdings,
      amount: formulaResult.totalAmount,
      paymentStatus: 'Pendiente',
      paymentMethod: 'Efectivo',
      paymentDate: today,
      responsible: currentPersona?.name || 'Gerencia',
      notes: 'Factura con cálculo automático de IVA y Retenciones',
    };

    if (onAddExpense) {
      onAddExpense(newRow);
    } else if (onBatchUpdateExpenses) {
      onBatchUpdateExpenses([newRow, ...expenses]);
    }
  };

  // Duplicate an expense row
  const handleDuplicateRow = (exp: Expense) => {
    const duplicated: Expense = {
      ...exp,
      id: `exp-${Date.now()}`,
      invoiceNumber: `${exp.invoiceNumber}-COPIA`,
      paymentStatus: 'Pendiente',
    };

    if (onAddExpense) {
      onAddExpense(duplicated);
    } else if (onBatchUpdateExpenses) {
      onBatchUpdateExpenses([duplicated, ...expenses]);
    }
  };

  // Delete an expense row
  const handleDeleteRow = (id: string) => {
    if (onDeleteExpense) {
      onDeleteExpense(id);
    } else if (onBatchUpdateExpenses) {
      onBatchUpdateExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  // Reset all expense numerical values to $0
  const handleConfirmResetToZero = () => {
    const zeroed = expenses.map((e) => ({
      ...e,
      subtotal: 0,
      vatAmount: 0,
      withholdings: 0,
      amount: 0,
      paymentStatus: 'Pendiente' as const,
    }));

    if (onBatchUpdateExpenses) {
      onBatchUpdateExpenses(zeroed);
    }
    setIsResetConfirmModalOpen(false);
  };

  // Export functions
  const handleExportCSV = () => {
    const catSuffix = selectedCategory !== 'TODAS' ? `_${selectedCategory.replace(/\s+/g, '_')}` : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `INVICT_Gastos_Costos${catSuffix}_${dateStr}.csv`;
    exportExpensesToCSV(filteredExpenses, fileName);
  };

  const handleExportPDF = () => {
    const catSuffix = selectedCategory !== 'TODAS' ? `_${selectedCategory.replace(/\s+/g, '_')}` : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `INVICT_Gastos_Costos${catSuffix}_${dateStr}.pdf`;
    exportExpensesToPDF(filteredExpenses, fileName);
  };

  // Plain-text Table Generator for Excel copying
  const plainTextTableContent = useMemo(() => {
    const header = 'Fecha | Proveedor | Categoría | N° Factura | Subtotal $ | Tasa IVA | IVA $ | Retenciones $ | Total Neto $ | Estado | Responsable | Observaciones';
    const lines = filteredExpenses.map((e) => {
      const subtotal = e.subtotal !== undefined ? e.subtotal : Math.round(e.amount / 1.21);
      const vatRate = e.vatRate !== undefined ? e.vatRate : 21;
      const vatAmount = e.vatAmount !== undefined ? e.vatAmount : (e.amount - subtotal);
      const withholdings = e.withholdings !== undefined ? e.withholdings : 0;
      return `${e.date} | ${e.provider} | ${e.category} | ${e.invoiceNumber} | $${subtotal.toLocaleString('es-AR')} | ${vatRate}% | $${vatAmount.toLocaleString('es-AR')} | $${withholdings.toLocaleString('es-AR')} | $${e.amount.toLocaleString('es-AR')} | ${e.paymentStatus} | ${e.responsible} | ${e.notes || ''}`;
    });
    return [header, ...lines].join('\n');
  }, [filteredExpenses]);

  const handleCopyPlainText = () => {
    navigator.clipboard.writeText(plainTextTableContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Security & RBAC Status Banner */}
      {!isExecutive ? (
        <div className="p-4 rounded-2xl bg-[#141824] border border-[#2b354c] shadow-md space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                [Rol: Demás Administrativos]
              </span>
              <span className="text-xs text-white font-bold">
                Gestión Habilitada: "Gastos Comunes" Únicamente
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Insumos · Viáticos · Librería · Reparaciones Menores
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Puedes consultar, registrar y editar comprobantes de caja chica y gastos cotidianos de oficina.
            La información societaria y financiera sensible está resguardada bajo control exclusivo de Gerencia.
          </p>

          <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
            <span className="text-slate-400 font-semibold">Conceptos de uso exclusivo gerencial:</span>
            {[
              'Sueldos Personales',
              'Retiros Directorio',
              'Descuento Bancos',
              'Clientes (Facturación)',
              'Rentabilidad por Cliente',
              'Resumen General',
            ].map((concept) => (
              <button
                key={concept}
                onClick={() => setShowRestrictedNoticeModal(concept)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#11141c] hover:bg-[#1a2130] text-slate-400 hover:text-amber-300 border border-[#232b3d] transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-amber-500/80" />
                <span>{concept}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#181a26] to-red-950/40 border border-[#BE2629]/50 shadow flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isSubGerencia
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
                  : 'bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/40'
              }`}>
                {isSubGerencia ? '[Rol: Sub Gerencia / Vicepresidencia]' : '[Rol: Gerencia General]'}
              </span>
              <div className="flex flex-col">
                <span className="text-xs text-white font-bold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Módulo Gerencial: Gastos de Oficina & Planillas Interactivas (Excel)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isSubGerencia
                    ? 'Acceso C-Level en Modo Solo Lectura (Sub Gerencia) · Fórmulas de IVA, extractos y rentabilidad'
                    : 'Acceso exclusivo C-Level · Fórmulas de IVA, retenciones, extractos bancarios y sueldos netos'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToDashboard && (
                <button
                  onClick={onNavigateToDashboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#BE2629] hover:bg-[#a52023] text-white text-xs font-bold transition-all shadow cursor-pointer active:scale-95"
                >
                  <span>Ver Métricas en Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Gerencia Section Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-[#0f121a] rounded-2xl border border-[#232b3d] w-fit">
            <button
              onClick={() => setGerenciaSectionTab('gastos_oficina')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                gerenciaSectionTab === 'gastos_oficina'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>1. Rendición de Gastos de Oficina & Comprobantes</span>
            </button>

            <button
              onClick={() => setGerenciaSectionTab('planillas_excel')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                gerenciaSectionTab === 'planillas_excel'
                  ? 'bg-[#BE2629] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Planillas Gerenciales (Excel) - Clientes, Sueldos, Bancos</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                isSubGerencia
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {isSubGerencia ? 'Sub Gerencia (Solo Vista)' : 'Exclusivo Gerencia'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* RENDER PLANILLAS GERENCIALES (EXCEL) WHEN GERENCIA OR SUB GERENCIA SELECTS THAT TAB */}
      {isExecutive && gerenciaSectionTab === 'planillas_excel' ? (
        <ManagerialFinancialSheets
          currentPeriod={currentPeriod}
          onPeriodChange={onPeriodChange}
          onNotify={onNotify}
          isReadOnly={isSubGerencia}
        />
      ) : (
        <>
      {/* 2. Top Header & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/50 rounded">
              {isGerencia ? 'Módulo Gerencial: Gastos y Costos' : 'Caja Chica & Gastos Comunes'}
            </span>
            <span className="text-xs text-slate-400">Sede Mendoza Central</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{isGerencia ? 'Gestión y Auditoría de Gastos y Costos' : 'Registro de Gastos Comunes'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isGerencia
              ? 'Edita directamente en las celdas: Subtotal, Tasa IVA, Retenciones y Total calculados automáticamente en tiempo real.'
              : 'Rendición de comprobantes comunes: Insumos de oficina, viáticos de supervisores y compras de caja chica.'}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {isGerencia && (
            <>
              <button
                onClick={handleAddNewExpenseRow}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow transition-all active:scale-95 cursor-pointer"
                title="Inserta una nueva fila editable en la planilla con fórmulas predeterminadas"
              >
                <Plus className="w-4 h-4" />
                <span>+ Cargar Gasto / Costo</span>
              </button>

              <button
                onClick={() => setIsResetConfirmModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 rounded-xl transition-all cursor-pointer"
                title="Pone en $0 los valores de la planilla actual para comenzar una carga limpia"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar a Cero (0)</span>
              </button>

              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-[#1a2130] hover:bg-[#232b3d] border border-[#2a3449] rounded-xl transition-colors cursor-pointer"
                title="Copiar la planilla completa en formato de texto plano para Excel"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar Planilla (Excel)</span>
              </button>
            </>
          )}

          {!isGerencia && (
            <button
              onClick={onOpenNewExpenseModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#BE2629] hover:bg-[#a62b2e] rounded-xl shadow transition-colors active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Gasto Común</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#232b3d] border border-[#29344a] rounded-xl transition-colors active:scale-95 cursor-pointer"
            title="Exportar a CSV compatible con Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#232b3d] border border-[#29344a] rounded-xl transition-colors active:scale-95 cursor-pointer"
            title="Exportar a documento oficial en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 4. Scorecards de Gastos (KPIs Simplificados y Directos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gastos Card */}
        <div className="p-4 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Total Gastos del Mes
            </span>
            <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">
              Consolidado
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {formatCurrencyARS(calculatedTotals.total)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Egresos registrados en el período
          </span>
        </div>

        {/* Gastos Pagados Card */}
        <div className="p-4 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Gastos Pagados
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              Abonados
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {formatCurrencyARS(calculatedTotals.paid)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Pagos ya cancelados o transferidos
          </span>
        </div>

        {/* Gastos Pendientes Card */}
        <div className="p-4 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Gastos Pendientes
            </span>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
              Por Abonar
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {formatCurrencyARS(calculatedTotals.pending)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Comprobantes a pagar / vencimiento
          </span>
        </div>

        {/* Total Comprobantes Registrados Card */}
        <div className="p-4 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Comprobantes Registrados
            </span>
            <span className="text-[10px] font-mono text-blue-300 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
              Tickets & Facturas
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {filteredExpenses.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Archivos analizados y sincronizados
          </span>
        </div>
      </div>

      {/* 5. Search, Filter Bar and View Mode Toggle */}
      <div className="bg-[#121620] border border-[#22293b] rounded-2xl shadow overflow-hidden">
        <div className="p-4 bg-[#161b26] border-b border-[#252c3e] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar proveedor, factura o notas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#121620] border border-[#2b354c] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#BE2629] w-64"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Categoría:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#121620] border border-[#2b354c] rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="TODAS">
                  {isGerencia ? 'Todas las Categorías' : 'Todos los Gastos Comunes'}
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment status filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#121620] border border-[#2b354c] rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Revisión">En Revisión</option>
              </select>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {filteredExpenses.length} de {visibleExpenses.length} registros
            </span>
            <div className="flex items-center bg-[#121620] border border-[#2b354c] p-0.5 rounded-xl">
              <button
                onClick={() => setViewMode('spreadsheet')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  viewMode === 'spreadsheet'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Cuadrícula Excel con Fórmulas Editables"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Planilla Excel</span>
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Gráfica y Distribución por Categoría"
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Distribución</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6. A: INTERACTIVE SPREADSHEET TABLE WITH EDITABLE CELLS */}
        {viewMode === 'spreadsheet' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 min-w-[125px]">Fecha</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Proveedor / Beneficiario</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Categoría</th>
                  <th className="py-2.5 px-3 min-w-[150px]">N° Factura / Boleta</th>
                  <th className="py-2.5 px-3 text-right min-w-[130px]">
                    <span className="block text-white font-bold">Monto Base $</span>
                    <span className="text-[9px] text-slate-400 font-normal font-mono">Comprobante</span>
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">
                    <span className="block">IVA %</span>
                    <span className="text-[9px] text-slate-500 font-normal font-mono">Alícuota</span>
                  </th>
                  <th className="py-2.5 px-3 text-right min-w-[120px]">
                    <span className="block">IVA $</span>
                    <span className="text-[9px] text-emerald-400 font-normal font-mono">fx: Sub × IVA%</span>
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[130px]">
                    <span className="block">Retención %</span>
                    <span className="text-[9px] text-amber-400 font-normal font-mono">Gan / IIBB</span>
                  </th>
                  <th className="py-2.5 px-3 text-right min-w-[120px]">
                    <span className="block">Retención $</span>
                    <span className="text-[9px] text-amber-400 font-normal font-mono">fx: Sub × Ret%</span>
                  </th>
                  <th className="py-2.5 px-3 text-right min-w-[140px]">
                    <span className="block">Total Neto $</span>
                    <span className="text-[9px] text-white font-bold font-mono">fx: Sub+IVA-Ret</span>
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[110px]">Estado</th>
                  <th className="py-2.5 px-3 min-w-[210px]">
                    <span className="block">Método de Pago & Fechas</span>
                    <span className="text-[9px] text-slate-400 font-normal font-mono">Cheque / Débito / Efec</span>
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px]">Responsable</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Observaciones</th>
                  {isGerencia && <th className="py-2.5 px-2 text-center w-16">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredExpenses.map((exp) => {
                  const subtotal = exp.subtotal !== undefined
                    ? exp.subtotal
                    : Math.round(exp.amount / 1.21);
                  const vatRate = exp.vatRate !== undefined ? exp.vatRate : 21;
                  const vatAmount = exp.vatAmount !== undefined
                    ? exp.vatAmount
                    : Math.round(subtotal * (vatRate / 100));
                  const withholdingRate = exp.withholdingRate !== undefined ? exp.withholdingRate : 0;
                  const withholdings = exp.withholdings !== undefined ? exp.withholdings : 0;

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-[#161c28]/80 transition-colors group"
                    >
                      {/* Fecha */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isGerencia ? (
                          <input
                            type="date"
                            value={exp.date}
                            onChange={(e) => handleCellChange(exp.id, 'date', e.target.value)}
                            className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none w-full"
                          />
                        ) : (
                          <span className="font-mono text-slate-300">{formatDateLocale(exp.date)}</span>
                        )}
                      </td>

                      {/* Proveedor */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {isGerencia ? (
                            <input
                              type="text"
                              value={exp.provider}
                              onChange={(e) => handleCellChange(exp.id, 'provider', e.target.value)}
                              placeholder="Nombre del proveedor"
                              className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-white font-semibold focus:outline-none w-full"
                            />
                          ) : (
                            <span className="font-semibold text-slate-100">{exp.provider}</span>
                          )}
                          {exp.items && exp.items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedExpenseForItems(exp)}
                              className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800/60 text-blue-300 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                              title="Ver desglose detallado de productos e ítems comprados en este comprobante"
                            >
                              <span>📦 {exp.items.length} ítems</span>
                              <span className="text-blue-400">→</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-2 px-3">
                        {isGerencia ? (
                          <select
                            value={exp.category}
                            onChange={(e) => handleCellChange(exp.id, 'category', e.target.value)}
                            className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none w-full cursor-pointer"
                          >
                            {availableCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-300">{exp.category}</span>
                        )}
                      </td>

                      {/* N° Factura */}
                      <td className="py-2 px-3">
                        {isGerencia ? (
                          <input
                            type="text"
                            value={exp.invoiceNumber}
                            onChange={(e) => handleCellChange(exp.id, 'invoiceNumber', e.target.value)}
                            placeholder="FC-A 0001-..."
                            className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none w-full"
                          />
                        ) : (
                          <span className="font-mono text-slate-300 text-[11px]">{exp.invoiceNumber}</span>
                        )}
                      </td>

                      {/* Subtotal $ (Neto Gravado) - EDITABLE */}
                      <td className="py-2 px-3 text-right font-mono">
                        {isGerencia ? (
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={subtotal}
                              onChange={(e) => handleCellChange(exp.id, 'subtotal', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-blue-500 rounded-lg pl-5 pr-2 py-1 text-xs text-blue-300 text-right font-bold focus:outline-none transition-colors"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-200">{formatCurrencyARS(subtotal)}</span>
                        )}
                      </td>

                      {/* Tasa IVA % */}
                      <td className="py-2 px-3 text-center">
                        {isGerencia ? (
                          <select
                            value={vatRate}
                            onChange={(e) => handleCellChange(exp.id, 'vatRate', e.target.value)}
                            className="bg-[#121620] border border-transparent focus:border-emerald-500 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono text-center focus:outline-none cursor-pointer w-full"
                          >
                            {VAT_RATES.map((vr) => (
                              <option key={vr.value} value={vr.value}>
                                {vr.value}%
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono text-slate-400">{vatRate}%</span>
                        )}
                      </td>

                      {/* Monto IVA $ (FÓRMULA AUTOMÁTICA) */}
                      <td className="py-2 px-3 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-400 font-bold">
                            {formatCurrencyARS(vatAmount)}
                          </span>
                          <span className="text-[9px] text-emerald-500/70 font-mono">
                            fx: {vatRate}%
                          </span>
                        </div>
                      </td>

                      {/* Tasa Retención % */}
                      <td className="py-2 px-3 text-center">
                        {isGerencia ? (
                          <select
                            value={withholdingRate}
                            onChange={(e) => handleCellChange(exp.id, 'withholdingRate', e.target.value)}
                            className="bg-[#121620] border border-transparent focus:border-amber-500 rounded-lg px-1.5 py-1 text-xs text-amber-300 font-mono text-center focus:outline-none cursor-pointer w-full"
                          >
                            {WITHHOLDING_PRESETS.map((wp) => (
                              <option key={wp.value} value={wp.value}>
                                {wp.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono text-slate-400">{withholdingRate}%</span>
                        )}
                      </td>

                      {/* Monto Retención $ (FÓRMULA AUTOMÁTICA O EDITABLE DIRECTO) */}
                      <td className="py-2 px-3 text-right font-mono">
                        {isGerencia ? (
                          <div className="relative">
                            <span className="absolute left-1.5 top-1 text-slate-500 text-[11px]">$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={withholdings}
                              onChange={(e) => handleCellChange(exp.id, 'withholdings', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-amber-500 rounded-lg pl-4 pr-1.5 py-1 text-xs text-amber-400 text-right font-semibold focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="text-amber-400 font-mono">{formatCurrencyARS(withholdings)}</span>
                        )}
                      </td>

                      {/* Total Neto a Pagar $ (FÓRMULA AUTOMÁTICA CONSOLIDADA) */}
                      <td className="py-2 px-3 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className="text-white font-extrabold text-sm tracking-tight">
                            {formatCurrencyARS(exp.amount)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            fx: Sub+IVA-Ret
                          </span>
                        </div>
                      </td>

                      {/* Estado de Pago */}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => {
                            const next =
                              exp.paymentStatus === 'Pagado'
                                ? 'Pendiente'
                                : exp.paymentStatus === 'Pendiente'
                                ? 'En Revisión'
                                : 'Pagado';
                            onUpdatePaymentStatus(exp.id, next);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                            exp.paymentStatus === 'Pagado'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : exp.paymentStatus === 'Pendiente'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}
                        >
                          {exp.paymentStatus}
                        </button>
                      </td>

                      {/* Método de Pago & Fechas (Cheque/E-Check vs Efectivo/Transferencia) */}
                      <td className="py-2 px-3">
                        {isGerencia ? (
                          <div className="space-y-1.5 min-w-[190px]">
                            <select
                              value={exp.paymentMethod || 'Efectivo'}
                              onChange={(e) => handleCellChange(exp.id, 'paymentMethod', e.target.value)}
                              className="bg-[#121620] border border-[#273248] focus:border-blue-500 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-full font-medium"
                            >
                              <option value="Efectivo">💵 Efectivo</option>
                              <option value="Transferencia Bancaria">🏦 Transferencia Bancaria</option>
                              <option value="Cheque Físico">📄 Cheque Físico</option>
                              <option value="E-Check">⚡ E-Check</option>
                              <option value="Tarjeta de Débito">💳 Tarjeta de Débito</option>
                              <option value="Tarjeta de Crédito">💳 Tarjeta de Crédito</option>
                              <option value="Otro">Otro</option>
                            </select>

                            {/* If Cheque or E-Check: Show two date inputs */}
                            {(exp.paymentMethod === 'Cheque Físico' || exp.paymentMethod === 'E-Check') ? (
                              <div className="space-y-1 font-mono text-[10px]">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-amber-300 shrink-0">Entregado:</span>
                                  <input
                                    type="date"
                                    value={exp.checkDeliveryDate || exp.date}
                                    onChange={(e) => handleCellChange(exp.id, 'checkDeliveryDate', e.target.value)}
                                    className="bg-[#161c28] border border-[#2b364e] rounded px-1 py-0.5 text-slate-200 text-[10px] w-28"
                                    title="Fecha en la que se entregó el cheque"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-cyan-300 shrink-0 font-bold">Débito:</span>
                                  <input
                                    type="date"
                                    value={exp.checkDebitDate || exp.date}
                                    onChange={(e) => handleCellChange(exp.id, 'checkDebitDate', e.target.value)}
                                    className="bg-[#161c28] border border-cyan-800/60 rounded px-1 py-0.5 text-cyan-300 font-bold text-[10px] w-28"
                                    title="Fecha en la que se debitaría el pago de la cuenta de la empresa"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                                <span className="text-emerald-400 shrink-0">Pagado:</span>
                                <input
                                  type="date"
                                  value={exp.paymentDate || exp.date}
                                  onChange={(e) => handleCellChange(exp.id, 'paymentDate', e.target.value)}
                                  className="bg-[#161c28] border border-[#2b364e] rounded px-1 py-0.5 text-slate-200 text-[10px] w-28"
                                  title="Fecha en la que se pagó"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="min-w-[170px]">
                            {(exp.paymentMethod === 'Cheque Físico' || exp.paymentMethod === 'E-Check') ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 border border-amber-800/50 text-amber-300">
                                  {exp.paymentMethod === 'E-Check' ? '⚡ E-Check' : '📄 Cheque Físico'}
                                </span>
                                <div className="text-[10px] font-mono space-y-0.5">
                                  <div className="text-slate-400">
                                    Entregado: <strong className="text-slate-300">{formatDateLocale(exp.checkDeliveryDate || exp.date)}</strong>
                                  </div>
                                  <div className="text-cyan-400 font-semibold">
                                    Débito cuenta: <strong>{formatDateLocale(exp.checkDebitDate || exp.date)}</strong>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a2130] text-slate-300 border border-[#2a3449]">
                                  {exp.paymentMethod || 'Efectivo'}
                                </span>
                                <div className="text-[10px] font-mono text-emerald-400">
                                  Pagado: <strong>{formatDateLocale(exp.paymentDate || exp.date)}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Responsable */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isGerencia ? (
                          <input
                            type="text"
                            value={exp.responsible}
                            onChange={(e) => handleCellChange(exp.id, 'responsible', e.target.value)}
                            className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-full"
                          />
                        ) : (
                          <span className="text-slate-300">{exp.responsible}</span>
                        )}
                      </td>

                      {/* Observaciones */}
                      <td className="py-2 px-3">
                        {isGerencia ? (
                          <input
                            type="text"
                            value={exp.notes || ''}
                            onChange={(e) => handleCellChange(exp.id, 'notes', e.target.value)}
                            placeholder="Comentario o detalle..."
                            className="bg-[#121620] border border-transparent focus:border-[#BE2629] rounded-lg px-2 py-1 text-xs text-slate-400 focus:outline-none w-full"
                          />
                        ) : (
                          <span className="text-slate-400 text-[11px] truncate block max-w-[200px]" title={exp.notes}>
                            {exp.notes || 'Comprobante adjunto'}
                          </span>
                        )}
                      </td>

                      {/* Row Actions for Gerencia */}
                      {isGerencia && (
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDuplicateRow(exp)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Duplicar comprobante"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(exp.id)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td
                      colSpan={isGerencia ? 14 : 13}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      No se encontraron registros de gastos para los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* SPREADSHEET FOOTER CONSOLIDATING FORMULA TOTALS */}
              <tfoot>
                <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                  <td colSpan={4} className="py-3 px-3 text-white uppercase font-sans">
                    TOTALES DE LA PLANILLA ({filteredExpenses.length} COMPROBANTES)
                  </td>
                  <td className="py-3 px-3 text-right text-blue-300">
                    {formatCurrencyARS(calculatedTotals.subtotal)}
                  </td>
                  <td></td>
                  <td className="py-3 px-3 text-right text-emerald-400">
                    {formatCurrencyARS(calculatedTotals.vat)}
                  </td>
                  <td></td>
                  <td className="py-3 px-3 text-right text-amber-400">
                    {formatCurrencyARS(calculatedTotals.withholdings)}
                  </td>
                  <td className="py-3 px-3 text-right text-white text-sm font-extrabold">
                    {formatCurrencyARS(calculatedTotals.total)}
                  </td>
                  <td colSpan={isGerencia ? 4 : 3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 6. B: SUMMARY & CATEGORY BREAKDOWN VIEW */}
        {viewMode === 'summary' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#22293b] pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Distribución de Gastos por Categoría
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Participación porcentual en el presupuesto general de la sede Mendoza
                </p>
              </div>
              <span className="text-xs font-mono text-slate-300 font-bold">
                Total General: {formatCurrencyARS(calculatedTotals.total)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriesBreakdown.map((item) => (
                <div
                  key={item.category}
                  className="space-y-1.5 p-3 rounded-xl bg-[#161b26] border border-[#232a3b]"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.category}</span>
                    <span className="font-mono text-slate-300 font-bold">
                      {formatCurrencyARS(item.total)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#0e121a] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#BE2629] h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{item.count} comprobantes</span>
                    <span>{item.percentage}% del total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. Modal: Restricción Exclusiva Gerencial (Para Demás Administrativos) */}
      {showRestrictedNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#121622] border border-amber-600/60 rounded-3xl p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              Información de Uso Exclusivo Gerencial
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Los registros vinculados a <strong>"{showRestrictedNoticeModal}"</strong> (sueldos de colaboradores, retiros de directorio, acuerdos de clientes, costos y balances societarios) son de carácter reservado y acceso exclusivo para la <strong>Gerencia General</strong> (Yamila, Laura y Domingo).
            </p>
            <p className="text-[11px] text-slate-400">
              Tu perfil cuenta con autorización completa para consultar, registrar y editar todos los <strong>Gastos Comunes</strong> de oficina central y caja chica.
            </p>
            <button
              onClick={() => setShowRestrictedNoticeModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#232d42] hover:bg-[#2c3852] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* 8. Modal: Confirmación Reiniciar Valores a Cero */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#121622] border border-amber-500/60 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Reiniciar Planilla de Gastos a Cero ($0)
                </h3>
                <span className="text-xs text-amber-300 font-mono">
                  Módulo Gerencial INVICT
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Confirmas que deseas reiniciar a <strong>$0</strong> los subtotales, IVA, retenciones y montos de todos los comprobantes? Esta acción conserva los proveedores y categorías para que puedas iniciar la carga financiera del nuevo mes desde cero.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#252f44] border border-[#2b374e] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResetToZero}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors shadow cursor-pointer"
              >
                Confirmar y Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Copiar Planilla en Texto Plano (Listo para Excel) */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-3xl bg-[#121622] border border-[#2d374f] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Planilla de Gastos y Costos (Texto Plano para Excel)
                </h3>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-[#1a2130] border border-[#28334a]"
              >
                Cerrar
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Copia y pega este contenido directamente en Microsoft Excel, Google Sheets o envíalo por correo. Las columnas y separadores están alineados con las normas societarias de INVICT.
            </p>

            <div className="flex-1 overflow-auto bg-[#090b10] p-4 rounded-xl border border-[#1e2536] font-mono text-xs text-slate-300 whitespace-pre">
              {plainTextTableContent}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400 font-mono">
                {filteredExpenses.length} registros listos para copiar
              </span>
              <button
                onClick={handleCopyPlainText}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow cursor-pointer"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>¡Copiado al Portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar al Portapapeles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal: Desglose Detallado de Ítems del Comprobante */}
      {selectedExpenseForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-2xl bg-[#121622] border border-[#2d374f] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Ítems y Productos del Comprobante</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#1e2536] text-slate-300 font-mono">
                      {selectedExpenseForItems.invoiceNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comercio emisor: <strong className="text-white">{selectedExpenseForItems.provider}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedExpenseForItems(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-[#1a2130] border border-[#28334a] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-[#090b10] rounded-2xl border border-[#1e2536] p-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#222a3d] text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Descripción del Producto / Insumo</th>
                    <th className="py-2 px-3 text-center">Cant.</th>
                    <th className="py-2 px-3 text-right">Precio Unit. ($)</th>
                    <th className="py-2 px-3 text-right">Subtotal ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2234]">
                  {selectedExpenseForItems.items?.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#131824]/60">
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{it.description}</td>
                      <td className="py-2.5 px-3 text-center text-slate-300 font-mono">{it.quantity || 1}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {it.unitPrice ? formatCurrencyARS(it.unitPrice) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-mono font-bold">
                        {it.subtotal ? formatCurrencyARS(it.subtotal) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#161c28] border border-[#263146]">
              <div className="text-xs text-slate-400 space-y-0.5">
                <div>
                  <span>Método de pago: </span>
                  <strong className="text-slate-200">{selectedExpenseForItems.paymentMethod || 'Efectivo'}</strong>
                </div>
                {selectedExpenseForItems.checkDeliveryDate && (
                  <div className="text-amber-300 text-[11px] font-mono">
                    Entregado: {formatDateLocale(selectedExpenseForItems.checkDeliveryDate)}
                  </div>
                )}
                {selectedExpenseForItems.checkDebitDate && (
                  <div className="text-cyan-400 text-[11px] font-mono">
                    Débito en cuenta: {formatDateLocale(selectedExpenseForItems.checkDebitDate)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 mr-2">Total Comprobante:</span>
                <span className="text-lg font-black font-mono text-white">
                  {formatCurrencyARS(selectedExpenseForItems.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
