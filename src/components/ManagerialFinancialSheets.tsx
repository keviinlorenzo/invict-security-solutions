import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PieChart,
  FileSpreadsheet,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
  ArrowRight,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Calculator,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Landmark,
  Upload,
  Download,
  Search,
  Filter,
  FileText
} from 'lucide-react';
import {
  calculateManagerialMetrics,
  generatePlainTextTable,
  updateSalaryAdvance,
  startNewMonth,
  resetMonthDataToZero,
  computeClientBillingFormulas,
  computeFixedExpenseFormulas,
  parseFlexibleHours,
  saveManagerialMonthData,
  getManagerialMonthData,
  sortSalariesAlphabetically,
  ManagerialMonthData,
  EmployeeSalaryItem,
  FixedExpenseItem,
  BankExpenseItem,
  ClientBillingItem,
  parseExcelOrCsvFile,
  importSalariesFromRows,
  importClientsFromRows,
  importFixedExpensesFromRows,
  importBankExpensesFromRows
} from '../data/managerialSheetsData';
import {
  exportClientsToCSV,
  exportSalariesToCSV,
  exportFixedExpensesToCSV,
  exportBankExpensesToCSV,
  exportProfitabilityToCSV
} from '../utils/exportUtils';
import {
  exportClientsToPDF,
  exportSalariesToPDF,
  exportFixedExpensesToPDF,
  exportBankExpensesToPDF,
  exportProfitabilityToPDF
} from '../utils/pdfExportUtils';
import { formatCurrencyARS } from '../utils/dateUtils';
import { subscribeToCloudSync } from '../utils/cloudSyncService';

export interface BankColorTheme {
  name: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  inputColor: string;
  chipActive: string;
  chipInactive: string;
  dotColor: string;
}

export function getBankColorTheme(bankName: string = ''): BankColorTheme {
  const norm = bankName.toLowerCase();
  if (norm.includes('galicia')) {
    // Galicia - Naranja
    return {
      name: 'Banco Galicia',
      badgeBg: 'bg-orange-950/80',
      badgeText: 'text-orange-400',
      badgeBorder: 'border-orange-500/70',
      inputColor: 'text-orange-400 focus:border-orange-500',
      chipActive: 'bg-orange-950/90 text-orange-200 border-orange-500 shadow-sm shadow-orange-950/50',
      chipInactive: 'bg-[#19130d] text-orange-400/90 border-orange-900/40 hover:border-orange-500/60',
      dotColor: 'bg-orange-500',
    };
  }
  if (norm.includes('macro')) {
    // Macro - Azul
    return {
      name: 'Banco Macro',
      badgeBg: 'bg-blue-950/80',
      badgeText: 'text-blue-400',
      badgeBorder: 'border-blue-500/70',
      inputColor: 'text-blue-400 focus:border-blue-500',
      chipActive: 'bg-blue-950/90 text-blue-200 border-blue-500 shadow-sm shadow-blue-950/50',
      chipInactive: 'bg-[#10141e] text-blue-400/90 border-blue-900/40 hover:border-blue-500/60',
      dotColor: 'bg-blue-500',
    };
  }
  if (norm.includes('nacion') || norm.includes('nación')) {
    // Nación - Celeste
    return {
      name: 'Banco Nación',
      badgeBg: 'bg-sky-950/80',
      badgeText: 'text-sky-300',
      badgeBorder: 'border-sky-500/70',
      inputColor: 'text-sky-300 focus:border-sky-500',
      chipActive: 'bg-sky-950/90 text-sky-200 border-sky-400 shadow-sm shadow-sky-950/50',
      chipInactive: 'bg-[#0d1620] text-sky-300/90 border-sky-900/40 hover:border-sky-500/60',
      dotColor: 'bg-sky-400',
    };
  }
  if (norm.includes('santander')) {
    // Santander - Rojo
    return {
      name: 'Banco Santander',
      badgeBg: 'bg-red-950/80',
      badgeText: 'text-red-400',
      badgeBorder: 'border-red-500/70',
      inputColor: 'text-red-400 focus:border-red-500',
      chipActive: 'bg-red-950/90 text-red-200 border-red-500 shadow-sm shadow-red-950/50',
      chipInactive: 'bg-[#1a0f12] text-red-400/90 border-red-900/40 hover:border-red-500/60',
      dotColor: 'bg-red-500',
    };
  }
  if (norm.includes('bbva')) {
    // BBVA - Violeta
    return {
      name: 'Banco BBVA',
      badgeBg: 'bg-purple-950/80',
      badgeText: 'text-purple-300',
      badgeBorder: 'border-purple-500/70',
      inputColor: 'text-purple-300 focus:border-purple-500',
      chipActive: 'bg-purple-950/90 text-purple-200 border-purple-400 shadow-sm shadow-purple-950/50',
      chipInactive: 'bg-[#160f1e] text-purple-300/90 border-purple-900/40 hover:border-purple-500/60',
      dotColor: 'bg-purple-400',
    };
  }
  if (norm.includes('credicoop')) {
    // Credicoop - Verde
    return {
      name: 'Banco Credicoop',
      badgeBg: 'bg-emerald-950/80',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/70',
      inputColor: 'text-emerald-300 focus:border-emerald-500',
      chipActive: 'bg-emerald-950/90 text-emerald-200 border-emerald-400 shadow-sm shadow-emerald-950/50',
      chipInactive: 'bg-[#0d1713] text-emerald-300/90 border-emerald-900/40 hover:border-emerald-500/60',
      dotColor: 'bg-emerald-400',
    };
  }
  // Default / Otros bancos
  return {
    name: bankName || 'Entidad Bancaria',
    badgeBg: 'bg-cyan-950/80',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-700/60',
    inputColor: 'text-cyan-300 focus:border-cyan-500',
    chipActive: 'bg-cyan-950/90 text-cyan-200 border-cyan-400',
    chipInactive: 'bg-[#10171d] text-cyan-300/80 border-cyan-900/40 hover:border-cyan-500/60',
    dotColor: 'bg-cyan-400',
  };
}

interface ManagerialFinancialSheetsProps {
  currentPeriod: string;
  onPeriodChange?: (period: string) => void;
  onNotify?: (msg: string) => void;
  isReadOnly?: boolean;
}

export const ManagerialFinancialSheets: React.FC<ManagerialFinancialSheetsProps> = ({
  currentPeriod,
  onPeriodChange,
  onNotify,
  isReadOnly = false,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<
    'clientes' | 'sueldos' | 'gastos_fijos' | 'gastos_bancarios' | 'rentabilidad' | 'alertas' | 'resumen'
  >('clientes');

  // Interactive live state of sheets
  const [sheetsData, setSheetsData] = useState<ManagerialMonthData>(() =>
    getManagerialMonthData(currentPeriod)
  );

  useEffect(() => {
    setSheetsData(getManagerialMonthData(currentPeriod));
  }, [currentPeriod]);

  useEffect(() => {
    const handleSheetsUpdate = (e: any) => {
      if (e?.detail?.period && e.detail.period !== currentPeriod) return;
      setSheetsData(getManagerialMonthData(currentPeriod));
    };
    window.addEventListener('invict_managerial_sheets_mutation', handleSheetsUpdate);
    window.addEventListener('storage', handleSheetsUpdate);
    const unsub = subscribeToCloudSync((payload) => {
      if (payload.type === 'SHEET_MUTATION' || payload.type === 'FULL_STATE_SYNC' || payload.stateSnapshot) {
        setSheetsData(getManagerialMonthData(currentPeriod));
      }
    });
    return () => {
      window.removeEventListener('invict_managerial_sheets_mutation', handleSheetsUpdate);
      window.removeEventListener('storage', handleSheetsUpdate);
      unsub();
    };
  }, [currentPeriod]);

  // Filters state
  const [clientStatusFilter, setClientStatusFilter] = useState<'TODOS' | 'PAGO' | 'IMPAGO'>('TODOS');
  const [clientSearch, setClientSearch] = useState('');

  const [salaryStatusFilter, setSalaryStatusFilter] = useState<'TODOS' | 'PAGO' | 'PENDIENTE'>('TODOS');
  const [salarySearch, setSalarySearch] = useState('');

  const [fixedStatusFilter, setFixedStatusFilter] = useState<'TODOS' | 'PAGO' | 'IMPAGO'>('TODOS');
  const [fixedSearch, setFixedSearch] = useState('');

  const [bankNameFilter, setBankNameFilter] = useState<string>('TODOS');
  const [bankStatusFilter, setBankStatusFilter] = useState<'TODOS' | 'PAGO' | 'IMPAGO'>('TODOS');
  const [bankSearch, setBankSearch] = useState('');

  const [profitabilitySearch, setProfitabilitySearch] = useState('');

  // Modals & UI States
  const [copied, setCopied] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [plainTextPreview, setPlainTextPreview] = useState('');
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [nextPeriodInput, setNextPeriodInput] = useState('2026-11');
  const [isFileLoading, setIsFileLoading] = useState(false);

  // Hidden file inputs
  const clientFileInputRef = useRef<HTMLInputElement>(null);
  const salaryFileInputRef = useRef<HTMLInputElement>(null);
  const fixedFileInputRef = useRef<HTMLInputElement>(null);
  const bankFileInputRef = useRef<HTMLInputElement>(null);

  // Quick Advance Modal
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState('');
  const [advanceAmountInput, setAdvanceAmountInput] = useState('50000');

  // New Collaborator Modal State (Auto-sort A-Z & Client Assignment)
  const [isAddCollaboratorModalOpen, setIsAddCollaboratorModalOpen] = useState(false);
  const [newCollabName, setNewCollabName] = useState('');
  const [newCollabClientId, setNewCollabClientId] = useState('general');
  const [newCollabRole, setNewCollabRole] = useState('Vigilador General');
  const [newCollabRecibo, setNewCollabRecibo] = useState('450000');
  const [newCollabExtra, setNewCollabExtra] = useState('130000');
  const [newCollabStatus, setNewCollabStatus] = useState<'PENDIENTE' | 'PAGO'>('PENDIENTE');

  // Dynamic metrics calculated directly from current interactive sheetsData
  const metrics = useMemo(
    () => calculateManagerialMetrics(currentPeriod, sheetsData),
    [currentPeriod, sheetsData]
  );
  const {
    profitability,
    totalIncome,
    totalDirectCosts,
    totalFixedExpenses,
    totalBankExpenses,
    totalAllCosts,
    globalNetMargin,
    globalNetMarginPercent,
    unpaidInvoices,
    totalUnpaidAmount,
    costDistribution,
    generalSummary,
  } = metrics;

  // Persist and synchronize state
  const updateAndSaveData = (newData: ManagerialMonthData) => {
    if (isReadOnly) return;
    setSheetsData(newData);
    saveManagerialMonthData(currentPeriod, newData);
  };

  // -------------------------------------------------------------
  // 1. CLIENT BILLING (FACTURACIÓN) - INLINE FORMULAS & EDITING
  // -------------------------------------------------------------
  const handleClientFieldChange = (
    index: number,
    field: keyof ClientBillingItem,
    value: string | number | boolean
  ) => {
    const updatedBilling = [...sheetsData.clientBilling];
    const item = { ...updatedBilling[index] };
    const currentIncludesVat = item.includesVat !== undefined ? item.includesVat : item.vatAmount > 0;
    const effectiveHours =
      item.totalHoursInput !== undefined
        ? parseFlexibleHours(item.totalHoursInput).decimalHours
        : item.totalHours;

    if (field === 'clientName') {
      item.clientName = String(value);
    } else if (field === 'hourlyRate') {
      const rate = Math.max(0, parseFloat(String(value)) || 0);
      item.hourlyRate = rate;
      item.totalHours = effectiveHours;
      item.includesVat = currentIncludesVat;
      const formulas = computeClientBillingFormulas(rate, effectiveHours, item.withholdings, currentIncludesVat);
      item.vatAmount = formulas.vatAmount;
      item.totalNet = formulas.totalNet;
    } else if (field === 'totalHours' || field === 'totalHoursInput') {
      const rawStr = String(value);
      const parsedH = parseFlexibleHours(rawStr);
      item.totalHoursInput = rawStr;
      item.totalHours = parsedH.decimalHours;
      item.includesVat = currentIncludesVat;
      const formulas = computeClientBillingFormulas(item.hourlyRate, parsedH.decimalHours, item.withholdings, currentIncludesVat);
      item.vatAmount = formulas.vatAmount;
      item.totalNet = formulas.totalNet;
    } else if (field === 'includesVat') {
      const nextIncludesVat = Boolean(value);
      item.includesVat = nextIncludesVat;
      item.totalHours = effectiveHours;
      const formulas = computeClientBillingFormulas(item.hourlyRate, effectiveHours, item.withholdings, nextIncludesVat);
      item.vatAmount = formulas.vatAmount;
      item.totalNet = formulas.totalNet;
    } else if (field === 'withholdings') {
      const ret = Math.max(0, parseFloat(String(value)) || 0);
      item.withholdings = ret;
      item.totalHours = effectiveHours;
      item.includesVat = currentIncludesVat;
      const formulas = computeClientBillingFormulas(item.hourlyRate, effectiveHours, ret, currentIncludesVat);
      item.vatAmount = formulas.vatAmount;
      item.totalNet = formulas.totalNet;
    } else if (field === 'status') {
      item.status = value as 'PAGO' | 'IMPAGO';
    } else if (field === 'invoiceNumber') {
      item.invoiceNumber = String(value);
    } else if (field === 'dueDate') {
      item.dueDate = String(value);
    }

    updatedBilling[index] = item;
    updateAndSaveData({ ...sheetsData, clientBilling: updatedBilling });
  };

  const handleAddClientRow = () => {
    const newRow: ClientBillingItem = {
      id: `cl-${Date.now()}`,
      clientName: 'Nuevo Cliente S.A.',
      hourlyRate: 5000,
      totalHours: 720,
      includesVat: true,
      vatAmount: Math.round(5000 * 720 * 0.21),
      withholdings: 0,
      totalNet: Math.round(5000 * 720 * 1.21),
      status: 'IMPAGO',
      invoiceNumber: `FAC-0001-${Math.floor(1000 + Math.random() * 9000)}`,
      dueDate: `${currentPeriod}-20`,
    };
    const updated = [...sheetsData.clientBilling, newRow];
    updateAndSaveData({ ...sheetsData, clientBilling: updated });
    if (onNotify) onNotify('¡Fila de cliente agregada con selector de IVA (21% / Sin IVA) y retenciones manuales!');
  };

  const handleDeleteClientRow = (index: number) => {
    const name = sheetsData.clientBilling[index]?.clientName;
    const updated = sheetsData.clientBilling.filter((_, i) => i !== index);
    updateAndSaveData({ ...sheetsData, clientBilling: updated });
    if (onNotify) onNotify(`Cliente "${name}" retirado de la planilla.`);
  };

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return sheetsData.clientBilling.filter((c) => {
      if (clientStatusFilter !== 'TODOS' && c.status !== clientStatusFilter) return false;
      if (clientSearch.trim()) {
        const q = clientSearch.toLowerCase();
        const mName = c.clientName.toLowerCase().includes(q);
        const mInv = (c.invoiceNumber || '').toLowerCase().includes(q);
        if (!mName && !mInv) return false;
      }
      return true;
    });
  }, [sheetsData.clientBilling, clientStatusFilter, clientSearch]);

  // Import Clients file
  const handleImportClientsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileLoading(true);
    try {
      const rows = await parseExcelOrCsvFile(file);
      if (!rows || rows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas válidas.');
        return;
      }
      const imported = importClientsFromRows(rows);
      updateAndSaveData({ ...sheetsData, clientBilling: imported });
      if (onNotify) onNotify(`¡Planilla de clientes cargada exitosamente! (${imported.length} clientes actualizados)`);
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer el archivo: ${err.message || 'Formato no soportado'}`);
    } finally {
      setIsFileLoading(false);
      if (clientFileInputRef.current) clientFileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------
  // 2. SUELDOS PERSONAL - RECIBO + X = SUELDO NETO
  // -------------------------------------------------------------
  const handleSalaryFieldChange = (
    index: number,
    field: keyof EmployeeSalaryItem,
    value: string | number
  ) => {
    const updatedSalaries = [...sheetsData.salaries];
    const item = { ...updatedSalaries[index] };
    const currentReceipt = item.receiptAmount !== undefined ? item.receiptAmount : item.netSalary;
    const currentExtra = item.extraAmount !== undefined ? item.extraAmount : 0;

    if (field === 'fullName') {
      item.fullName = String(value);
    } else if (field === 'assignedClientId') {
      const chosenClient = sheetsData.clientBilling.find(c => c.id === value);
      item.assignedClientId = String(value);
      item.assignedClientName = chosenClient ? chosenClient.clientName : (value === 'general' ? 'Supervisión / Base General' : '');
    } else if (field === 'assignedClientName') {
      item.assignedClientName = String(value);
    } else if (field === 'objectiveOrRole') {
      item.objectiveOrRole = String(value);
    } else if (field === 'receiptAmount') {
      const rec = Math.max(0, parseFloat(String(value)) || 0);
      item.receiptAmount = rec;
      item.extraAmount = currentExtra;
      item.netSalary = Math.round(rec + currentExtra);
    } else if (field === 'extraAmount') {
      const ext = Math.max(0, parseFloat(String(value)) || 0);
      item.receiptAmount = currentReceipt;
      item.extraAmount = ext;
      item.netSalary = Math.round(currentReceipt + ext);
    } else if (field === 'netSalary') {
      const net = Math.max(0, parseFloat(String(value)) || 0);
      item.netSalary = net;
    } else if (field === 'advance') {
      const adv = Math.max(0, parseFloat(String(value)) || 0);
      item.advance = adv;
    } else if (field === 'status') {
      item.status = value as 'PAGO' | 'PENDIENTE';
    }

    updatedSalaries[index] = item;
    updateAndSaveData({ ...sheetsData, salaries: updatedSalaries });
  };

  // Reordena alfabéticamente (A-Z) la lista de colaboradores
  const handleSortSalaries = () => {
    const sorted = sortSalariesAlphabetically(sheetsData.salaries);
    updateAndSaveData({ ...sheetsData, salaries: sorted });
    if (onNotify) onNotify('¡Nómina de colaboradores ordenada alfabéticamente por apellido y nombre (A-Z)!');
  };

  const handleOpenAddCollaboratorModal = () => {
    setNewCollabName('');
    setNewCollabClientId(sheetsData.clientBilling[0]?.id || 'general');
    setNewCollabRole('Vigilador General');
    setNewCollabRecibo('450000');
    setNewCollabExtra('130000');
    setNewCollabStatus('PENDIENTE');
    setIsAddCollaboratorModalOpen(true);
  };

  const handleConfirmAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCollabName.trim();
    if (!cleanName) {
      if (onNotify) onNotify('Por favor ingrese el apellido y nombre del colaborador.');
      return;
    }

    const rec = Math.max(0, parseFloat(newCollabRecibo) || 0);
    const ext = Math.max(0, parseFloat(newCollabExtra) || 0);
    const chosenClient = sheetsData.clientBilling.find(c => c.id === newCollabClientId);
    const clientName = chosenClient ? chosenClient.clientName : (newCollabClientId === 'general' ? 'Supervisión / Base General' : '');

    const newRow: EmployeeSalaryItem = {
      id: `sal-${Date.now()}`,
      index: sheetsData.salaries.length + 1,
      fullName: cleanName,
      objectiveOrRole: newCollabRole.trim() || 'Vigilador General',
      assignedClientId: newCollabClientId,
      assignedClientName: clientName,
      receiptAmount: rec,
      extraAmount: ext,
      netSalary: rec + ext,
      advance: 0,
      status: newCollabStatus,
    };

    // Al agregar nuevo colaborador, ordenarlo sistemáticamente por abecedario A-Z dentro de la lista existente
    const sorted = sortSalariesAlphabetically([...sheetsData.salaries, newRow]);
    updateAndSaveData({ ...sheetsData, salaries: sorted });
    setIsAddCollaboratorModalOpen(false);
    if (onNotify) {
      onNotify(`¡Colaborador "${cleanName}" registrado, asignado a ${clientName || 'Base'} y ordenado en el abecedario (A-Z)!`);
    }
  };

  const handleAddSalaryRow = () => {
    handleOpenAddCollaboratorModal();
  };

  const handleDeleteSalaryRow = (index: number) => {
    const name = sheetsData.salaries[index]?.fullName;
    const updated = sheetsData.salaries
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, index: i + 1 }));
    updateAndSaveData({ ...sheetsData, salaries: updated });
    if (onNotify) onNotify(`Colaborador "${name}" retirado de la planilla.`);
  };

  // Filtered Salaries
  const filteredSalaries = useMemo(() => {
    return sheetsData.salaries.filter((s) => {
      if (salaryStatusFilter !== 'TODOS' && s.status !== salaryStatusFilter) return false;
      if (salarySearch.trim()) {
        const q = salarySearch.toLowerCase();
        const mName = s.fullName.toLowerCase().includes(q);
        const mRole = s.objectiveOrRole.toLowerCase().includes(q);
        const mRec = (s.receipt || '').toLowerCase().includes(q);
        if (!mName && !mRole && !mRec) return false;
      }
      return true;
    });
  }, [sheetsData.salaries, salaryStatusFilter, salarySearch]);

  // Import Salaries file
  const handleImportSalariesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileLoading(true);
    try {
      const rows = await parseExcelOrCsvFile(file);
      if (!rows || rows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas válidas.');
        return;
      }
      const imported = importSalariesFromRows(rows);
      updateAndSaveData({ ...sheetsData, salaries: imported });
      if (onNotify) onNotify(`¡Nómina de sueldos cargada exitosamente! (${imported.length} colaboradores actualizados)`);
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer el archivo: ${err.message || 'Formato no soportado'}`);
    } finally {
      setIsFileLoading(false);
      if (salaryFileInputRef.current) salaryFileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------
  // 3. GASTOS FIJOS - INLINE FORMULAS & EDITING
  // -------------------------------------------------------------
  const handleFixedExpenseFieldChange = (
    index: number,
    field: keyof FixedExpenseItem,
    value: string | number
  ) => {
    const updatedFixed = [...sheetsData.fixedExpenses];
    const item = { ...updatedFixed[index] };

    if (field === 'category') {
      item.category = String(value);
    } else if (field === 'concept') {
      item.concept = String(value);
    } else if (field === 'amount') {
      const amt = Math.max(0, parseFloat(String(value)) || 0);
      item.amount = amt;
    } else if (field === 'status') {
      item.status = value as 'PAGO' | 'IMPAGO';
    } else if (field === 'comment') {
      item.comment = String(value);
    }

    updatedFixed[index] = item;
    updateAndSaveData({ ...sheetsData, fixedExpenses: updatedFixed });
  };

  const handleAddFixedExpenseRow = () => {
    const newRow: FixedExpenseItem = {
      id: `fx-${Date.now()}`,
      category: 'Operativo',
      concept: 'Nuevo Gasto Fijo / Servicio',
      amount: 50000,
      status: 'PAGO',
      comment: 'Comprobante mensual recurrente',
    };
    const updated = [...sheetsData.fixedExpenses, newRow];
    updateAndSaveData({ ...sheetsData, fixedExpenses: updated });
    if (onNotify) onNotify('¡Fila de gasto fijo agregada a la planilla!');
  };

  const handleDeleteFixedExpenseRow = (index: number) => {
    const concept = sheetsData.fixedExpenses[index]?.concept;
    const updated = sheetsData.fixedExpenses.filter((_, i) => i !== index);
    updateAndSaveData({ ...sheetsData, fixedExpenses: updated });
    if (onNotify) onNotify(`Gasto "${concept}" retirado de la planilla.`);
  };

  // Filtered Fixed Expenses
  const filteredFixedExpenses = useMemo(() => {
    return sheetsData.fixedExpenses.filter((f) => {
      if (fixedStatusFilter !== 'TODOS' && f.status !== fixedStatusFilter) return false;
      if (fixedSearch.trim()) {
        const q = fixedSearch.toLowerCase();
        const mCat = f.category.toLowerCase().includes(q);
        const mCon = f.concept.toLowerCase().includes(q);
        const mCom = (f.comment || '').toLowerCase().includes(q);
        if (!mCat && !mCon && !mCom) return false;
      }
      return true;
    });
  }, [sheetsData.fixedExpenses, fixedStatusFilter, fixedSearch]);

  // Import Fixed Expenses file
  const handleImportFixedExpensesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileLoading(true);
    try {
      const rows = await parseExcelOrCsvFile(file);
      if (!rows || rows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas válidas.');
        return;
      }
      const imported = importFixedExpensesFromRows(rows);
      updateAndSaveData({ ...sheetsData, fixedExpenses: imported });
      if (onNotify) onNotify(`¡Gastos fijos cargados exitosamente! (${imported.length} conceptos actualizados)`);
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer el archivo: ${err.message || 'Formato no soportado'}`);
    } finally {
      setIsFileLoading(false);
      if (fixedFileInputRef.current) fixedFileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------
  // 4. GASTOS BANCARIOS (NEW SHEET) - BANK DEBITS & COMMISSIONS
  // -------------------------------------------------------------
  const handleBankExpenseFieldChange = (
    index: number,
    field: keyof BankExpenseItem,
    value: string | number
  ) => {
    const updatedBank = [...sheetsData.bankExpenses];
    const item = { ...updatedBank[index] };

    if (field === 'bank') {
      item.bank = String(value);
    } else if (field === 'concept') {
      item.concept = String(value);
    } else if (field === 'amount') {
      const amt = Math.max(0, parseFloat(String(value)) || 0);
      item.amount = amt;
    } else if (field === 'date') {
      item.date = String(value);
    } else if (field === 'reference') {
      item.reference = String(value);
    } else if (field === 'status') {
      item.status = value as 'PAGO' | 'IMPAGO';
    } else if (field === 'comment') {
      item.comment = String(value);
    }

    updatedBank[index] = item;
    updateAndSaveData({ ...sheetsData, bankExpenses: updatedBank });
  };

  const handleAddBankExpenseRow = () => {
    const newRow: BankExpenseItem = {
      id: `bnk-${Date.now()}`,
      bank: 'Banco Galicia',
      concept: 'Comisión Mantenimiento de Cuenta / Débito',
      amount: 25000,
      date: `${currentPeriod}-15`,
      reference: `REF-${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'PAGO',
      comment: 'Extracto mensual',
    };
    const updated = [...sheetsData.bankExpenses, newRow];
    updateAndSaveData({ ...sheetsData, bankExpenses: updated });
    if (onNotify) onNotify('¡Fila de gasto bancario agregada a la planilla!');
  };

  const handleDeleteBankExpenseRow = (index: number) => {
    const concept = sheetsData.bankExpenses[index]?.concept;
    const updated = sheetsData.bankExpenses.filter((_, i) => i !== index);
    updateAndSaveData({ ...sheetsData, bankExpenses: updated });
    if (onNotify) onNotify(`Débito bancario "${concept}" retirado de la planilla.`);
  };

  // Filtered Bank Expenses
  const filteredBankExpenses = useMemo(() => {
    return (sheetsData.bankExpenses || []).filter((b) => {
      if (bankNameFilter !== 'TODOS' && b.bank !== bankNameFilter) return false;
      if (bankStatusFilter !== 'TODOS' && b.status !== bankStatusFilter) return false;
      if (bankSearch.trim()) {
        const q = bankSearch.toLowerCase();
        const mBank = b.bank.toLowerCase().includes(q);
        const mCon = b.concept.toLowerCase().includes(q);
        const mRef = (b.reference || '').toLowerCase().includes(q);
        const mCom = (b.comment || '').toLowerCase().includes(q);
        if (!mBank && !mCon && !mRef && !mCom) return false;
      }
      return true;
    });
  }, [sheetsData.bankExpenses, bankNameFilter, bankStatusFilter, bankSearch]);

  // Unique Banks list
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    ['Banco Galicia', 'Banco Macro', 'Banco Santander', 'Banco Nación', 'BBVA'].forEach(b => set.add(b));
    (sheetsData.bankExpenses || []).forEach(b => {
      if (b.bank) set.add(b.bank);
    });
    return Array.from(set);
  }, [sheetsData.bankExpenses]);

  // Import Bank Expenses file (RETAINING previous bank records as requested)
  const handleImportBankExpensesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileLoading(true);
    try {
      const rows = await parseExcelOrCsvFile(file);
      if (!rows || rows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas válidas.');
        return;
      }
      // Critical user requirement: "que permita clasificarlos por BANCO por lo que debe permitir cargar más de un archivo por mes reteniendo la información cargada anteriormente"
      const updated = importBankExpensesFromRows(rows, sheetsData.bankExpenses || []);
      updateAndSaveData({ ...sheetsData, bankExpenses: updated });
      if (onNotify) {
        onNotify(`¡Extracto bancario procesado e incorporado! Se sumaron ${rows.length} movimientos reteniendo los anteriores (Total: ${updated.length}).`);
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer el archivo bancario: ${err.message || 'Formato no soportado'}`);
    } finally {
      setIsFileLoading(false);
      if (bankFileInputRef.current) bankFileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------
  // 5. RENTABILIDAD POR CLIENTE
  // -------------------------------------------------------------
  const filteredProfitability = useMemo(() => {
    return profitability.filter((p) => {
      if (profitabilitySearch.trim()) {
        return p.clientName.toLowerCase().includes(profitabilitySearch.toLowerCase());
      }
      return true;
    });
  }, [profitability, profitabilitySearch]);

  // -------------------------------------------------------------
  // RESET PLANILLAS A 0 (ZERO-OUT SHEETS)
  // -------------------------------------------------------------
  const handleConfirmResetToZero = () => {
    const zeroed = resetMonthDataToZero(currentPeriod);
    setSheetsData(zeroed);
    setIsResetConfirmModalOpen(false);
    if (onNotify) {
      onNotify(`¡Planillas de ${currentPeriod} reiniciadas a $0 exitosamente para comenzar desde cero!`);
    }
  };

  // -------------------------------------------------------------
  // INICIAR NUEVO MES
  // -------------------------------------------------------------
  const handleStartNewMonthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPeriod = nextPeriodInput.trim();
    if (!cleanPeriod || !cleanPeriod.includes('-')) return;

    const freshData = startNewMonth(currentPeriod, cleanPeriod);
    setSheetsData(freshData);
    setIsNewMonthModalOpen(false);
    if (onPeriodChange) onPeriodChange(cleanPeriod);
    if (onNotify) {
      onNotify(`¡Período ${cleanPeriod} iniciado en blanco para Gerencia General!`);
    }
  };

  // Quick Advance Modal Submit
  const handleSaveAdvanceModal = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(advanceAmountInput);
    if (isNaN(amount) || amount < 0) return;

    const empName = targetEmployee || sheetsData.salaries[0]?.fullName || 'Luciano Aguero';
    const res = updateSalaryAdvance(empName, amount, currentPeriod);
    if (res.success) {
      setSheetsData(getManagerialMonthData(currentPeriod));
      setIsAdvanceModalOpen(false);
      if (onNotify) onNotify(res.message);
    } else {
      alert(res.message);
    }
  };

  // Copy Plain Text Table
  const handleCopyPlainText = (
    type: 'gastos_fijos' | 'sueldos' | 'clientes' | 'gastos_bancarios' | 'rentabilidad' | 'resumen' | 'todas'
  ) => {
    const text = generatePlainTextTable(type, currentPeriod);
    setPlainTextPreview(text);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    if (onNotify) onNotify(`¡Planilla copiada al portapapeles en formato Excel de texto plano!`);
    setShowCopyModal(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for uploading Excel/CSV into each sheet */}
      <input
        ref={clientFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportClientsFile}
      />
      <input
        ref={salaryFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportSalariesFile}
      />
      <input
        ref={fixedFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportFixedExpensesFile}
      />
      <input
        ref={bankFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportBankExpensesFile}
      />

      {/* Sub Gerencia Read-Only Alert Banner */}
      {isReadOnly && (
        <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-200 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Planillas en Modo Solo Lectura (Sub Gerencia / Vicepresidencia):</strong> Visualización ejecutiva, auditoría y exportación habilitadas. Toda modificación, alta de colaboradores/gastos o cierre de mes está reservada a la Gerencia General (Yamila y Domingo).
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-900 text-rose-200 border border-rose-700 shrink-0">
            SOLO VISTA
          </span>
        </div>
      )}

      {/* 1. Header Banner & Excel Action Controls */}
      <div className="p-5 bg-gradient-to-r from-[#171a26] via-[#1b2132] to-[#171a26] border border-[#2d3852] rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 border ${
              isReadOnly
                ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              <Lock className="w-3 h-3" />
              {isReadOnly ? 'Sub Gerencia (Modo Auditoría / Solo Lectura)' : 'Exclusivo Gerencia General (C-Level)'}
            </span>
            <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5 bg-[#141926] px-2.5 py-0.5 rounded-full border border-[#273248]">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Período: <strong className="text-white">{currentPeriod}</strong>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
              <Calculator className="w-3 h-3 text-emerald-400" />
              Fórmulas en Tiempo Real & Lector de Archivos Activos
            </span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Módulo Financiero Gerencial & Planillas Interactivas (Excel)</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Gestión integral de clientes, nómina de sueldos netos, gastos fijos y extractos bancarios. Carga ágil interactiva o por archivo (.xlsx / .csv) con recálculo automático de fórmulas y exportaciones filtradas.
          </p>
        </div>

        {/* Global Toolbar: Reiniciar a 0, Copiar Excel, Iniciar Mes */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isReadOnly && (
            <button
              onClick={() => setIsResetConfirmModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-200 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 rounded-xl shadow transition-all active:scale-95 cursor-pointer"
              title="Reiniciar todos los números del mes a $0 para comenzar la carga desde cero"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reiniciar a Cero (0)</span>
            </button>
          )}

          <button
            onClick={() => handleCopyPlainText('todas')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:brightness-110 border border-emerald-500/40 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
            title="Copiar todas las tablas formateadas en texto plano listas para pegar en Excel"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
            <span>Copiar Planillas (Excel)</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setIsNewMonthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 bg-[#222a3d] hover:bg-[#2b354d] border border-[#344260] rounded-xl transition-all active:scale-95 cursor-pointer"
              title="Cerrar el mes actual e iniciar el siguiente en blanco"
            >
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Iniciar Nuevo Mes</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Executive Metrics Cards (Auto-computed from formulas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ingresos Totales (Suma de Clientes) */}
        <div
          onClick={() => setActiveSheetTab('clientes')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheetTab === 'clientes'
              ? 'bg-[#182030] border-blue-500/60 ring-1 ring-blue-500/30'
              : 'bg-[#121620] border-[#22293b] hover:border-[#333e57]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Ingresos Totales (Facturación)
            </span>
            <div className="p-1.5 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/40">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white flex items-baseline justify-between">
            <span>{formatCurrencyARS(totalIncome)}</span>
            <span className="text-[11px] font-semibold text-slate-400 font-sans">
              ({sheetsData.clientBilling.length} clientes activos)
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-[#1e2638] flex flex-col gap-0.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pendientes de Cobro:
              </span>
              <span className="font-bold text-amber-300">
                {formatCurrencyARS(metrics.totalUnpaidAmount || 0)} ({metrics.unpaidInvoicesCount || 0} impagos)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400">Cobrados: {formatCurrencyARS(metrics.paidInvoicesAmount || 0)}</span>
              <span className="text-emerald-400 font-semibold text-[10px] bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50">
                fx: Suma Total Neto
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Costos Directos Guardias (Sueldos Netos) */}
        <div
          onClick={() => setActiveSheetTab('sueldos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheetTab === 'sueldos'
              ? 'bg-[#182030] border-amber-500/60 ring-1 ring-amber-500/30'
              : 'bg-[#121620] border-[#22293b] hover:border-[#333e57]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Costos Directos (Sueldos Netos)
            </span>
            <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 flex items-baseline justify-between">
            <span>{formatCurrencyARS(totalDirectCosts)}</span>
            <span className="text-[11px] font-semibold text-slate-400 font-sans">
              ({metrics.countSalaries ?? sheetsData.salaries.length} colaboradores)
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-[#1e2638] flex flex-col gap-0.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pendientes de Pago:
              </span>
              <span className="font-bold text-amber-300">
                {formatCurrencyARS(metrics.unpaidSalariesAmount || 0)} ({metrics.unpaidSalariesCount || 0} impagos)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400">
                Pagados: {formatCurrencyARS(metrics.paidSalariesAmount || 0)} ({metrics.paidSalariesCount || 0} pagados)
              </span>
              {metrics.totalAdvances > 0 ? (
                <span className="text-sky-400">Anticipos: {formatCurrencyARS(metrics.totalAdvances)}</span>
              ) : (
                <span className="text-amber-400/80">fx: Suma Recibo + X</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Gastos Fijos (Total Registrados vs Total Pendientes de Pago) */}
        <div
          onClick={() => setActiveSheetTab('gastos_fijos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheetTab === 'gastos_fijos' || activeSheetTab === 'gastos_bancarios'
              ? 'bg-[#182030] border-purple-500/60 ring-1 ring-purple-500/30'
              : 'bg-[#121620] border-[#22293b] hover:border-[#333e57]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
              Gastos Fijos Registrados
            </span>
            <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-800/40">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white flex items-baseline justify-between">
            <span>{formatCurrencyARS(totalFixedExpenses)}</span>
            <span className="text-[11px] font-semibold text-slate-400 font-sans">
              ({metrics.countFixedExpenses ?? sheetsData.fixedExpenses.length} registrados)
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-[#1e2638] flex flex-col gap-0.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pendientes de Pago:
              </span>
              <span className="font-bold text-amber-300">
                {formatCurrencyARS(metrics.unpaidFixedExpensesAmount || 0)} ({metrics.unpaidFixedExpensesCount || 0} impagos)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400">Pagados: {formatCurrencyARS(metrics.paidFixedExpensesAmount || 0)}</span>
              <span className="text-cyan-400">Bancos: {formatCurrencyARS(totalBankExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Margen Neto Consolidado */}
        <div
          onClick={() => setActiveSheetTab('rentabilidad')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheetTab === 'rentabilidad'
              ? 'bg-[#182030] border-emerald-500/60 ring-1 ring-emerald-500/30'
              : 'bg-[#121620] border-[#22293b] hover:border-[#333e57]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Margen Neto Libre
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 flex items-baseline justify-between">
            <span>{formatCurrencyARS(globalNetMargin)}</span>
            <span className="font-bold text-white px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/50 text-[11px]">
              {globalNetMarginPercent}% Libre
            </span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-[#1e2638] flex flex-col gap-0.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Costos Operativos Totales:</span>
              <span className="font-bold text-rose-300">
                {formatCurrencyARS(totalAllCosts)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Resultado Operativo:</span>
              <span className={globalNetMargin >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {globalNetMargin >= 0 ? 'Superávit C-Level' : 'Déficit Operativo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs for Sheets */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#22293b]">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'clientes', label: '1. Clientes (Facturación)', count: sheetsData.clientBilling.length },
            { id: 'sueldos', label: '2. Sueldos Personal', count: sheetsData.salaries.length },
            { id: 'gastos_fijos', label: '3. Gastos Fijos', count: sheetsData.fixedExpenses.length },
            { id: 'gastos_bancarios', label: '4. Gastos Bancarios', count: (sheetsData.bankExpenses || []).length },
            { id: 'rentabilidad', label: '5. Rentabilidad por Cliente', count: profitability.length },
            { id: 'alertas', label: '6. Alertas de Cobranza', count: unpaidInvoices.length, isAlert: unpaidInvoices.length > 0 },
            { id: 'resumen', label: '7. Resumen General', count: generalSummary.length },
          ].map((tab) => {
            const isActive = activeSheetTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSheetTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? 'bg-[#BE2629] text-white border-[#BE2629] shadow-md scale-[1.01]'
                    : 'bg-[#121620] hover:bg-[#181e2b] text-slate-300 border-[#22293b]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-black/30 text-white'
                      : tab.isAlert
                      ? 'bg-amber-600 text-black animate-pulse'
                      : 'bg-[#1d2535] text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => handleCopyPlainText(activeSheetTab === 'alertas' ? 'clientes' : activeSheetTab)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#1a2130] hover:bg-[#232b3d] border border-[#2a3449] rounded-xl transition-colors cursor-pointer"
            title="Copiar la tabla actual en formato de texto plano para Excel"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copiar Esta Tabla</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SHEET 1: CLIENTES (FACTURACIÓN) - LIVE SPREADSHEET */}
      {/* ============================================================== */}
      {activeSheetTab === 'clientes' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            {/* Header, Search & Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>Planilla Interactiva: Clientes (Facturación)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modifica clientes, <strong>Tarifa Hora ($)</strong> y <strong>Horas Totales</strong> (soporta horas exactas con minutos sin decimales, ej: <strong>271:38hs</strong> o <strong>271:38</strong>). Selecciona si aplica <strong>IVA (21%)</strong> (SÍ / NO) e ingresa las <strong>Retenciones</strong> para calcular el <strong>Total Neto</strong>.
                </p>
              </div>

              {/* Action Buttons: Cargar Archivo, Exportar CSV/PDF, Agregar Cliente */}
              <div className="flex flex-wrap items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => clientFileInputRef.current?.click()}
                    disabled={isFileLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-cyan-300 font-bold text-xs border border-cyan-800/40 shadow transition-all cursor-pointer active:scale-95"
                    title="Cargar archivo Excel (.xlsx / .xls) o CSV con clientes para importación automática"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isFileLoading ? 'Procesando...' : 'Cargar Archivo (Excel/CSV)'}</span>
                  </button>
                )}

                <button
                  onClick={() => exportClientsToCSV(filteredClients, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar la lista actual (con filtros aplicados) a CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV (Filtrado)</span>
                </button>

                <button
                  onClick={() => exportClientsToPDF(filteredClients, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar la lista actual (con filtros aplicados) a PDF oficial C-Level"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  <span>Exportar PDF (Filtrado)</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={handleAddClientRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Cliente</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0f131c] rounded-xl border border-[#1e2638] mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente o factura..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Estado:
                </span>
                {(['TODOS', 'PAGO', 'IMPAGO'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setClientStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                      clientStatusFilter === st
                        ? st === 'IMPAGO'
                          ? 'bg-red-950 text-red-300 border-red-700'
                          : st === 'PAGO'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-blue-900/60 text-white border-blue-500'
                        : 'bg-[#151a24] text-slate-400 border-[#222a3a] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 min-w-[200px]">Cliente</th>
                    <th className="py-2.5 px-3 text-right min-w-[120px]">
                      <span className="block">Tarifa Hora ($)</span>
                      <span className="text-[9px] text-blue-400 font-normal">Editable ($)</span>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[125px]">
                      <span className="block text-cyan-300">Horas Totales</span>
                      <span className="text-[9px] text-cyan-400 font-normal font-mono">Ej: 720 o 271:38hs</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">
                      <span className="block text-sky-300">Subtotal ($)</span>
                      <span className="text-[9px] text-sky-400 font-normal font-mono">fx: Horas × Tarifa</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[175px]">
                      <span className="block">¿Cobra IVA (21%)?</span>
                      <span className="text-[9px] text-emerald-400 font-normal font-mono">Botón SÍ (21%) / NO ($0)</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[140px]">
                      <span className="block">Retenciones ($)</span>
                      <span className="text-[9px] text-amber-400 font-normal font-mono">Carga Manual</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[140px]">
                      <span className="block">Total Neto</span>
                      <span className="text-[9px] text-emerald-400 font-normal font-mono">fx: Sub+IVA-Ret</span>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[100px]">Estado</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433] font-mono">
                  {filteredClients.map((client) => {
                    const originalIdx = sheetsData.clientBilling.findIndex((c) => c.id === client.id);
                    const hInfo = parseFlexibleHours(
                      client.totalHoursInput !== undefined ? client.totalHoursInput : client.totalHours
                    );
                    const subtotal = Math.round((client.hourlyRate || 0) * hInfo.decimalHours);
                    return (
                      <tr key={client.id} className="hover:bg-[#161b26]/70 transition-colors group">
                        {/* Cliente Name */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={client.clientName}
                            onChange={(e) => handleClientFieldChange(originalIdx, 'clientName', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none transition-colors"
                          />
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                            <span>{client.invoiceNumber || 'Sin factura'}</span>
                            <span>· Vto: {client.dueDate || 'Vto fin de mes'}</span>
                          </div>
                        </td>

                        {/* Tarifa hora */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={client.hourlyRate}
                              onChange={(e) => handleClientFieldChange(originalIdx, 'hourlyRate', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-blue-500 rounded-lg pl-5 pr-2 py-1 text-xs text-slate-200 text-right focus:outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Horas totales (Soporta 271:38hs o número) */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="text"
                            value={client.totalHoursInput !== undefined ? client.totalHoursInput : String(client.totalHours)}
                            onChange={(e) => handleClientFieldChange(originalIdx, 'totalHoursInput', e.target.value)}
                            placeholder="Ej: 720 o 271:38hs"
                            className="w-28 mx-auto bg-[#161c28] border border-[#223446] focus:border-cyan-400 rounded-lg px-2 py-1 text-xs text-cyan-200 font-semibold text-center focus:outline-none transition-colors"
                            title="Ingresar horas totales (ej: 720, 271:38hs o 271:38)"
                          />
                          {hInfo.isTimeFormat && (
                            <span className="block text-[9px] text-cyan-400 mt-0.5 font-mono">
                              {hInfo.hoursPart}h {hInfo.minutesPart}m ({hInfo.decimalHours.toFixed(2)} hs)
                            </span>
                          )}
                        </td>

                        {/* Subtotal (Horas × Tarifa Hora) */}
                        <td className="py-2 px-3 text-right text-sky-300 font-semibold bg-[#111622]/30">
                          <div>{formatCurrencyARS(subtotal)}</div>
                          {hInfo.isTimeFormat && (
                            <span className="block text-[9px] text-sky-400/80 font-mono">
                              {hInfo.formattedLabel} × {formatCurrencyARS(client.hourlyRate)}
                            </span>
                          )}
                        </td>

                        {/* IVA (Interactive Toggle SÍ 21% / NO + Automated Formula) */}
                        <td className="py-2 px-3 text-right bg-[#111622]/40">
                          {(() => {
                            const hasVat = client.includesVat !== undefined ? client.includesVat : client.vatAmount > 0;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <div className="inline-flex items-center rounded-lg bg-[#0d111a] p-0.5 border border-[#252f45]">
                                  <button
                                    type="button"
                                    onClick={() => handleClientFieldChange(originalIdx, 'includesVat', true)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                      hasVat
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Cobrar con IVA (calcula automáticamente el 21%)"
                                  >
                                    SÍ (21%)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClientFieldChange(originalIdx, 'includesVat', false)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                      !hasVat
                                        ? 'bg-slate-700 text-slate-100 shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="Sin IVA (no aplica el incremento del 21%)"
                                  >
                                    NO
                                  </button>
                                </div>
                                <span className={`text-xs font-semibold ${hasVat ? 'text-emerald-300' : 'text-slate-500'}`}>
                                  {hasVat ? formatCurrencyARS(client.vatAmount) : '$ 0 (Sin IVA)'}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Retenciones (Manual Editable Input) */}
                        <td className="py-2 px-3 text-right bg-[#111622]/40">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-red-400/70 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={client.withholdings}
                              onChange={(e) => handleClientFieldChange(originalIdx, 'withholdings', e.target.value)}
                              placeholder="0"
                              className="w-full bg-[#161c28] border border-[#2a344a] focus:border-amber-500 rounded-lg pl-5 pr-2 py-1 text-xs text-red-300 font-semibold text-right focus:outline-none transition-colors"
                              title="Ingresar monto de retenciones manualmente"
                            />
                          </div>
                        </td>

                        {/* Total Neto (Automated Formula) */}
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold bg-emerald-950/20">
                          {formatCurrencyARS(client.totalNet)}
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleClientFieldChange(originalIdx, 'status', client.status === 'PAGO' ? 'IMPAGO' : 'PAGO')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                              client.status === 'PAGO'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                            }`}
                          >
                            {client.status}
                          </button>
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDeleteClientRow(originalIdx)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Eliminar fila de cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Spreadsheet Totals Row */}
                <tfoot>
                  <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                    <td className="py-3 px-3 text-white uppercase font-sans">
                      TOTAL CLIENTES FILTRADOS ({filteredClients.length})
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">-</td>
                    <td className="py-3 px-3 text-center text-cyan-300">
                      {(() => {
                        const totalDecHours = filteredClients.reduce(
                          (acc, c) =>
                            acc +
                            parseFlexibleHours(
                              c.totalHoursInput !== undefined ? c.totalHoursInput : c.totalHours
                            ).decimalHours,
                          0
                        );
                        return parseFlexibleHours(totalDecHours).formattedLabel;
                      })()}
                    </td>
                    <td className="py-3 px-3 text-right text-sky-300">
                      {formatCurrencyARS(
                        filteredClients.reduce((acc, c) => {
                          const h = parseFlexibleHours(
                            c.totalHoursInput !== undefined ? c.totalHoursInput : c.totalHours
                          ).decimalHours;
                          return acc + Math.round((c.hourlyRate || 0) * h);
                        }, 0)
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatCurrencyARS(filteredClients.reduce((acc, c) => acc + c.vatAmount, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-red-300">
                      {formatCurrencyARS(filteredClients.reduce((acc, c) => acc + c.withholdings, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      {formatCurrencyARS(filteredClients.reduce((acc, c) => acc + c.totalNet, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 2: SUELDOS PERSONAL - STRICTLY SUELDO NETO */}
      {/* ============================================================== */}
      {activeSheetTab === 'sueldos' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            {/* Header & Action Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Planilla Interactiva: Sueldos Personal (Recibo + X = Sueldo Neto)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registra el monto en blanco en <strong>Recibo ($)</strong> y lo que cobra por fuera del bono en <strong>X ($)</strong>. Ambas columnas se suman automáticamente para obtener el <strong>Sueldo Neto ($)</strong> y restar anticipos.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => salaryFileInputRef.current?.click()}
                    disabled={isFileLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-cyan-300 font-bold text-xs border border-cyan-800/40 shadow transition-all cursor-pointer active:scale-95"
                    title="Cargar archivo Excel (.xlsx / .xls) o CSV con la nómina de sueldos para importación automática"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isFileLoading ? 'Procesando...' : 'Cargar Nómina (Excel/CSV)'}</span>
                  </button>
                )}

                <button
                  onClick={() => exportSalariesToCSV(filteredSalaries, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar la nómina actual (con filtros aplicados) a CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV (Filtrado)</span>
                </button>

                <button
                  onClick={() => exportSalariesToPDF(filteredSalaries, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar la nómina actual (con filtros aplicados) a PDF oficial C-Level"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  <span>Exportar PDF (Filtrado)</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={() => setIsAdvanceModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cargar Anticipo Específico</span>
                  </button>
                )}

                <button
                  onClick={handleSortSalaries}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-amber-300 font-bold text-xs border border-amber-800/40 shadow transition-all cursor-pointer active:scale-95"
                  title="Ordenar toda la nómina alfabéticamente (A-Z) por apellido y nombre"
                >
                  <span>🔤 Ordenar A-Z</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={handleOpenAddCollaboratorModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202738] hover:bg-[#2b354d] text-white font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Agregar Colaborador</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0f131c] rounded-xl border border-[#1e2638] mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por colaborador, objetivo o recibo..."
                  value={salarySearch}
                  onChange={(e) => setSalarySearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Estado:
                </span>
                {(['TODOS', 'PAGO', 'PENDIENTE'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSalaryStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                      salaryStatusFilter === st
                        ? st === 'PENDIENTE'
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : st === 'PAGO'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-blue-900/60 text-white border-blue-500'
                        : 'bg-[#151a24] text-slate-400 border-[#222a3a] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2.5 text-center w-10">#</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Apellido y Nombre</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Servicio / Cliente Asignado</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Objetivo / Función</th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">
                      <span className="block text-sky-300">Recibo ($)</span>
                      <span className="text-[9px] text-sky-400 font-normal">En Blanco (Editable)</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[125px]">
                      <span className="block text-purple-300">X ($)</span>
                      <span className="text-[9px] text-purple-400 font-normal">Fuera de Bono</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[135px]">
                      <span className="block text-emerald-300">Sueldo Neto ($)</span>
                      <span className="text-[9px] text-emerald-400 font-normal font-mono">fx: Recibo + X</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[120px]">
                      <span className="block">Anticipo ($)</span>
                      <span className="text-[9px] text-amber-400 font-normal">Editable</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[135px]">
                      <span className="block">Neto Cobrado ($)</span>
                      <span className="text-[9px] text-emerald-400 font-normal font-mono">fx: Neto - Ant.</span>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[100px]">Estado</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433] font-mono">
                  {filteredSalaries.map((sal) => {
                    const originalIdx = sheetsData.salaries.findIndex((s) => s.id === sal.id);
                    const recAmt = sal.receiptAmount !== undefined ? sal.receiptAmount : sal.netSalary;
                    const extAmt = sal.extraAmount !== undefined ? sal.extraAmount : 0;
                    const computedNetSalary = Math.round(recAmt + extAmt);
                    const netCobrado = Math.max(0, computedNetSalary - sal.advance);
                    return (
                      <tr key={sal.id} className="hover:bg-[#161b26]/70 transition-colors group">
                        <td className="py-2 px-2.5 text-center text-slate-500 font-sans">
                          {sal.index}
                        </td>

                        {/* Full Name */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={sal.fullName}
                            onChange={(e) => handleSalaryFieldChange(originalIdx, 'fullName', e.target.value)}
                            onBlur={handleSortSalaries}
                            className="w-full bg-[#161c28] border border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none transition-colors"
                            title="Nombre del colaborador. Al salir del campo se reordena alfabéticamente A-Z."
                          />
                        </td>

                        {/* Servicio / Cliente Asignado */}
                        <td className="py-2 px-3 font-sans">
                          <select
                            value={sal.assignedClientId || 'general'}
                            onChange={(e) => handleSalaryFieldChange(originalIdx, 'assignedClientId', e.target.value)}
                            className="w-full bg-[#161c28] border border-[#263148] focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-semibold focus:outline-none transition-colors cursor-pointer"
                            title="Asignar el cliente o servicio para computar costos directos y rentabilidad real"
                          >
                            <option value="general" className="bg-[#121620] text-slate-300">
                              🏛️ Supervisión / Base General
                            </option>
                            {sheetsData.clientBilling.map((cl) => (
                              <option key={cl.id} value={cl.id} className="bg-[#121620] text-white">
                                🏢 {cl.clientName}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Objective or Function */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={sal.objectiveOrRole}
                            onChange={(e) => handleSalaryFieldChange(originalIdx, 'objectiveOrRole', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none transition-colors"
                          />
                        </td>

                        {/* RECIBO (En blanco) */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-sky-400/70 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={recAmt}
                              onChange={(e) => handleSalaryFieldChange(originalIdx, 'receiptAmount', e.target.value)}
                              className="w-full bg-[#161c28] border border-[#253248] focus:border-sky-500 rounded-lg pl-5 pr-2 py-1 text-xs text-sky-200 text-right font-semibold focus:outline-none transition-colors"
                              title="Monto cobrado por recibo en blanco"
                            />
                          </div>
                        </td>

                        {/* X (Por fuera del bono) */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-purple-400/70 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={extAmt}
                              onChange={(e) => handleSalaryFieldChange(originalIdx, 'extraAmount', e.target.value)}
                              className="w-full bg-[#161c28] border border-[#2d2546] focus:border-purple-500 rounded-lg pl-5 pr-2 py-1 text-xs text-purple-200 text-right font-semibold focus:outline-none transition-colors"
                              title="Monto cobrado en X (por fuera del bono)"
                            />
                          </div>
                        </td>

                        {/* Sueldo Neto (Automated Formula: Recibo + X) */}
                        <td className="py-2 px-3 text-right text-emerald-300 font-bold bg-emerald-950/15">
                          {formatCurrencyARS(computedNetSalary)}
                        </td>

                        {/* Anticipo */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={sal.advance}
                              onChange={(e) => handleSalaryFieldChange(originalIdx, 'advance', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-amber-500 rounded-lg pl-5 pr-2 py-1 text-xs text-amber-300 text-right font-semibold focus:outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Neto Cobrado (Automated Formula: Sueldo Neto - Anticipo) */}
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold bg-emerald-950/25">
                          {formatCurrencyARS(netCobrado)}
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleSalaryFieldChange(originalIdx, 'status', sal.status === 'PAGO' ? 'PENDIENTE' : 'PAGO')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                              sal.status === 'PAGO'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {sal.status}
                          </button>
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDeleteSalaryRow(originalIdx)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Eliminar colaborador de la planilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals Row */}
                <tfoot>
                  <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                    <td colSpan={3} className="py-3 px-3 text-white uppercase font-sans">
                      TOTAL SUELDOS ({filteredSalaries.length} colaboradores)
                    </td>
                    <td className="py-3 px-3 text-right text-sky-300">
                      {formatCurrencyARS(
                        filteredSalaries.reduce((acc, s) => acc + (s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary), 0)
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-purple-300">
                      {formatCurrencyARS(
                        filteredSalaries.reduce((acc, s) => acc + (s.extraAmount || 0), 0)
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      {formatCurrencyARS(
                        filteredSalaries.reduce(
                          (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
                          0
                        )
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-400">
                      {formatCurrencyARS(filteredSalaries.reduce((acc, s) => acc + s.advance, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      {formatCurrencyARS(
                        filteredSalaries.reduce(
                          (acc, s) =>
                            acc +
                            Math.max(
                              0,
                              (s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0) - s.advance
                            ),
                          0
                        )
                      )}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 3: GASTOS FIJOS - LIVE SPREADSHEET */}
      {/* ============================================================== */}
      {activeSheetTab === 'gastos_fijos' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-400" />
                  <span>Planilla Interactiva: Gastos Fijos Societarios</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Alquiler sede, pólizas de seguros, cánones regulatorios REPRIV y asesorías contables.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => fixedFileInputRef.current?.click()}
                    disabled={isFileLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-cyan-300 font-bold text-xs border border-cyan-800/40 shadow transition-all cursor-pointer active:scale-95"
                    title="Cargar archivo Excel (.xlsx / .xls) o CSV con gastos fijos para importación automática"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isFileLoading ? 'Procesando...' : 'Cargar Gastos Fijos (Excel/CSV)'}</span>
                  </button>
                )}

                <button
                  onClick={() => exportFixedExpensesToCSV(filteredFixedExpenses, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar los gastos fijos actuales a CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV (Filtrado)</span>
                </button>

                <button
                  onClick={() => exportFixedExpensesToPDF(filteredFixedExpenses, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar los gastos fijos actuales a PDF oficial C-Level"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  <span>Exportar PDF (Filtrado)</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={handleAddFixedExpenseRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Gasto Fijo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0f131c] rounded-xl border border-[#1e2638] mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por concepto, categoría o comentario..."
                  value={fixedSearch}
                  onChange={(e) => setFixedSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Estado:
                </span>
                {(['TODOS', 'PAGO', 'IMPAGO'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFixedStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                      fixedStatusFilter === st
                        ? st === 'IMPAGO'
                          ? 'bg-red-950 text-red-300 border-red-700'
                          : st === 'PAGO'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-blue-900/60 text-white border-blue-500'
                        : 'bg-[#151a24] text-slate-400 border-[#222a3a] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 min-w-[150px]">Categoría</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Concepto</th>
                    <th className="py-2.5 px-3 text-right min-w-[140px]">
                      <span className="block">Monto $</span>
                      <span className="text-[9px] text-purple-400 font-normal">Editable</span>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[100px]">Estado</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Comentario</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433] font-mono">
                  {filteredFixedExpenses.map((exp) => {
                    const originalIdx = sheetsData.fixedExpenses.findIndex((f) => f.id === exp.id);
                    return (
                      <tr key={exp.id} className="hover:bg-[#161b26]/70 transition-colors group">
                        {/* Categoría */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={exp.category}
                            onChange={(e) => handleFixedExpenseFieldChange(originalIdx, 'category', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-purple-500 rounded-lg px-2.5 py-1 text-xs text-purple-300 font-semibold focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Concepto */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={exp.concept}
                            onChange={(e) => handleFixedExpenseFieldChange(originalIdx, 'concept', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Monto Final */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={exp.amount}
                              onChange={(e) => handleFixedExpenseFieldChange(originalIdx, 'amount', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-purple-500 rounded-lg pl-5 pr-2 py-1 text-xs text-slate-200 text-right font-bold focus:outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleFixedExpenseFieldChange(originalIdx, 'status', exp.status === 'PAGO' ? 'IMPAGO' : 'PAGO')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                              exp.status === 'PAGO'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                            }`}
                          >
                            {exp.status}
                          </button>
                        </td>

                        {/* Comentario */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={exp.comment}
                            onChange={(e) => handleFixedExpenseFieldChange(originalIdx, 'comment', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-purple-500 rounded-lg px-2.5 py-1 text-xs text-slate-400 focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDeleteFixedExpenseRow(originalIdx)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Eliminar gasto fijo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals Row */}
                <tfoot>
                  <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                    <td colSpan={2} className="py-3 px-3 text-white uppercase font-sans">
                      TOTAL GASTOS FIJOS FILTRADOS ({filteredFixedExpenses.length})
                    </td>
                    <td className="py-3 px-3 text-right text-purple-400 text-sm">
                      {formatCurrencyARS(filteredFixedExpenses.reduce((acc, f) => acc + f.amount, 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 4: GASTOS BANCARIOS (NEW SHEET) */}
      {/* ============================================================== */}
      {activeSheetTab === 'gastos_bancarios' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-cyan-400" />
                  <span>Planilla Interactiva: Gastos Bancarios & Débitos Fiscales</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clasificación y deducción de <strong>Impuesto Ley 25.413</strong>, comisiones de mantenimiento y débitos por entidad bancaria. Puedes cargar múltiples extractos por mes reteniendo la información anterior.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => bankFileInputRef.current?.click()}
                    disabled={isFileLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-cyan-300 font-bold text-xs border border-cyan-800/40 shadow transition-all cursor-pointer active:scale-95"
                    title="Cargar extracto bancario en Excel (.xlsx / .xls) o CSV sumándolo a los ya cargados este mes"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isFileLoading ? 'Procesando...' : 'Cargar Extracto Bancario'}</span>
                  </button>
                )}

                <button
                  onClick={() => exportBankExpensesToCSV(filteredBankExpenses, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar los gastos bancarios filtrados a CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV (Filtrado)</span>
                </button>

                <button
                  onClick={() => exportBankExpensesToPDF(filteredBankExpenses, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                  title="Exportar los gastos bancarios filtrados a PDF oficial C-Level"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  <span>Exportar PDF (Filtrado)</span>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={handleAddBankExpenseRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Movimiento Bancario</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bank Summary Chips with Explicit Colors */}
            <div className="space-y-2 pb-2 border-b border-[#1f2738] mb-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Subtotales por Banco & Identificación Cromática:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                  Galicia (Naranja) · Macro (Azul) · Nación (Celeste) · Santander (Rojo) · BBVA (Violeta)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {availableBanks.map((bankName) => {
                  const totalForBank = (sheetsData.bankExpenses || [])
                    .filter((b) => b.bank === bankName)
                    .reduce((acc, curr) => acc + curr.amount, 0);
                  if (totalForBank === 0) return null;
                  const isSelected = bankNameFilter === bankName;
                  const theme = getBankColorTheme(bankName);
                  return (
                    <button
                      key={bankName}
                      onClick={() => setBankNameFilter(isSelected ? 'TODOS' : bankName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                        isSelected ? theme.chipActive : theme.chipInactive
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
                      <span>{bankName}:</span>
                      <strong className="text-white">{formatCurrencyARS(totalForBank)}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0f131c] rounded-xl border border-[#1e2638] mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por concepto, banco, referencia..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Banco:</span>
                  <select
                    value={bankNameFilter}
                    onChange={(e) => setBankNameFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-[#151a24] text-xs text-white border border-[#222a3a] cursor-pointer"
                  >
                    <option value="TODOS">Todos los Bancos</option>
                    {availableBanks.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Estado:</span>
                  {(['TODOS', 'PAGO', 'IMPAGO'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setBankStatusFilter(st)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                        bankStatusFilter === st
                          ? st === 'IMPAGO'
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : st === 'PAGO'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : 'bg-blue-900/60 text-white border-blue-500'
                          : 'bg-[#151a24] text-slate-400 border-[#222a3a] hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 min-w-[210px]">Banco / Entidad (Identif. Color)</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Concepto / Comisión / Débito</th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">
                      <span className="block">Monto $</span>
                      <span className="text-[9px] text-cyan-400 font-normal">Editable</span>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[110px]">Fecha</th>
                    <th className="py-2.5 px-3 text-center min-w-[130px]">Referencia</th>
                    <th className="py-2.5 px-3 text-center min-w-[100px]">Estado</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Comentarios</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433] font-mono">
                  {filteredBankExpenses.map((bankItem) => {
                    const originalIdx = (sheetsData.bankExpenses || []).findIndex((b) => b.id === bankItem.id);
                    const bTheme = getBankColorTheme(bankItem.bank);
                    return (
                      <tr key={bankItem.id} className="hover:bg-[#161b26]/70 transition-colors group">
                        {/* Banco con identificación visual por color */}
                        <td className="py-2 px-3 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${bTheme.badgeBg} ${bTheme.badgeText} ${bTheme.badgeBorder}`}
                              title={bTheme.name}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${bTheme.dotColor}`} />
                              <span className="truncate max-w-[70px]">{bTheme.name.replace('Banco ', '')}</span>
                            </span>
                            <input
                              type="text"
                              value={bankItem.bank}
                              onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'bank', e.target.value)}
                              className={`w-full bg-[#161c28] border border-transparent rounded-lg px-2 py-1 text-xs font-bold focus:outline-none transition-colors ${bTheme.inputColor}`}
                            />
                          </div>
                        </td>

                        {/* Concepto */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={bankItem.concept}
                            onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'concept', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Monto */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={bankItem.amount}
                              onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'amount', e.target.value)}
                              className="w-full bg-[#161c28] border border-transparent focus:border-cyan-500 rounded-lg pl-5 pr-2 py-1 text-xs text-slate-200 text-right font-bold focus:outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Fecha */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="date"
                            value={bankItem.date || `${currentPeriod}-15`}
                            onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'date', e.target.value)}
                            className="bg-[#161c28] border border-transparent focus:border-cyan-500 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Referencia */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="text"
                            value={bankItem.reference || ''}
                            onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'reference', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-cyan-500 rounded-lg px-2 py-1 text-[11px] text-slate-400 text-center focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleBankExpenseFieldChange(originalIdx, 'status', bankItem.status === 'PAGO' ? 'IMPAGO' : 'PAGO')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                              bankItem.status === 'PAGO'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                            }`}
                          >
                            {bankItem.status}
                          </button>
                        </td>

                        {/* Comentarios */}
                        <td className="py-2 px-3 font-sans">
                          <input
                            type="text"
                            value={bankItem.comment || ''}
                            onChange={(e) => handleBankExpenseFieldChange(originalIdx, 'comment', e.target.value)}
                            className="w-full bg-[#161c28] border border-transparent focus:border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-slate-400 focus:outline-none transition-colors"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDeleteBankExpenseRow(originalIdx)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Eliminar débito bancario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals Row */}
                <tfoot>
                  <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                    <td colSpan={2} className="py-3 px-3 text-white uppercase font-sans">
                      TOTAL DÉBITOS BANCARIOS ({filteredBankExpenses.length} movimientos)
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-400 text-sm">
                      {formatCurrencyARS(filteredBankExpenses.reduce((acc, b) => acc + b.amount, 0))}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 5: RENTABILIDAD POR CLIENTE */}
      {/* ============================================================== */}
      {activeSheetTab === 'rentabilidad' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Planilla Analítica: Rentabilidad por Cliente (Números Reales por Servicio)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cálculo basado en <strong>números reales</strong>: Facturación neta por contrato menos costo directo real de los colaboradores asignados a cada objetivo y absorción proporcional de costos societarios.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportProfitabilityToCSV(filteredProfitability, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV (Filtrado)</span>
                </button>

                <button
                  onClick={() => exportProfitabilityToPDF(filteredProfitability, currentPeriod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  <span>Exportar PDF (Filtrado)</span>
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="p-3 bg-[#0f131c] rounded-xl border border-[#1e2638] mb-3">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente en el análisis de rentabilidad..."
                  value={profitabilitySearch}
                  onChange={(e) => setProfitabilitySearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 min-w-[200px]">Cliente / Servicio</th>
                    <th className="py-2.5 px-3 min-w-[170px] text-center">Colaboradores Asignados</th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">Facturación Neta</th>
                    <th className="py-2.5 px-3 text-right min-w-[140px]">
                      <span className="block text-amber-300">Costo Directo Real</span>
                      <span className="text-[9px] text-amber-400 font-normal">fx: Sueldos Asignados</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[135px]">
                      <span className="block text-blue-300">Margen Bruto Real</span>
                      <span className="text-[9px] text-blue-400 font-normal">fx: Fact. - Costo Dir.</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">
                      <span className="block text-slate-300">Fijos / Indirectos</span>
                      <span className="text-[9px] text-slate-400 font-normal">Prorrateo</span>
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[150px]">Margen Neto Real (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433] font-mono">
                  {filteredProfitability.map((item) => (
                    <tr key={item.clientName} className="hover:bg-[#161b26]/70 transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        {item.clientName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {item.assignedEmployeesCount && item.assignedEmployeesCount > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-300 text-[10px] font-bold">
                              👤 {item.assignedEmployeesCount} vigilador{item.assignedEmployeesCount === 1 ? '' : 'es'}
                            </span>
                            {item.assignedEmployeeNames && item.assignedEmployeeNames.length > 0 && (
                              <span className="text-[9px] text-slate-400 truncate max-w-[160px] mt-0.5" title={item.assignedEmployeeNames.join(', ')}>
                                {item.assignedEmployeeNames.join(', ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">
                            Sin vigilador asignado
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {formatCurrencyARS(item.netBilling)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300 font-semibold">
                        {formatCurrencyARS(item.directCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-blue-300 font-semibold">
                        <span>{formatCurrencyARS(item.grossMargin)}</span>
                        <span className="block text-[10px] text-blue-400/80">({item.grossMarginPercent ?? 0}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        {formatCurrencyARS(item.allocatedFixedCost || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            item.netMargin >= 0
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'bg-red-950 text-red-300 border border-red-800/60'
                          }`}
                        >
                          {formatCurrencyARS(item.netMargin)} ({item.netMarginPercent}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-[#151a26] border-t-2 border-[#263148] font-mono font-bold text-xs">
                    <td className="py-3 px-3 text-white uppercase font-sans">
                      TOTALES CONSOLIDADOS ({filteredProfitability.length})
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400 font-sans text-[11px]">
                      {filteredProfitability.reduce((a, b) => a + (b.assignedEmployeesCount || 0), 0)} asignados
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {formatCurrencyARS(filteredProfitability.reduce((a, b) => a + b.netBilling, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-300">
                      {formatCurrencyARS(filteredProfitability.reduce((a, b) => a + b.directCost, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-blue-300">
                      {formatCurrencyARS(filteredProfitability.reduce((a, b) => a + b.grossMargin, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {formatCurrencyARS(filteredProfitability.reduce((a, b) => a + (b.allocatedFixedCost || 0), 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      {formatCurrencyARS(filteredProfitability.reduce((a, b) => a + b.netMargin, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 6: ALERTAS DE COBRANZA */}
      {/* ============================================================== */}
      {activeSheetTab === 'alertas' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Alertas de Cobranza: Facturas con Estado "IMPAGO"</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitoreo de créditos a cobrar y seguimiento de cobranzas con clientes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportClientsToPDF(unpaidInvoices, currentPeriod, `INVICT_Alertas_Cobranza_${currentPeriod}.pdf`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-200 font-bold text-xs border border-red-800/60 shadow transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Exportar Alertas a PDF</span>
                </button>
              </div>
            </div>

            {unpaidInvoices.length === 0 ? (
              <div className="p-8 text-center bg-[#151923] rounded-2xl border border-[#232b3d] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">¡No hay facturas impagas registradas!</h4>
                <p className="text-xs text-slate-400">Todos los clientes se encuentran al día con sus abonos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b151b] border-b border-red-900/40 text-red-300 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3 text-center">N° Factura</th>
                      <th className="py-2.5 px-3 text-center">Fecha Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Monto Neto a Cobrar</th>
                      <th className="py-2.5 px-3 text-center">Acción Cobranza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a1e26] font-mono">
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-red-950/20 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-bold text-white flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{inv.clientName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-300">
                          {inv.invoiceNumber || 'FAC-0001-PEND'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-red-300 font-semibold">
                          {inv.dueDate || `${currentPeriod}-20`}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold text-sm">
                          {formatCurrencyARS(inv.totalNet)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              const idx = sheetsData.clientBilling.findIndex((c) => c.id === inv.id);
                              if (idx !== -1) {
                                handleClientFieldChange(idx, 'status', 'PAGO');
                                if (onNotify) onNotify(`¡Cobranza de "${inv.clientName}" registrada como PAGADA!`);
                              }
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Marcar como Cobrado
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-[#1b151b] border-t-2 border-red-900/60 font-mono font-bold text-xs text-red-200">
                      <td colSpan={3} className="py-3 px-3 uppercase font-sans">
                        TOTAL DEUDAS PENDIENTES DE COBRO ({unpaidInvoices.length} facturas)
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-300 text-sm">
                        {formatCurrencyARS(totalUnpaidAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SHEET 7: RESUMEN GENERAL CONSOLIDADOS */}
      {/* ============================================================== */}
      {activeSheetTab === 'resumen' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: General Summary Table */}
            <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Resumen General de Rubros Financieros</span>
              </h3>

              <div className="space-y-2.5 font-mono text-xs">
                {generalSummary.map((item, idx) => (
                  <div
                    key={item.concept}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === generalSummary.length - 1
                        ? 'bg-emerald-950/40 border-emerald-700/60 font-bold text-emerald-300'
                        : 'bg-[#151923] border-[#22293a] text-slate-300'
                    }`}
                  >
                    <span className="font-sans font-semibold">{item.concept}</span>
                    <span className="text-sm font-bold">{formatCurrencyARS(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Cost Distribution Percentage */}
            <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-400" />
                  <span>Distribución de Costos & Gastos</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Desglose porcentual del egreso operativo sobre el total de costos ($ {formatCurrencyARS(totalAllCosts)}).
                </p>

                <div className="space-y-3 font-mono text-xs">
                  {costDistribution.map((cd) => (
                    <div key={cd.category} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-sans font-semibold">{cd.category}</span>
                        <span className="text-white font-bold">
                          {formatCurrencyARS(cd.amount)} ({cd.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#1b2230] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, cd.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1e2538] flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">Margen Neto Libre Calculado:</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {globalNetMarginPercent}% ({formatCurrencyARS(globalNetMargin)})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CONFIRMACIÓN REINICIAR A CERO */}
      {/* ============================================================== */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#121620] border border-amber-600/50 rounded-3xl p-6 shadow-2xl text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6 animate-spin-reverse" />
            </div>
            <h3 className="text-base font-bold text-white">
              ¿Reiniciar Planillas a Cero (0)?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta acción restablecerá a <strong>$0</strong> todos los montos de facturación, sueldos, anticipos, gastos fijos y bancarios para el período <strong>{currentPeriod}</strong>, permitiendo comenzar la carga financiera completamente en blanco.
            </p>
            <p className="text-[11px] text-slate-400">
              Se conservarán los nombres de los clientes y la nómina de colaboradores para que puedas ingresar los números directamente.
            </p>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#1e2538] hover:bg-[#28324a] text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResetToZero}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition-all cursor-pointer"
              >
                Sí, Reiniciar a Cero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: COPIAR TABLAS EN TEXTO PLANO (EXCEL) */}
      {/* ============================================================== */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-3xl bg-[#111520] border border-[#2b3752] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-[#171d2b] to-[#121622] border-b border-[#252f44] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Tablas de Excel en Texto Plano (Listo para Copiar)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Formato de columnas estructuradas para pegar directamente en Excel o Google Sheets.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-3 py-1.5 rounded-xl bg-[#202738] hover:bg-[#2a3449] text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Vista previa de las planillas generadas:
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(plainTextPreview);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado con éxito!' : 'Copiar Texto al Portapapeles'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-[#090c12] border border-[#1e2538] text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px]">
                {plainTextPreview}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CARGAR ANTICIPO A EMPLEADO */}
      {/* ============================================================== */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#121620] border border-[#2b3752] rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#171d2c] border-b border-[#252f44] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Cargar Anticipo a Personal</span>
              </h3>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveAdvanceModal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Colaborador / Empleado:</label>
                <select
                  value={targetEmployee || sheetsData.salaries[0]?.fullName}
                  onChange={(e) => setTargetEmployee(e.target.value)}
                  className="w-full px-3 py-2 bg-[#171c26] border border-[#2c3850] rounded-xl text-white font-semibold cursor-pointer"
                >
                  {sheetsData.salaries.map((s) => (
                    <option key={s.id} value={s.fullName}>
                      {s.fullName} ({s.objectiveOrRole})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Monto de Anticipo ($ ARS):</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={advanceAmountInput}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  placeholder="ej: 50000"
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  El monto ingresado se actualizará inmediatamente en la planilla de Sueldos y descontará automáticamente del neto a cobrar.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow transition-all cursor-pointer"
                >
                  Guardar Anticipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: REGISTRAR NUEVO COLABORADOR (AUTO-SORT A-Z) */}
      {/* ============================================================== */}
      {isAddCollaboratorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg bg-[#121620] border border-[#2b3752] rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#171d2c] border-b border-[#252f44] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>Registrar Nuevo Colaborador</span>
              </h3>
              <button
                onClick={() => setIsAddCollaboratorModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Cancelar
              </button>
            </div>

            <form onSubmit={handleConfirmAddCollaborator} className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Al registrar al colaborador, el sistema lo <strong>ordenará automáticamente por abecedario (A-Z)</strong> dentro de la nómina y computará su costo directo sobre el cliente asignado para la rentabilidad real.
              </p>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Apellido y Nombre:
                </label>
                <input
                  type="text"
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  placeholder="ej: Gomez, Martin o Alvarez, Lucas"
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Servicio / Cliente Asignado:
                </label>
                <select
                  value={newCollabClientId}
                  onChange={(e) => setNewCollabClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="general" className="bg-[#121620] text-slate-300">
                    🏛️ Supervisión / Base General (Costo indirecto)
                  </option>
                  {sheetsData.clientBilling.map((cl) => (
                    <option key={cl.id} value={cl.id} className="bg-[#121620] text-white">
                      🏢 {cl.clientName}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  El sueldo neto de este colaborador se imputará automáticamente como costo directo al cliente seleccionado.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Objetivo / Función Operativa:
                </label>
                <input
                  type="text"
                  value={newCollabRole}
                  onChange={(e) => setNewCollabRole(e.target.value)}
                  placeholder="ej: Vigilador General - Puesto Nocturno"
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sky-300 font-bold mb-1.5">
                    Recibo ($ en blanco):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newCollabRecibo}
                    onChange={(e) => setNewCollabRecibo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-sky-200 font-mono text-sm font-bold focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-bold mb-1.5">
                    X ($ fuera de bono):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newCollabExtra}
                    onChange={(e) => setNewCollabExtra(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-purple-200 font-mono text-sm font-bold focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Estado de Pago Inicial:</label>
                <select
                  value={newCollabStatus}
                  onChange={(e) => setNewCollabStatus(e.target.value as 'PENDIENTE' | 'PAGO')}
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="PENDIENTE" className="bg-[#121620]">⏳ PENDIENTE</option>
                  <option value="PAGO" className="bg-[#121620]">✅ PAGO</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCollaboratorModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#BE2629] hover:bg-[#a52023] text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar y Ordenar A-Z</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: INICIAR NUEVO MES */}
      {/* ============================================================== */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#121620] border border-[#2b3752] rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#171d2c] border-b border-[#252f44] flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-400" />
                <span>Iniciar Nuevo Mes</span>
              </h3>
              <button
                onClick={() => setIsNewMonthModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleStartNewMonthSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Esta acción cerrará el mes actual (<strong>{currentPeriod}</strong>) y creará una nueva planilla en blanco para el período seleccionado, conservando los rubros de gastos fijos y la nómina de colaboradores.
              </p>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Nuevo Período (AAAA-MM):</label>
                <input
                  type="text"
                  value={nextPeriodInput}
                  onChange={(e) => setNextPeriodInput(e.target.value)}
                  placeholder="ej: 2026-11"
                  className="w-full px-3.5 py-2.5 bg-[#171c26] border border-[#2c3850] rounded-xl text-white font-mono text-sm font-bold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewMonthModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow transition-all cursor-pointer"
                >
                  Iniciar Mes en Blanco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
