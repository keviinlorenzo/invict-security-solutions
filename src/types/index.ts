export type AreaType =
  | 'GERENCIA'
  | 'SUB_GERENCIA'
  | 'RRHH'
  | 'ADM'
  | 'AUX_ADM'
  | 'SELECCION'
  | 'SUPERVISIÓN'
  | 'OPERACIONES'
  | 'TODOS';

export type TaskStatus =
  | 'No iniciada'
  | 'En curso'
  | 'Completada'
  | 'Urgente/Prioritaria';

export type TaskPriority = 'Baja' | 'Normal' | 'Media' | 'Alta' | 'Urgente';
export type PriorityType = TaskPriority;

export type TaskNature = 'Fija Mensual' | 'Fija Semanal' | 'Variable' | 'Imprevisto';

export type ShiftType = 'Mañana' | 'Tarde' | 'Noche' | '24hs' | 'Rotativo' | 'General';

export type UserProfileType =
  | 'administración'
  | 'auxiliar'
  | 'selección'
  | 'supervisión'
  | 'operaciones'
  | 'recursos humanos'
  | 'SUB_GERENTE'
  | 'GERENTE';

export interface TaskComment {
  id: string;
  author: string;
  authorEmail?: string;
  authorProfile?: UserProfileType;
  text: string;
  timestamp: string;
}

export interface TaskModification {
  id: string;
  timestamp: string; // ISO
  formattedDate: string; // "15/10/2026, 15:45:12 hs"
  userId: string;
  userName: string;
  userEmail: string;
  userProfile: UserProfileType;
  actionDescription: string;
  details?: string;
}

export interface Task {
  id: string;
  area: AreaType;
  title: string;
  assignee: string;
  assigneeEmail?: string;
  status: TaskStatus;
  priority: TaskPriority;
  nature?: TaskNature;
  monthlyRecurrenceStopped?: boolean; // Si true, se frenó la repetición mensual desde este mes en adelante
  monthlyStoppedFromPeriod?: string;  // Período ('YYYY-MM') desde el cual se frenó la repetición mensual
  weeklySeriesId?: string;          // Identificador compartido de la serie semanal
  weeklyDayOfWeek?: number;         // Día de la semana (0 = Domingo ... 6 = Sábado)
  weeklyRecurrenceStopped?: boolean; // Si true, se detuvo la repetición semanal
  weekNumberInMonth?: number;       // N° de semana dentro del mes (1 a 5)
  shiftType?: ShiftType;
  objectiveLocation?: string; // e.g. "Kraft San Martín", "Fuesmen Maipú", "Bodegas Luján", "Base Central"
  monthPeriod?: string; // 'YYYY-MM'
  startDate?: string;
  dueDate: string;
  completedDate?: string;
  notes?: string;
  category?: string;
  commentsCount?: number;
  comments?: TaskComment[];
  googleEventId?: string;
  googleSyncedAt?: string;
  lastModifiedBy?: {
    name: string;
    email: string;
    profile: UserProfileType;
  };
  lastModifiedAt?: string; // Formatted date & time
  lastModifiedAction?: string;
  history?: TaskModification[];
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  location?: string;
  isInvictTask?: boolean;
  taskId?: string;
  area?: AreaType;
}

export type ExpenseCategory =
  | 'Compras de Insumos'
  | 'Mantenimiento / Ploteo'
  | 'Movilidad y Combustible'
  | 'Multas REPRIV'
  | 'Indumentaria / Uniformes'
  | 'Servicios de Oficina'
  | 'Viáticos Operativos'
  | 'Telefonía y Conectividad';

export type PaymentMethodType =
  | 'Efectivo'
  | 'Transferencia Bancaria'
  | 'Cheque Físico'
  | 'E-Check'
  | 'Tarjeta de Débito'
  | 'Tarjeta de Crédito'
  | 'Otro';

export interface ExpenseItemBreakdown {
  description: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number; // Monto final / Total a Pagar
  subtotal?: number; // Neto Gravado / Base Imponible
  vatRate?: number; // Tasa IVA (%) ej: 21, 10.5, 27, 0
  vatAmount?: number; // Monto IVA = subtotal * (vatRate / 100)
  withholdingRate?: number; // Tasa Retenciones (%) ej: 4, 3, etc.
  withholdings?: number; // Monto Retenciones
  provider: string;
  invoiceNumber: string;
  paymentStatus: 'Pagado' | 'Pendiente' | 'En Revisión';
  responsible: string;
  notes?: string;
  attachmentName?: string;
  // MÉTODO DE PAGO Y FECHAS ESPECÍFICAS
  paymentMethod?: PaymentMethodType;
  paymentDate?: string; // Fecha en la que se pagó (Efectivo, Transferencia, Tarjeta, etc.)
  checkDeliveryDate?: string; // Fecha en la que se entregó el cheque o e-check
  checkDebitDate?: string; // Fecha en la que se debitaría el pago de la cuenta de la empresa
  checkNumber?: string; // N° de Cheque o E-Check
  // DESGLOSE DETALLADO DE ÍTEMS DEL COMPROBANTE
  items?: ExpenseItemBreakdown[];
}

export interface ExpenseFormulaResult {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  withholdingRate: number;
  withholdings: number;
  totalAmount: number;
}

export function computeExpenseFinancials(
  subtotal: number,
  vatRate: number = 21,
  withholdingRate: number = 0,
  customWithholding?: number
): ExpenseFormulaResult {
  const safeSubtotal = Math.max(0, subtotal || 0);
  const safeVatRate = vatRate !== undefined ? Math.max(0, vatRate) : 21;
  const vatAmount = Math.round(safeSubtotal * (safeVatRate / 100));
  const withholdings = customWithholding !== undefined
    ? Math.max(0, customWithholding)
    : Math.round(safeSubtotal * (Math.max(0, withholdingRate || 0) / 100));
  const totalAmount = Math.max(0, safeSubtotal + vatAmount - withholdings);
  return {
    subtotal: safeSubtotal,
    vatRate: safeVatRate,
    vatAmount,
    withholdingRate: Math.max(0, withholdingRate || 0),
    withholdings,
    totalAmount,
  };
}

export interface InternalMessage {
  id: string;
  authorName: string;
  authorEmail?: string;
  authorRole: string;
  content: string;
  timestamp: string;
  mentions: string[];
  isDirect?: boolean; // True si es mensaje privado dirigido a 1 sola persona
  recipientEmail?: string; // Email del destinatario privado
  recipientName?: string; // Nombre del destinatario privado
  relatedTaskId?: string;
  taskId?: string;
}

export interface EmailNotificationLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  subject: string;
  bodySnippet: string;
  timestamp: string;
  status: 'Entregado' | 'Enviado' | 'Reenviado';
  relatedTaskId?: string;
}

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: string;
  department: AreaType;
  profileType: UserProfileType;
  avatarBg: string;
  phone?: string;
  notes?: string;
}

export interface AuthAccount {
  id: string;
  email: string;
  password?: string;
  name: string;
  profileType: UserProfileType;
  department: AreaType;
  avatarBg?: string;
  lastLogin?: string;
}

export interface ExecutiveReportData {
  period: string;
  periodName: string;
  generatedDate: string;
  generatedBy: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  complianceRate: number;
  totalExpenses: number;
  budgetUtilization: number;
  areaBreakdown: Array<{
    area: AreaType;
    areaName: string;
    responsible: string;
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    rate: number;
  }>;
  shiftBreakdown: Array<{
    shift: ShiftType;
    total: number;
    completed: number;
    active: number;
  }>;
}

export type {
  FixedExpenseItem,
  EmployeeSalaryItem,
  ClientBillingItem,
  BankExpenseItem,
  ClientProfitabilityItem,
  GeneralSummaryItem,
  ManagerialMonthData,
} from '../data/managerialSheetsData';
