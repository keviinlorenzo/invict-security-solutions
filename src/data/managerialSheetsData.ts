// Managerial Sheets & Financial Module for INVICT SECURITY SOLUTIONS S.A.
// Strict security: Access restricted to GERENCIA (Yamila, Laura, Domingo)
import * as XLSX from 'xlsx';
import { getCurrentPeriodString } from '../utils/dateUtils';
import { broadcastCloudChange } from '../utils/cloudSyncService';

export interface FixedExpenseItem {
  id: string;
  category: string;
  concept: string;
  amount: number;
  subtotal?: number;
  vatRate?: number;
  vatAmount?: number;
  withholdings?: number;
  status: 'PAGO' | 'IMPAGO';
  comment: string;
  updatedAt?: number;
}

export interface BankExpenseItem {
  id: string;
  bank: string; // e.g. "Banco Galicia", "Banco Macro", "Banco Santander", "Banco Nación", "BBVA", "Otro"
  concept: string; // e.g. "Impuesto Ley 25.413 Débito/Crédito", "Comisión Mantenimiento", etc.
  amount: number;
  date?: string;
  reference?: string;
  status: 'PAGO' | 'IMPAGO';
  comment?: string;
  updatedAt?: number;
}

export interface EmployeeSalaryItem {
  id: string;
  index: number;
  fullName: string;
  objectiveOrRole: string;
  assignedClientId?: string; // ID del cliente asignado en ClientBillingItem (ej: "cl-1", "cl-2") o "general"
  assignedClientName?: string; // Nombre del servicio / cliente asignado
  receiptAmount?: number; // Monto que cobra por RECIBO (en blanco)
  extraAmount?: number;   // Monto que cobra en X (por fuera del bono)
  netSalary: number;      // SUELDO NETO = Recibo + X
  advance: number;
  receipt?: string;
  status: 'PAGO' | 'PENDIENTE';
  updatedAt?: number;
}

/**
 * Ordena la lista de colaboradores estrictamente en orden alfabético (A-Z)
 * por su Apellido y Nombre, reasignando correlativamente los índices # 1..N.
 */
export function sortSalariesAlphabetically(salaries: EmployeeSalaryItem[]): EmployeeSalaryItem[] {
  return [...salaries]
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'es', { sensitivity: 'base' }))
    .map((s, idx) => ({ ...s, index: idx + 1 }));
}

export interface ClientBillingItem {
  id: string;
  clientName: string;
  hourlyRate: number;
  totalHours: number;
  totalHoursInput?: string;  // Permite formato HHH:MM (ej: "271:38" o "271:38hs")
  includesVat?: boolean;
  vatAmount: number;
  withholdings: number;
  totalNet: number;
  status: 'PAGO' | 'IMPAGO';
  dueDate?: string;
  invoiceNumber?: string;
  updatedAt?: number;
}

// Parsea horas en formato reloj (ej: "271:38", "271:38hs", "271h 38m") o número a horas decimales exactas
export function parseFlexibleHours(rawInput: string | number | undefined): {
  decimalHours: number;
  hoursPart: number;
  minutesPart: number;
  isTimeFormat: boolean;
  formattedLabel: string;
} {
  if (rawInput === undefined || rawInput === null || rawInput === '') {
    return { decimalHours: 0, hoursPart: 0, minutesPart: 0, isTimeFormat: false, formattedLabel: '0 hs' };
  }
  if (typeof rawInput === 'number') {
    const safe = Math.max(0, rawInput);
    const h = Math.floor(safe);
    const m = Math.round((safe - h) * 60);
    return {
      decimalHours: safe,
      hoursPart: h,
      minutesPart: m,
      isTimeFormat: m > 0,
      formattedLabel: m > 0 ? `${h}:${String(m).padStart(2, '0')} hs` : `${h} hs`,
    };
  }

  const str = String(rawInput).trim().toLowerCase();
  // Detectar formato HHH:MM o HHH:MMhs o HHHh MMm
  if (str.includes(':')) {
    const cleaned = str.replace(/[^\d:]/g, '');
    const parts = cleaned.split(':');
    const h = Math.max(0, parseInt(parts[0] || '0', 10) || 0);
    const m = Math.max(0, parseInt(parts[1] || '0', 10) || 0);
    const s = parts[2] ? Math.max(0, parseInt(parts[2], 10) || 0) : 0;
    const dec = h + m / 60 + s / 3600;
    return {
      decimalHours: dec,
      hoursPart: h,
      minutesPart: m,
      isTimeFormat: true,
      formattedLabel: `${h}:${String(m).padStart(2, '0')} hs`,
    };
  }

  const hmMatch = str.match(/^(\d+)\s*(?:hs|h|\s)\s*(\d+)/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10) || 0;
    const m = parseInt(hmMatch[2], 10) || 0;
    const dec = h + m / 60;
    return {
      decimalHours: dec,
      hoursPart: h,
      minutesPart: m,
      isTimeFormat: true,
      formattedLabel: `${h}:${String(m).padStart(2, '0')} hs`,
    };
  }

  const numericStr = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = Math.max(0, parseFloat(numericStr) || 0);
  const h = Math.floor(parsed);
  const m = Math.round((parsed - h) * 60);
  return {
    decimalHours: parsed,
    hoursPart: h,
    minutesPart: m,
    isTimeFormat: m > 0,
    formattedLabel: m > 0 ? `${h}:${String(m).padStart(2, '0')} hs` : `${h} hs`,
  };
}

export interface ClientProfitabilityItem {
  clientName: string;
  clientId?: string;
  netBilling: number;
  directCost: number;
  grossMargin: number;
  grossMarginPercent?: number;
  allocatedFixedCost?: number;
  netMargin: number;
  netMarginPercent: number;
  assignedEmployeesCount?: number;
  assignedEmployeeNames?: string[];
}

export interface GeneralSummaryItem {
  concept: string;
  amount: number;
  percentage?: number;
  notes?: string;
}

export interface ManagerialMonthData {
  period: string; // '2026-10'
  isClosed: boolean;
  fixedExpenses: FixedExpenseItem[];
  bankExpenses: BankExpenseItem[];
  salaries: EmployeeSalaryItem[];
  clientBilling: ClientBillingItem[];
  updatedAt?: number;
  resetAt?: number;
  deletedItemIds?: string[];
}

const STORAGE_PREFIX = 'invict_managerial_sheets_';

// Initial default seed for 2026-10
const INITIAL_OCTOBER_DATA: ManagerialMonthData = {
  period: '2026-10',
  isClosed: false,
  fixedExpenses: [
    {
      id: 'fx-1',
      category: 'Inmueble',
      concept: 'Alquiler Sede Central de Oficina',
      amount: 450000,
      status: 'PAGO',
      comment: 'Inmobiliaria Cuyo - Pagado día 05',
    },
    {
      id: 'fx-2',
      category: 'Conectividad',
      concept: 'Internet Fibra Óptica & Enlace IP',
      amount: 68000,
      status: 'PAGO',
      comment: 'Débito automático corporativo',
    },
    {
      id: 'fx-3',
      category: 'Seguros',
      concept: 'Seguro Integral RC & Accidentes Vigilancia',
      amount: 195000,
      status: 'PAGO',
      comment: 'Póliza La Segunda Vto. Mensual',
    },
    {
      id: 'fx-4',
      category: 'Monitoreo',
      concept: 'Servidores de Cámaras & Alarmas Base',
      amount: 85000,
      status: 'PAGO',
      comment: 'Abono tecnológico central',
    },
    {
      id: 'fx-5',
      category: 'Societario',
      concept: 'Retiros Directorio',
      amount: 800000,
      status: 'PAGO',
      comment: 'Asignación societaria C-Level',
    },
    {
      id: 'fx-6',
      category: 'Regulatorio',
      concept: 'Cuota Canon Habilitación REPRIV',
      amount: 120000,
      status: 'IMPAGO',
      comment: 'Pendiente de presentación de timbrado ministerial',
    },
    {
      id: 'fx-7',
      category: 'Contable',
      concept: 'Honorarios Asesoría Contable & Tributaria',
      amount: 140000,
      status: 'PAGO',
      comment: 'Liquidación 931 y DDJJ',
    },
  ],
  bankExpenses: [
    {
      id: 'bnk-1',
      bank: 'Banco Galicia',
      concept: 'Impuesto Ley 25.413 Débitos/Créditos Bancarios',
      amount: 78500,
      date: '2026-10-06',
      reference: 'DEB-IMP-00214',
      status: 'PAGO',
      comment: 'Débito fiscal por movimientos de cuenta corriente',
    },
    {
      id: 'bnk-2',
      bank: 'Banco Galicia',
      concept: 'Comisión Mantenimiento Cuenta Corriente Especial',
      amount: 34000,
      date: '2026-10-10',
      reference: 'COM-MANT-8821',
      status: 'PAGO',
      comment: 'Paquete Corporativo Sucursal Mendoza',
    },
    {
      id: 'bnk-3',
      bank: 'Banco Macro',
      concept: 'Comisión Transferencias Masivas Datanet (Haberes)',
      amount: 28000,
      date: '2026-10-12',
      reference: 'DTN-HAB-4412',
      status: 'PAGO',
      comment: 'Acreditación sueldos colaboradores de vigilancia',
    },
    {
      id: 'bnk-4',
      bank: 'Banco Santander',
      concept: 'Retenciones Bancarias SIRCREB Mendoza',
      amount: 52400,
      date: '2026-10-15',
      reference: 'RET-SIR-9011',
      status: 'PAGO',
      comment: 'Retención ATM Rentas Mendoza',
    },
    {
      id: 'bnk-5',
      bank: 'Banco Nación',
      concept: 'Comisión Cuenta Recaudadora Clientes',
      amount: 19500,
      date: '2026-10-18',
      reference: 'REC-BNA-1200',
      status: 'IMPAGO',
      comment: 'Pendiente de débito en compensación',
    },
  ],
  salaries: [
    {
      id: 'sal-1',
      index: 1,
      fullName: 'Aguero, Luciano',
      objectiveOrRole: 'Vigilador General - Bodegas Luján',
      assignedClientId: 'cl-2',
      assignedClientName: 'Bodegas Luján de Cuyo',
      receiptAmount: 400000,
      extraAmount: 110000,
      netSalary: 510000,
      advance: 50000,
      status: 'PAGO',
    },
    {
      id: 'sal-5',
      index: 2,
      fullName: 'Benitez, Marcos',
      objectiveOrRole: 'Supervisor de Servicios - Base Central',
      assignedClientId: 'general',
      assignedClientName: 'Supervisión / Base General',
      receiptAmount: 540000,
      extraAmount: 180000,
      netSalary: 720000,
      advance: 60000,
      status: 'PAGO',
    },
    {
      id: 'sal-4',
      index: 3,
      fullName: 'Fernandez, Claudio',
      objectiveOrRole: 'Vigilador - Fuesmen Maipú',
      assignedClientId: 'cl-3',
      assignedClientName: 'Fuesmen Sede Central',
      receiptAmount: 430000,
      extraAmount: 135000,
      netSalary: 565000,
      advance: 0,
      status: 'PAGO',
    },
    {
      id: 'sal-3',
      index: 4,
      fullName: 'Gomez, Roberto',
      objectiveOrRole: 'Custodia Móvil - Ronda Nocturna',
      assignedClientId: 'general',
      assignedClientName: 'Móvil / Ronda Central',
      receiptAmount: 465000,
      extraAmount: 150000,
      netSalary: 615000,
      advance: 40000,
      status: 'PAGO',
    },
    {
      id: 'sal-2',
      index: 5,
      fullName: 'Morales, Cristian',
      objectiveOrRole: 'Vigilador Principal - Kraft San Martín',
      assignedClientId: 'cl-1',
      assignedClientName: 'Kraft San Martín S.A.',
      receiptAmount: 450000,
      extraAmount: 140000,
      netSalary: 590000,
      advance: 0,
      status: 'PAGO',
    },
    {
      id: 'sal-7',
      index: 6,
      fullName: 'Perez, Marcelo',
      objectiveOrRole: 'Vigilador Operativo - Logística Cuyo S.A.',
      assignedClientId: 'cl-5',
      assignedClientName: 'Logística Cuyo S.A.',
      receiptAmount: 440000,
      extraAmount: 134000,
      netSalary: 574000,
      advance: 35000,
      status: 'PAGO',
    },
    {
      id: 'sal-6',
      index: 7,
      fullName: 'Rodriguez, Walter',
      objectiveOrRole: 'Vigilador Control Acceso - Parque Ind. Godoy Cruz',
      assignedClientId: 'cl-4',
      assignedClientName: 'Parque Industrial Godoy Cruz',
      receiptAmount: 420000,
      extraAmount: 137000,
      netSalary: 557000,
      advance: 0,
      status: 'PENDIENTE',
    },
  ],
  clientBilling: [
    {
      id: 'cl-1',
      clientName: 'Kraft San Martín S.A.',
      hourlyRate: 5200,
      totalHours: 1440,
      vatAmount: 1572480, // 21%
      withholdings: 299520, // Retenciones IIBB / Ganancias ~4%
      totalNet: 8760960,
      status: 'PAGO',
      invoiceNumber: 'FAC-0001-00004521',
      dueDate: '2026-10-15',
    },
    {
      id: 'cl-2',
      clientName: 'Bodegas Luján de Cuyo',
      hourlyRate: 4900,
      totalHours: 720,
      vatAmount: 740880,
      withholdings: 141120,
      totalNet: 4127760,
      status: 'PAGO',
      invoiceNumber: 'FAC-0001-00004522',
      dueDate: '2026-10-20',
    },
    {
      id: 'cl-3',
      clientName: 'Fuesmen Sede Maipú',
      hourlyRate: 4800,
      totalHours: 720,
      vatAmount: 725760,
      withholdings: 138240,
      totalNet: 4043520,
      status: 'IMPAGO', // ALERTA DE COBRANZA
      invoiceNumber: 'FAC-0001-00004523',
      dueDate: '2026-10-10',
    },
    {
      id: 'cl-4',
      clientName: 'Parque Industrial Godoy Cruz',
      hourlyRate: 4700,
      totalHours: 720,
      vatAmount: 710640,
      withholdings: 135360,
      totalNet: 3959280,
      status: 'IMPAGO', // ALERTA DE COBRANZA
      invoiceNumber: 'FAC-0001-00004524',
      dueDate: '2026-10-18',
    },
    {
      id: 'cl-5',
      clientName: 'Logística Cuyo Centro de Carga',
      hourlyRate: 4950,
      totalHours: 720,
      vatAmount: 748440,
      withholdings: 142560,
      totalNet: 4169880,
      status: 'PAGO',
      invoiceNumber: 'FAC-0001-00004525',
      dueDate: '2026-10-25',
    },
  ],
};

export function getManagerialMonthData(period: string = getCurrentPeriodString()): ManagerialMonthData {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${period}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backwards compatibility for bankExpenses
      if (!parsed.bankExpenses) {
        parsed.bankExpenses = INITIAL_OCTOBER_DATA.bankExpenses;
      }
      // Sincronizar fórmulas de Clientes Facturación con soporte de horas + minutos (ej: 271:38hs)
      if (Array.isArray(parsed.clientBilling)) {
        parsed.clientBilling = parsed.clientBilling.map((c: ClientBillingItem) => {
          const hInfo = parseFlexibleHours(
            c.totalHoursInput !== undefined ? c.totalHoursInput : c.totalHours
          );
          const hasVat = c.includesVat !== undefined ? c.includesVat : (c.vatAmount || 0) > 0;
          const formulas = computeClientBillingFormulas(
            c.hourlyRate || 0,
            hInfo.decimalHours,
            c.withholdings || 0,
            hasVat
          );
          return {
            ...c,
            totalHours: hInfo.decimalHours,
            includesVat: hasVat,
            vatAmount: formulas.vatAmount,
            totalNet: formulas.totalNet,
          };
        });
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading managerial data from storage:', err);
  }

  // Fallback to initial seed if matching October 2026
  if (period === '2026-10') {
    return INITIAL_OCTOBER_DATA;
  }

  // Blank template for other new months
  return {
    period,
    isClosed: false,
    fixedExpenses: INITIAL_OCTOBER_DATA.fixedExpenses.map((f, i) => ({
      ...f,
      id: `fx-${period}-${i + 1}`,
      status: 'IMPAGO',
    })),
    bankExpenses: INITIAL_OCTOBER_DATA.bankExpenses.map((b, i) => ({
      ...b,
      id: `bnk-${period}-${i + 1}`,
      status: 'IMPAGO',
    })),
    salaries: INITIAL_OCTOBER_DATA.salaries.map((s, i) => ({
      ...s,
      id: `sal-${period}-${i + 1}`,
      advance: 0,
      status: 'PENDIENTE',
      receipt: `REC-${period.replace('-', '')}-${1000 + i + 1}`,
    })),
    clientBilling: INITIAL_OCTOBER_DATA.clientBilling.map((c, i) => ({
      ...c,
      id: `cl-${period}-${i + 1}`,
      status: 'IMPAGO',
      invoiceNumber: `FAC-0001-${period.replace('-', '')}${10 + i}`,
    })),
  };
}

export function mergeManagerialMonthData(
  localData: ManagerialMonthData | undefined | null,
  remoteData: ManagerialMonthData | undefined | null
): ManagerialMonthData {
  if (!localData && !remoteData) {
    return getManagerialMonthData();
  }
  if (!localData) return remoteData as ManagerialMonthData;
  if (!remoteData) return localData;

  const localReset = Number(localData.resetAt || 0);
  const remoteReset = Number(remoteData.resetAt || 0);
  if (localReset > remoteReset && (localData.updatedAt || 0) >= (remoteData.updatedAt || 0)) {
    return localData;
  }
  if (remoteReset > localReset && (remoteData.updatedAt || 0) >= (localData.updatedAt || 0)) {
    return remoteData;
  }

  const deletedSet = new Set<string>([
    ...(Array.isArray(localData.deletedItemIds) ? localData.deletedItemIds : []),
    ...(Array.isArray(remoteData.deletedItemIds) ? remoteData.deletedItemIds : []),
  ]);

  const mergeList = <T extends { id: string; status?: string; updatedAt?: number; advance?: number }>(
    localList: T[] = [],
    remoteList: T[] = []
  ): T[] => {
    const safeLocal = Array.isArray(localList) ? localList : [];
    const safeRemote = Array.isArray(remoteList) ? remoteList : [];
    const map = new Map<string, T>();
    const order: string[] = [];

    for (const r of safeRemote) {
      if (!r || !r.id || deletedSet.has(r.id)) continue;
      map.set(r.id, r);
      order.push(r.id);
    }

    for (const l of safeLocal) {
      if (!l || !l.id || deletedSet.has(l.id)) continue;
      const r = map.get(l.id);
      if (!r) {
        map.set(l.id, l);
        order.push(l.id);
      } else {
        const lTs = Number(l.updatedAt || 0);
        const rTs = Number(r.updatedAt || 0);
        if (lTs > 0 || rTs > 0) {
          if (lTs > rTs) {
            map.set(l.id, l);
          } else if (rTs > lTs) {
            map.set(l.id, r);
          } else {
            // Mismo timestamp: preservar PAGO si alguno está en PAGO
            const chosen = (localData.updatedAt || 0) >= (remoteData.updatedAt || 0) ? { ...l } : { ...r };
            if (l.status === 'PAGO' || r.status === 'PAGO') {
              (chosen as any).status = 'PAGO';
            }
            map.set(l.id, chosen);
          }
        } else {
          // Ninguna fila tenía updatedAt individual: proteger PAGO y anticipos mayores frente a pestañas viejas en caché
          const base = (localData.updatedAt || 0) > (remoteData.updatedAt || 0) ? { ...l } : { ...r };
          if (l.status === 'PAGO' || r.status === 'PAGO') {
            (base as any).status = 'PAGO';
          }
          if (typeof l.advance === 'number' && typeof r.advance === 'number') {
            (base as any).advance = Math.max(l.advance, r.advance);
          }
          map.set(l.id, base);
        }
      }
    }

    return order.map(id => map.get(id)!).filter(Boolean);
  };

  const mergedSalaries = sortSalariesAlphabetically(
    mergeList(localData.salaries, remoteData.salaries)
  );
  const mergedFixed = mergeList(localData.fixedExpenses, remoteData.fixedExpenses);
  const mergedBank = mergeList(localData.bankExpenses, remoteData.bankExpenses);
  const mergedClients = mergeList(localData.clientBilling, remoteData.clientBilling);

  const newerBase =
    (localData.updatedAt || 0) >= (remoteData.updatedAt || 0) ? localData : remoteData;

  return {
    ...newerBase,
    period: remoteData.period || localData.period,
    isClosed: Boolean(localData.isClosed || remoteData.isClosed),
    salaries: mergedSalaries,
    fixedExpenses: mergedFixed,
    bankExpenses: mergedBank,
    clientBilling: mergedClients,
    updatedAt: Math.max(Number(localData.updatedAt || 0), Number(remoteData.updatedAt || 0), Date.now()),
    resetAt: Math.max(localReset, remoteReset) || undefined,
    deletedItemIds: Array.from(deletedSet),
  };
}

export function saveManagerialMonthData(period: string, data: ManagerialMonthData): void {
  try {
    const stampedData: ManagerialMonthData = {
      ...data,
      updatedAt: Date.now(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${period}`, JSON.stringify(stampedData));
    broadcastCloudChange(
      'SHEET_MUTATION',
      `Actualización en planilla gerencial (${period})`,
      { name: 'Gerencia General', profile: 'GERENTE', email: 'consultasinvictsolutionss.a@gmail.com' },
      { period, data: stampedData }
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('invict_managerial_sheets_mutation', { detail: { period, data: stampedData } })
      );
    }
  } catch (err) {
    console.error('Error saving managerial data:', err);
  }
}

// Dynamic update of employee salary advance
export function updateSalaryAdvance(
  employeeName: string,
  advanceAmount: number,
  period: string = getCurrentPeriodString()
): { success: boolean; message: string; updatedRow?: EmployeeSalaryItem } {
  const data = getManagerialMonthData(period);
  const normalizedTarget = employeeName.toLowerCase().trim();

  const foundIndex = data.salaries.findIndex(s => {
    const nameNorm = s.fullName.toLowerCase();
    const parts = normalizedTarget.split(' ');
    return parts.every(part => nameNorm.includes(part));
  });

  if (foundIndex === -1) {
    return {
      success: false,
      message: `No se encontró al colaborador "${employeeName}" en la planilla de sueldos de ${period}.`,
    };
  }

  const current = data.salaries[foundIndex];
  const updatedAdvance = advanceAmount;

  const updatedEmployee: EmployeeSalaryItem = {
    ...current,
    advance: updatedAdvance,
    status: current.netSalary <= updatedAdvance ? 'PAGO' : current.status,
    updatedAt: Date.now(),
  };

  data.salaries[foundIndex] = updatedEmployee;
  saveManagerialMonthData(period, data);

  return {
    success: true,
    message: `Se cargó correctamente el anticipo de $${advanceAmount.toLocaleString('es-AR')} a ${updatedEmployee.fullName} en la planilla de sueldos de ${period}.`,
    updatedRow: updatedEmployee,
  };
}

// Start a new month: closes previous and creates blank slate with recurring fixed structures
export function startNewMonth(fromPeriod: string, newPeriod: string): ManagerialMonthData {
  const oldData = getManagerialMonthData(fromPeriod);
  oldData.isClosed = true;
  saveManagerialMonthData(fromPeriod, oldData);

  const now = Date.now();
  const newData: ManagerialMonthData = {
    period: newPeriod,
    isClosed: false,
    updatedAt: now,
    fixedExpenses: oldData.fixedExpenses.map((f, i) => ({
      ...f,
      id: `fx-${newPeriod}-${i + 1}`,
      status: 'IMPAGO',
      updatedAt: now,
    })),
    bankExpenses: oldData.bankExpenses.map((b, i) => ({
      ...b,
      id: `bnk-${newPeriod}-${i + 1}`,
      status: 'IMPAGO',
      updatedAt: now,
    })),
    salaries: oldData.salaries.map((s, i) => ({
      ...s,
      id: `sal-${newPeriod}-${i + 1}`,
      advance: 0,
      status: 'PENDIENTE',
      receipt: `REC-${newPeriod.replace('-', '')}-${1000 + i + 1}`,
      updatedAt: now,
    })),
    clientBilling: oldData.clientBilling.map((c, i) => ({
      ...c,
      id: `cl-${newPeriod}-${i + 1}`,
      status: 'IMPAGO',
      invoiceNumber: `FAC-0001-${newPeriod.replace('-', '')}${10 + i}`,
      updatedAt: now,
    })),
  };

  saveManagerialMonthData(newPeriod, newData);
  return newData;
}

// Reset all values in the active period to 0 to start sheets fresh from zero
export function resetMonthDataToZero(period: string = getCurrentPeriodString()): ManagerialMonthData {
  const current = getManagerialMonthData(period);
  const now = Date.now();
  const zeroedData: ManagerialMonthData = {
    period,
    isClosed: false,
    updatedAt: now,
    resetAt: now,
    fixedExpenses: current.fixedExpenses.map(f => ({
      ...f,
      amount: 0,
      subtotal: 0,
      vatAmount: 0,
      withholdings: 0,
      status: 'IMPAGO',
      updatedAt: now,
    })),
    bankExpenses: (current.bankExpenses || []).map(b => ({
      ...b,
      amount: 0,
      status: 'IMPAGO',
      updatedAt: now,
    })),
    salaries: current.salaries.map(s => ({
      ...s,
      receiptAmount: 0,
      extraAmount: 0,
      netSalary: 0,
      advance: 0,
      status: 'PENDIENTE',
      updatedAt: now,
    })),
    clientBilling: current.clientBilling.map(c => ({
      ...c,
      hourlyRate: 0,
      totalHours: 0,
      totalHoursInput: '0',
      vatAmount: 0,
      withholdings: 0,
      totalNet: 0,
      status: 'IMPAGO',
      updatedAt: now,
    })),
  };

  saveManagerialMonthData(period, zeroedData);
  return zeroedData;
}

// Interactive formula calculation for Client Billing (Tarifa * Horas + IVA opcional 21% - Retenciones manuales)
export function computeClientBillingFormulas(
  hourlyRate: number,
  totalHours: number,
  customWithholdings?: number,
  includesVat: boolean = true
): {
  subtotal: number;
  vatAmount: number;
  withholdings: number;
  totalNet: number;
} {
  const subtotal = Math.round((hourlyRate || 0) * (totalHours || 0));
  const vatAmount = includesVat ? Math.round(subtotal * 0.21) : 0; // Formula: IVA 21% si aplica, 0 si no aplica
  const withholdings =
    customWithholdings !== undefined
      ? Math.max(0, Math.round(customWithholdings))
      : 0; // Retenciones cargadas manualmente
  const totalNet = Math.max(0, Math.round(subtotal + vatAmount - withholdings));
  return { subtotal, vatAmount, withholdings, totalNet };
}

// Interactive formula calculation for Salaries (Neto - Anticipo = Saldo a Cobrar)
export function computeSalaryFormulas(
  netSalary: number,
  advance: number
): {
  netSalary: number;
  netToCollect: number;
} {
  const safeNet = Math.max(0, netSalary || 0);
  const safeAdv = Math.max(0, advance || 0);
  const netToCollect = Math.max(0, safeNet - safeAdv);
  return { netSalary: safeNet, netToCollect };
}

// Interactive formula calculation for Fixed Expenses (Subtotal + IVA - Retenciones)
export function computeFixedExpenseFormulas(
  subtotal: number,
  vatRate: number = 21,
  withholdings: number = 0
): {
  subtotal: number;
  vatAmount: number;
  withholdings: number;
  totalNet: number;
} {
  const safeSubtotal = Math.max(0, subtotal || 0);
  const vatAmount = Math.round(safeSubtotal * ((vatRate !== undefined ? vatRate : 21) / 100));
  const safeWithholdings = Math.max(0, withholdings || 0);
  const totalNet = Math.max(0, safeSubtotal + vatAmount - safeWithholdings);
  return {
    subtotal: safeSubtotal,
    vatAmount,
    withholdings: safeWithholdings,
    totalNet,
  };
}

// Calculate Client Profitability (Rentabilidad por Cliente) based on real loaded data
// Vincula los colaboradores asignados específicamente a cada servicio / cliente
export function calculateClientProfitability(data: ManagerialMonthData): ClientProfitabilityItem[] {
  const salaries = data.salaries || [];
  const clientBilling = data.clientBilling || [];
  const fixedExpenses = data.fixedExpenses || [];
  const bankExpenses = data.bankExpenses || [];

  const totalBillingAll = clientBilling.reduce(
    (acc, c) => acc + (c.totalNet !== undefined ? c.totalNet : c.hourlyRate * c.totalHours),
    0
  );

  // Mapear colaboradores asignados por cliente
  const clientAssignedMap = new Map<string, { employees: EmployeeSalaryItem[]; directCost: number }>();
  for (const c of clientBilling) {
    clientAssignedMap.set(c.id, { employees: [], directCost: 0 });
  }

  const unassignedSalaries: EmployeeSalaryItem[] = [];

  for (const s of salaries) {
    const salaryCost = (s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0);

    // 1. Coincidencia por ID de cliente asignado
    let matchedClient = clientBilling.find(c => s.assignedClientId && c.id === s.assignedClientId);

    // 2. Coincidencia por nombre exacto de cliente asignado
    if (!matchedClient && s.assignedClientName) {
      const normName = s.assignedClientName.toLowerCase().trim();
      matchedClient = clientBilling.find(
        c => c.clientName.toLowerCase().trim() === normName || c.clientName.toLowerCase().includes(normName)
      );
    }

    // 3. Coincidencia inteligente por objetivo / función
    if (!matchedClient && s.objectiveOrRole) {
      const objLower = s.objectiveOrRole.toLowerCase();
      matchedClient = clientBilling.find(c => {
        const cLower = c.clientName.toLowerCase();
        const cleanName = cLower.replace(/s\.a\.|de cuyo|sede central|san mart[ií]n/g, '').trim();
        const words = cleanName.split(/\s+/).filter(w => w.length >= 4);
        return words.some(w => objLower.includes(w));
      });
    }

    if (matchedClient) {
      const entry = clientAssignedMap.get(matchedClient.id);
      if (entry) {
        entry.employees.push(s);
        entry.directCost += salaryCost;
      }
    } else {
      unassignedSalaries.push(s);
    }
  }

  // Costo de colaboradores generales (supervisores, base, rondas generales no asignados a un único cliente)
  const totalUnassignedSalariesCost = unassignedSalaries.reduce(
    (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
    0
  );

  // Gastos societarios generales a prorratear (gastos fijos + bancarios + personal de base/supervisión general)
  const realTotalOverhead =
    fixedExpenses.reduce((acc, f) => acc + (f.amount || 0), 0) +
    bankExpenses.reduce((acc, b) => acc + (b.amount || 0), 0) +
    totalUnassignedSalariesCost;

  return clientBilling.map(c => {
    const netBilling = c.totalNet !== undefined ? c.totalNet : c.hourlyRate * c.totalHours;
    const assignedInfo = clientAssignedMap.get(c.id);
    const directCost = assignedInfo ? assignedInfo.directCost : 0;
    const assignedEmployees = assignedInfo ? assignedInfo.employees : [];

    const grossMargin = netBilling - directCost;
    const grossMarginPercent = netBilling > 0 ? Math.round((grossMargin / netBilling) * 100) : 0;

    // Prorrateo proporcional de costos fijos e indirectos según volumen de facturación
    const share = totalBillingAll > 0 ? netBilling / totalBillingAll : 0;
    const allocatedFixedCost = Math.round(realTotalOverhead * share);
    const netMargin = grossMargin - allocatedFixedCost;
    const netMarginPercent = netBilling > 0 ? Math.round((netMargin / netBilling) * 100) : 0;

    return {
      clientName: c.clientName,
      clientId: c.id,
      netBilling,
      directCost,
      grossMargin,
      grossMarginPercent,
      allocatedFixedCost,
      netMargin,
      netMarginPercent,
      assignedEmployeesCount: assignedEmployees.length,
      assignedEmployeeNames: assignedEmployees.map(e => e.fullName),
    };
  });
}

// Compute Complete Managerial Metrics for Dashboard using real loaded data
export function calculateManagerialMetrics(
  period: string = getCurrentPeriodString(),
  customData?: ManagerialMonthData
) {
  const data = customData || getManagerialMonthData(period);
  const profitability = calculateClientProfitability(data);

  // Total Ingresos Reales (Suma exacta del Total Neto de los clientes cargados)
  const totalIncome = (data.clientBilling || []).reduce(
    (acc, c) => acc + (c.totalNet !== undefined ? c.totalNet : c.hourlyRate * c.totalHours),
    0
  );

  // Total Costos Directos Reales (Suma exacta de Sueldo Neto = Recibo + X de los colaboradores cargados)
  const salariesList = data.salaries || [];
  const countSalaries = salariesList.length;
  const totalDirectCosts = salariesList.reduce(
    (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
    0
  );

  // Desglose de Sueldos: Pendientes de Pago (Impagos) vs Pagados
  const unpaidSalaries = salariesList.filter(s => s.status === 'PENDIENTE');
  const unpaidSalariesCount = unpaidSalaries.length;
  const unpaidSalariesAmount = unpaidSalaries.reduce(
    (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
    0
  );
  const unpaidSalariesNetDisburse = unpaidSalaries.reduce(
    (acc, s) => acc + Math.max(0, ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)) - (s.advance || 0)),
    0
  );
  const paidSalaries = salariesList.filter(s => s.status === 'PAGO');
  const paidSalariesCount = paidSalaries.length;
  const paidSalariesAmount = paidSalaries.reduce(
    (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
    0
  );
  const totalAdvances = salariesList.reduce((acc, s) => acc + (s.advance || 0), 0);

  // Total Gastos Fijos Reales y desglose de Pagados vs Pendientes/Impagos
  const fixedExpensesList = data.fixedExpenses || [];
  const countFixedExpenses = fixedExpensesList.length;
  const totalFixedExpenses = fixedExpensesList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const unpaidFixed = fixedExpensesList.filter(f => f.status === 'IMPAGO');
  const unpaidFixedExpensesAmount = unpaidFixed.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const unpaidFixedExpensesCount = unpaidFixed.length;
  const paidFixed = fixedExpensesList.filter(f => f.status === 'PAGO');
  const paidFixedExpensesAmount = paidFixed.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const paidFixedExpensesCount = paidFixed.length;

  // Total Gastos Bancarios Reales
  const totalBankExpenses = (data.bankExpenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Margen Neto Global Real (Ingresos - Costos Directos - Gastos Fijos - Gastos Bancarios)
  const totalAllCosts = totalDirectCosts + totalFixedExpenses + totalBankExpenses;
  const globalNetMargin = totalIncome - totalAllCosts;
  const globalNetMarginPercent = totalIncome > 0 ? Math.round((globalNetMargin / totalIncome) * 100) : 0;

  // Alertas y desglose de Cobranza de Clientes (Facturación PAGO vs IMPAGO)
  const clientBillingList = data.clientBilling || [];
  const unpaidInvoices = clientBillingList.filter(c => c.status === 'IMPAGO');
  const totalUnpaidAmount = unpaidInvoices.reduce(
    (acc, curr) => acc + (curr.totalNet !== undefined ? curr.totalNet : curr.hourlyRate * curr.totalHours),
    0
  );
  const unpaidInvoicesCount = unpaidInvoices.length;
  const paidInvoices = clientBillingList.filter(c => c.status === 'PAGO');
  const paidInvoicesAmount = paidInvoices.reduce(
    (acc, curr) => acc + (curr.totalNet !== undefined ? curr.totalNet : curr.hourlyRate * curr.totalHours),
    0
  );
  const paidInvoicesCount = paidInvoices.length;

  // Distribución de Costos (Desglose porcentual)
  const totalExpenditure = totalDirectCosts + totalFixedExpenses + totalBankExpenses;
  const costDistribution = [
    {
      category: 'Sueldos & Cargas Directas Guardias',
      amount: totalDirectCosts,
      percentage: totalExpenditure > 0 ? Math.round((totalDirectCosts / totalExpenditure) * 100) : 0,
      color: '#BE2629',
    },
    ...data.fixedExpenses.map(fe => ({
      category: fe.concept,
      amount: fe.amount,
      percentage: totalExpenditure > 0 ? Math.round((fe.amount / totalExpenditure) * 100) : 0,
      color: '#3b82f6',
    })),
    {
      category: 'Gastos & Comisiones Bancarias',
      amount: totalBankExpenses,
      percentage: totalExpenditure > 0 ? Math.round((totalBankExpenses / totalExpenditure) * 100) : 0,
      color: '#10b981',
    },
  ].sort((a, b) => b.amount - a.amount);

  // Resumen Global
  const generalSummary: GeneralSummaryItem[] = [
    {
      concept: 'Ingresos (Facturación Neta)',
      amount: totalIncome,
      percentage: 100,
      notes: `${data.clientBilling.length} clientes activos`,
    },
    {
      concept: 'Costos Directos (Personal de Guardia)',
      amount: totalDirectCosts,
      percentage: totalIncome > 0 ? Math.round((totalDirectCosts / totalIncome) * 100) : 0,
      notes: `${(data.salaries || []).length} colaboradores en nómina`,
    },
    {
      concept: 'Gastos Fijos Societarios',
      amount: totalFixedExpenses,
      percentage: totalIncome > 0 ? Math.round((totalFixedExpenses / totalIncome) * 100) : 0,
      notes: `${countFixedExpenses} registrados (${unpaidFixedExpensesCount} pendientes)`,
    },
    {
      concept: 'Gastos Bancarios & Débitos',
      amount: totalBankExpenses,
      percentage: totalIncome > 0 ? Math.round((totalBankExpenses / totalIncome) * 100) : 0,
      notes: `${(data.bankExpenses || []).length} débitos y comisiones`,
    },
    {
      concept: 'Margen Neto Consolidado',
      amount: globalNetMargin,
      percentage: globalNetMarginPercent,
      notes: 'Resultado operativo libre C-Level',
    },
  ];

  return {
    data,
    profitability,
    totalIncome,
    totalDirectCosts,
    countSalaries,
    unpaidSalariesAmount,
    unpaidSalariesNetDisburse,
    unpaidSalariesCount,
    paidSalariesAmount,
    paidSalariesCount,
    totalAdvances,
    totalFixedExpenses,
    countFixedExpenses,
    unpaidFixedExpensesAmount,
    unpaidFixedExpensesCount,
    paidFixedExpensesAmount,
    paidFixedExpensesCount,
    totalBankExpenses,
    totalAllCosts,
    globalNetMargin,
    globalNetMarginPercent,
    unpaidInvoices,
    totalUnpaidAmount,
    unpaidInvoicesCount,
    paidInvoicesAmount,
    paidInvoicesCount,
    costDistribution,
    generalSummary,
  };
}

// FILE IMPORTING UTILITIES (CSV / EXCEL READER)
// ==============================================================
export async function parseExcelOrCsvFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Adapt uploaded rows to Employee Salaries
export function importSalariesFromRows(rows: any[]): EmployeeSalaryItem[] {
  return rows.map((r, idx) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(r)) {
          if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
            return r[rowKey];
          }
        }
      }
      return '';
    };

    const name = getVal('nombre', 'apellido y nombre', 'vigilador', 'empleado', 'colaborador', 'personal') || `Colaborador #${idx + 1}`;
    const role = getVal('objetivo', 'funcion', 'objetivo / funcion', 'puesto', 'destino') || 'Vigilador General';
    const rawRecibo = getVal('recibo', 'recibo $', 'en blanco', 'recibo en blanco');
    const rawExtra = getVal('x', 'x $', 'fuera de bono', 'extra');
    const rawNet = getVal('sueldo neto', 'neto', 'sueldo', 'importe neto', 'neto cobrado');
    const rawAdv = getVal('anticipo', 'adelanto', 'anticipos');
    const statusVal = String(getVal('estado', 'status')).toUpperCase();

    const parsedRecibo = parseFloat(String(rawRecibo).replace(/\./g, '').replace(',', '.'));
    const parsedExtra = parseFloat(String(rawExtra).replace(/\./g, '').replace(',', '.')) || 0;
    const parsedNet = parseFloat(String(rawNet).replace(/\./g, '').replace(',', '.')) || 550000;

    const receiptAmount = !isNaN(parsedRecibo) && parsedRecibo >= 0 ? Math.max(0, parsedRecibo) : Math.max(0, parsedNet - parsedExtra);
    const extraAmount = Math.max(0, parsedExtra);
    const netSalary = Math.round(receiptAmount + extraAmount);
    const advance = Math.max(0, parseFloat(String(rawAdv).replace(/\./g, '').replace(',', '.')) || 0);

    return {
      id: `sal-imp-${Date.now()}-${idx}`,
      index: idx + 1,
      fullName: String(name).trim(),
      objectiveOrRole: String(role).trim(),
      receiptAmount,
      extraAmount,
      netSalary,
      advance,
      status: statusVal.includes('PAG') ? 'PAGO' : 'PENDIENTE',
    };
  });
}

// Adapt uploaded rows to Client Billing
export function importClientsFromRows(rows: any[]): ClientBillingItem[] {
  return rows.map((r, idx) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(r)) {
          if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
            return r[rowKey];
          }
        }
      }
      return '';
    };

    const name = getVal('cliente', 'razon social', 'empresa', 'nombre') || `Cliente #${idx + 1}`;
    const rawRate = getVal('tarifa hora', 'tarifa', 'valor hora', 'precio hora');
    const rawHours = getVal('horas totales', 'horas', 'total horas', 'hs');
    const rawVat = getVal('iva', 'iva 21%');
    const rawRet = getVal('retenciones', 'retencion', 'ret');
    const rawNet = getVal('total neto', 'total', 'monto total', 'neto');
    const statusVal = String(getVal('estado', 'status')).toUpperCase();
    const invoice = getVal('factura', 'n factura', 'comprobante') || `FAC-0001-${4500 + idx}`;
    const dueDate = getVal('vencimiento', 'fecha vencimiento', 'vto') || '2026-10-20';

    const hourlyRate = Math.max(0, parseFloat(String(rawRate).replace(/\./g, '').replace(',', '.')) || 5000);
    const parsedHoursInfo = parseFlexibleHours(rawHours !== '' ? rawHours : 720);
    const totalHours = parsedHoursInfo.decimalHours;
    const subtotal = Math.round(hourlyRate * totalHours);
    const vatAmount = rawVat !== '' ? Math.max(0, parseFloat(String(rawVat).replace(/\./g, '').replace(',', '.'))) : Math.round(subtotal * 0.21);
    const includesVat = vatAmount > 0;
    const withholdings = rawRet !== '' ? Math.max(0, parseFloat(String(rawRet).replace(/\./g, '').replace(',', '.'))) : 0;
    const totalNet = rawNet !== '' ? Math.max(0, parseFloat(String(rawNet).replace(/\./g, '').replace(',', '.'))) : Math.max(0, Math.round(subtotal + vatAmount - withholdings));

    return {
      id: `cl-imp-${Date.now()}-${idx}`,
      clientName: String(name).trim(),
      hourlyRate,
      totalHours,
      totalHoursInput: rawHours !== '' ? String(rawHours).trim() : String(totalHours),
      includesVat,
      vatAmount,
      withholdings,
      totalNet,
      status: statusVal.includes('IMPAG') ? 'IMPAGO' : 'PAGO',
      invoiceNumber: String(invoice).trim(),
      dueDate: String(dueDate).trim(),
    };
  });
}

// Adapt uploaded rows to Fixed Expenses
export function importFixedExpensesFromRows(rows: any[]): FixedExpenseItem[] {
  return rows.map((r, idx) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(r)) {
          if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
            return r[rowKey];
          }
        }
      }
      return '';
    };

    const cat = getVal('categoria', 'rubro') || 'Operativo';
    const concept = getVal('concepto', 'detalle', 'descripcion') || `Gasto Fijo #${idx + 1}`;
    const rawAmount = getVal('monto', 'monto $', 'importe', 'total');
    const statusVal = String(getVal('estado', 'status')).toUpperCase();
    const comment = getVal('comentario', 'notas', 'observaciones') || '';

    const amount = Math.max(0, parseFloat(String(rawAmount).replace(/\./g, '').replace(',', '.')) || 50000);

    return {
      id: `fx-imp-${Date.now()}-${idx}`,
      category: String(cat).trim(),
      concept: String(concept).trim(),
      amount,
      status: statusVal.includes('IMPAG') ? 'IMPAGO' : 'PAGO',
      comment: String(comment).trim(),
    };
  });
}

// Adapt uploaded rows to Bank Expenses (retaining previous bank records)
export function importBankExpensesFromRows(
  rows: any[],
  existingBankExpenses: BankExpenseItem[] = []
): BankExpenseItem[] {
  const imported: BankExpenseItem[] = rows.map((r, idx) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(r)) {
          if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
            return r[rowKey];
          }
        }
      }
      return '';
    };

    let bank = String(getVal('banco', 'entidad', 'banco emisor', 'cuenta')).trim();
    if (!bank) bank = 'Banco Galicia';

    const concept = getVal('concepto', 'detalle', 'descripcion', 'movimiento') || `Comisión Bancaria #${idx + 1}`;
    const rawAmount = getVal('monto', 'monto $', 'importe', 'debito', 'total');
    const date = getVal('fecha', 'dia', 'periodo') || '2026-10-15';
    const ref = getVal('referencia', 'n comprobante', 'comprobante') || `REF-${Math.floor(10000 + Math.random() * 90000)}`;
    const statusVal = String(getVal('estado', 'status')).toUpperCase();
    const comment = getVal('comentario', 'observaciones') || `Extracto ${bank}`;

    const amount = Math.max(0, parseFloat(String(rawAmount).replace(/\./g, '').replace(',', '.')) || 15000);

    return {
      id: `bnk-imp-${Date.now()}-${idx}`,
      bank,
      concept: String(concept).trim(),
      amount,
      date: String(date).trim(),
      reference: String(ref).trim(),
      status: statusVal.includes('IMPAG') || statusVal.includes('PEND') ? 'IMPAGO' : 'PAGO',
      comment: String(comment).trim(),
    };
  });

  // Retain existing bank expenses, avoid duplicate ids
  return [...existingBankExpenses, ...imported];
}

// Generate Strict Plain-Text Markdown Tables for Excel copy / chat response
export function generatePlainTextTable(
  sheetType: 'gastos_fijos' | 'sueldos' | 'clientes' | 'gastos_bancarios' | 'rentabilidad' | 'resumen' | 'todas',
  period: string = getCurrentPeriodString()
): string {
  const metrics = calculateManagerialMetrics(period);
  const { data, profitability, generalSummary } = metrics;

  const formatARS = (n: number) => `$ ${n.toLocaleString('es-AR')}`;

  const renderGastosFijos = () => {
    let out = `### GASTOS FIJOS (${period})\n`;
    out += `| Categoría | Concepto | Monto $ | Estado | Comentario |\n`;
    out += `| :--- | :--- | :--- | :--- | :--- |\n`;
    data.fixedExpenses.forEach(f => {
      out += `| ${f.category} | ${f.concept} | ${formatARS(f.amount)} | ${f.status} | ${f.comment} |\n`;
    });
    const total = data.fixedExpenses.reduce((a, b) => a + b.amount, 0);
    out += `| **TOTAL** | **Gastos Fijos del Mes** | **${formatARS(total)}** | - | - |\n`;
    return out;
  };

  const renderGastosBancarios = () => {
    let out = `### GASTOS BANCARIOS (${period})\n`;
    out += `| Banco | Concepto / Comisión | Monto $ | Fecha | Referencia | Estado | Comentario |\n`;
    out += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    (data.bankExpenses || []).forEach(b => {
      out += `| ${b.bank} | ${b.concept} | ${formatARS(b.amount)} | ${b.date || '-'} | ${b.reference || '-'} | ${b.status} | ${b.comment || ''} |\n`;
    });
    const total = (data.bankExpenses || []).reduce((a, b) => a + b.amount, 0);
    out += `| **TOTAL BANCARIO** | **${(data.bankExpenses || []).length} Débitos** | **${formatARS(total)}** | - | - | - | - |\n`;
    return out;
  };

  const renderSueldos = () => {
    let out = `### SUELDOS PERSONAL (${period})\n`;
    out += `| # | Apellido y Nombre | Objetivo / Función | Recibo $ | X $ | Sueldo Neto $ | Anticipo $ | Neto Cobrado $ | Estado |\n`;
    out += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    data.salaries.forEach(s => {
      const recAmt = s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary;
      const extAmt = s.extraAmount !== undefined ? s.extraAmount : 0;
      const netSueldo = recAmt + extAmt;
      const netCobrado = Math.max(0, netSueldo - s.advance);
      out += `| ${s.index} | ${s.fullName} | ${s.objectiveOrRole} | ${formatARS(recAmt)} | ${formatARS(extAmt)} | ${formatARS(netSueldo)} | ${formatARS(s.advance)} | ${formatARS(netCobrado)} | ${s.status} |\n`;
    });
    const totalRecibo = data.salaries.reduce((a, b) => a + (b.receiptAmount !== undefined ? b.receiptAmount : b.netSalary), 0);
    const totalExtra = data.salaries.reduce((a, b) => a + (b.extraAmount || 0), 0);
    const totalNeto = totalRecibo + totalExtra;
    const totalAnticipos = data.salaries.reduce((a, b) => a + b.advance, 0);
    const totalCobrado = Math.max(0, totalNeto - totalAnticipos);
    out += `| - | **TOTALES** | - | **${formatARS(totalRecibo)}** | **${formatARS(totalExtra)}** | **${formatARS(totalNeto)}** | **${formatARS(totalAnticipos)}** | **${formatARS(totalCobrado)}** | - |\n`;
    return out;
  };

  const renderClientes = () => {
    let out = `### CLIENTES (FACTURACIÓN) (${period})\n`;
    out += `| Cliente | Tarifa hora | Horas totales | Subtotal | IVA | Retenciones | Total Neto | Estado |\n`;
    out += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    data.clientBilling.forEach(c => {
      const hInfo = parseFlexibleHours(c.totalHoursInput !== undefined ? c.totalHoursInput : c.totalHours);
      const subtotal = Math.round((c.hourlyRate || 0) * hInfo.decimalHours);
      out += `| ${c.clientName} | ${formatARS(c.hourlyRate)} | ${hInfo.formattedLabel} | ${formatARS(subtotal)} | ${formatARS(c.vatAmount)} | ${formatARS(c.withholdings)} | ${formatARS(c.totalNet)} | ${c.status} |\n`;
    });
    const totalNeto = data.clientBilling.reduce((a, b) => a + b.totalNet, 0);
    out += `| **TOTAL FACTURADO** | - | - | - | - | - | **${formatARS(totalNeto)}** | - |\n`;
    return out;
  };

  const renderRentabilidad = () => {
    let out = `### RENTABILIDAD POR CLIENTE (${period})\n`;
    out += `| Cliente | Facturación Neta | Costo Directo | Margen Bruto | Margen Neto |\n`;
    out += `| :--- | :--- | :--- | :--- | :--- |\n`;
    profitability.forEach(r => {
      out += `| ${r.clientName} | ${formatARS(r.netBilling)} | ${formatARS(r.directCost)} | ${formatARS(r.grossMargin)} | ${formatARS(r.netMargin)} (${r.netMarginPercent}%) |\n`;
    });
    const totFact = profitability.reduce((a, b) => a + b.netBilling, 0);
    const totDirect = profitability.reduce((a, b) => a + b.directCost, 0);
    const totBruto = profitability.reduce((a, b) => a + b.grossMargin, 0);
    const totNeto = profitability.reduce((a, b) => a + b.netMargin, 0);
    const pct = totFact > 0 ? Math.round((totNeto / totFact) * 100) : 0;
    out += `| **TOTALES CONSOLIDADOS** | **${formatARS(totFact)}** | **${formatARS(totDirect)}** | **${formatARS(totBruto)}** | **${formatARS(totNeto)} (${pct}%)** |\n`;
    return out;
  };

  const renderResumen = () => {
    let out = `### RESUMEN GENERAL (${period})\n`;
    out += `| Concepto | Monto $ |\n`;
    out += `| :--- | :--- |\n`;
    generalSummary.forEach(g => {
      out += `| ${g.concept} | ${formatARS(g.amount)} |\n`;
    });
    return out;
  };

  switch (sheetType) {
    case 'gastos_fijos':
      return renderGastosFijos();
    case 'gastos_bancarios':
      return renderGastosBancarios();
    case 'sueldos':
      return renderSueldos();
    case 'clientes':
      return renderClientes();
    case 'rentabilidad':
      return renderRentabilidad();
    case 'resumen':
      return renderResumen();
    case 'todas':
    default:
      return [
        `=======================================================`,
        `INVICT SECURITY SOLUTIONS S.A. - PLANILLAS MENSUALES GERENCIALES`,
        `Período: ${period} · Generado para: Dirección General (C-Level)`,
        `=======================================================\n`,
        renderClientes(),
        '\n',
        renderSueldos(),
        '\n',
        renderGastosFijos(),
        '\n',
        renderGastosBancarios(),
        '\n',
        renderRentabilidad(),
        '\n',
        renderResumen(),
      ].join('\n');
  }
}
