import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserPersona } from '../types';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Search,
  Download,
  ShieldAlert,
  Shirt,
  Lock,
  CheckCircle2,
  Info,
  Calendar,
  MapPin,
  User,
  Send,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Building,
  Check,
  Edit2,
  X,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardCheck,
  DollarSign
} from 'lucide-react';
import { broadcastCloudChange, markRecordIdsDeleted, subscribeToCloudSync } from '../utils/cloudSyncService';
import { FixedTermContractsSheet } from './FixedTermContractsSheet';
import {
  canEditFixedTermContracts,
  getFixedTermContracts,
  FIXED_TERM_CONTRACTS_EVENT,
} from '../data/fixedTermContractsData';
import { getManagerialMonthData } from '../data/managerialSheetsData';
import { applyRegisteredCreatorPdfFooter } from '../utils/pdfExportUtils';
import { CSV_REGISTERED_WATERMARK } from '../utils/exportUtils';
import {
  formatPeriodName,
  getAdjacentPeriod,
  DEFAULT_PERIOD,
  getTodayDateString
} from '../utils/dateUtils';

export interface PersonalSinDisepItem {
  id: string;
  fullName: string;
  entryDate: string;
  assignedObjective: string;
  observations: string;
  updatedAt?: string;
  updatedAtMs?: number;
  updatedBy?: string;
}

export interface PersonalDebeUniformeItem {
  id: string;
  fullName: string;
  entryDate: string;
  exitDate: string;
  assignedObjective: string;
  observations: string;
  updatedAt?: string;
  updatedAtMs?: number;
  updatedBy?: string;
}

export type InformeStatus = 'Pendiente' | 'En Gestión' | 'Resuelto' | 'Cerrado';

export interface InformeClienteItem {
  id: string;
  orderNumber: number; // N° correlativo del mes
  monthPeriod: string; // 'YYYY-MM'
  clientName: string; // CLIENTE
  caseNumber: string; // CASO número de caso
  sendDate: string; // FECHA de envío
  description?: string; // DESCRIPCIÓN breve acerca de lo que trata el informe (no obligatoria)
  followUp?: string; // SEGUIMIENTO qué medidas se tomaron, se solucionó? el cliente hizo algo? (no obligatoria)
  status: InformeStatus; // Dinámico: Resuelto, En Gestión, Pendiente, Cerrado
  sentVia?: string; // Vía de envío: Email, WhatsApp, En Mano, Portal
  senderName?: string; // Auxiliar Adm / Operaciones que lo emitió
  updatedAt?: string;
  updatedAtMs?: number;
  updatedBy?: string;
}

export type LiquidacionPaymentStatus = 'PAGO' | 'PENDIENTE';

export interface LiquidacionFinalItem {
  id: string;
  fullName: string; // Nombre del vigilador
  assignedObjective: string; // Objetivo en el que estaba (vinculado con clientes cargados por Gerencia)
  exitDate: string; // Fecha de baja (YYYY-MM-DD)
  settlementDate: string; // Fecha de liquidación (día citado en oficinas, YYYY-MM-DD)
  amount?: number | null; // Monto que se le abonará (opcional: no obligatorio)
  observations: string; // Observaciones en caso de que lo requiera
  status: LiquidacionPaymentStatus; // 'PAGO' | 'PENDIENTE' (similar a sueldos del personal)
  updatedAt?: string;
  updatedAtMs?: number;
  updatedBy?: string;
}

export interface AdminInformativeSheetsData {
  sinDisep: PersonalSinDisepItem[];
  debeUniforme: PersonalDebeUniformeItem[];
  informesClientes: InformeClienteItem[];
  liquidacionesFinales?: LiquidacionFinalItem[];
}

export const STORAGE_KEY_ADMIN_SHEETS = 'invict_admin_informative_sheets';

const CLIENTES_HABITUALES = [
  'Bodegas Luján de Cuyo',
  'Kraft San Martín',
  'Fuesmen Mendoza',
  'Logística Cuyo S.A.',
  'Parque Industrial Godoy Cruz',
  'Átomo Supermercados (Base Operativa)',
  'Viñedos del Plata',
  'Terminal de Cargas Maipú',
  'Cervecería & Maltería Quilmes',
  'Barrio Privado La Vacherie'
];

const INITIAL_ADMIN_SHEETS_DATA: AdminInformativeSheetsData = {
  sinDisep: [
    {
      id: 'disep-1',
      fullName: 'Gómez, Lucas Ezequiel',
      entryDate: '2026-10-05',
      assignedObjective: 'Bodegas Luján de Cuyo',
      observations: 'Turno de huella REPRIV asignado - Certificado antecedentes en trámite',
    },
    {
      id: 'disep-2',
      fullName: 'Sosa, Matías Nicolás',
      entryDate: '2026-10-14',
      assignedObjective: 'Parque Industrial Godoy Cruz',
      observations: 'Falta presentar apto psicofísico actualizado para credencial DISEP',
    },
  ],
  debeUniforme: [
    {
      id: 'unif-1',
      fullName: 'Quiroga, Franco Daniel',
      entryDate: '2026-03-10',
      exitDate: '2026-10-22',
      assignedObjective: 'Kraft San Martín',
      observations: 'Adeuda 1 campera táctica de abrigo y 1 pantalón cargo talle 44 (Retenido en liquidación final)',
    },
    {
      id: 'unif-2',
      fullName: 'Lucero, Darío Hernán',
      entryDate: '2026-06-01',
      exitDate: '2026-10-28',
      assignedObjective: 'Logística Cuyo S.A.',
      observations: 'Se notificó por WhatsApp devolución de camisa corporativa y borcegos antes del viernes',
    },
  ],
  informesClientes: [
    {
      id: 'inf-2026-11-1',
      orderNumber: 1,
      monthPeriod: '2026-11',
      clientName: 'Bodegas Luján de Cuyo',
      caseNumber: 'CASO #4102',
      sendDate: '2026-11-02',
      description: 'Informe extraordinario por intento de intrusión perimetral en sector viñedos norte y activación de alarma sonora.',
      followUp: 'Supervisión en móvil reforzó las rondas nocturnas. El cliente reparó el alambrado perimetral el 03/11.',
      status: 'Resuelto',
      sentVia: 'Email Corporativo',
      senderName: 'Kevin Lorenzo (Operaciones)',
      updatedAt: '03/11/2026',
      updatedBy: 'Kevin Lorenzo',
    },
    {
      id: 'inf-2026-11-2',
      orderNumber: 2,
      monthPeriod: '2026-11',
      clientName: 'Kraft San Martín',
      caseNumber: 'CASO #4103',
      sendDate: '2026-11-03',
      description: 'Reporte mensual de control de accesos de transportistas, verificación de precintos y pesaje de camiones.',
      followUp: 'Enviado a gerencia de planta del cliente. Pendiente acuse formal de recepción y firma de conformidad.',
      status: 'En Gestión',
      sentVia: 'Email Corporativo',
      senderName: 'Giuliana (Auxiliar Adm.)',
      updatedAt: '03/11/2026',
      updatedBy: 'Giuliana',
    },
    {
      id: 'inf-2026-11-3',
      orderNumber: 3,
      monthPeriod: '2026-11',
      clientName: 'Logística Cuyo S.A.',
      caseNumber: 'CASO #4104',
      sendDate: '2026-11-04',
      description: 'Novedad por corte imprevisto de suministro eléctrico en Nave 2 y activación manual de grupo electrógeno.',
      followUp: 'Vigilador mantuvo custodia física de portones de emergencia hasta restablecimiento de línea EDEMSA.',
      status: 'Resuelto',
      sentVia: 'WhatsApp Corporativo',
      senderName: 'Kevin Lorenzo (Operaciones)',
      updatedAt: '04/11/2026',
      updatedBy: 'Kevin Lorenzo',
    },
  ],
  liquidacionesFinales: [],
};

/**
 * Obtiene en tiempo real todos los clientes / objetivos ya cargados por Gerencia
 * en sus planillas de facturación (de todos los períodos disponibles), más los habituales.
 */
export function getGerencialClientsList(currentPeriod: string = DEFAULT_PERIOD): string[] {
  const clientSet = new Set<string>();
  try {
    // 1. Clientes del período actual de Gerencia
    const currentMonthData = getManagerialMonthData(currentPeriod);
    if (Array.isArray(currentMonthData?.clientBilling)) {
      currentMonthData.clientBilling.forEach((c) => {
        if (c?.clientName && c.clientName.trim()) {
          clientSet.add(c.clientName.trim());
        }
      });
    }
    // 2. Escanear todas las planillas de Gerencia guardadas en localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('invict_managerial_sheets_')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k) || '{}');
          if (Array.isArray(parsed?.clientBilling)) {
            parsed.clientBilling.forEach((c: any) => {
              if (c?.clientName && String(c.clientName).trim()) {
                clientSet.add(String(c.clientName).trim());
              }
            });
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  CLIENTES_HABITUALES.forEach((cl) => clientSet.add(cl));
  return Array.from(clientSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function getAdminInformativeSheets(): AdminInformativeSheetsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_SHEETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sinDisep: Array.isArray(parsed.sinDisep) ? parsed.sinDisep : INITIAL_ADMIN_SHEETS_DATA.sinDisep,
        debeUniforme: Array.isArray(parsed.debeUniforme) ? parsed.debeUniforme : INITIAL_ADMIN_SHEETS_DATA.debeUniforme,
        informesClientes: Array.isArray(parsed.informesClientes) && parsed.informesClientes.length > 0
          ? parsed.informesClientes
          : INITIAL_ADMIN_SHEETS_DATA.informesClientes,
        liquidacionesFinales: Array.isArray(parsed.liquidacionesFinales)
          ? parsed.liquidacionesFinales
          : [],
      };
    }
  } catch (err) {
    console.error('Error reading admin informative sheets:', err);
  }
  return INITIAL_ADMIN_SHEETS_DATA;
}

export function saveAdminInformativeSheets(
  data: AdminInformativeSheetsData,
  actor: UserPersona,
  summary: string
): void {
  try {
    const now = Date.now();
    try {
      const prevRaw = localStorage.getItem(STORAGE_KEY_ADMIN_SHEETS);
      if (prevRaw) {
        const prev: AdminInformativeSheetsData = JSON.parse(prevRaw);
        const removedIds: string[] = [];
        const stampList = <T extends { id: string }>(nextList: T[] = [], prevList: T[] = []): T[] => {
          const prevMap = new Map((Array.isArray(prevList) ? prevList : []).map((x) => [x.id, x]));
          const nextIdSet = new Set((Array.isArray(nextList) ? nextList : []).map((x) => x.id));
          for (const p of Array.isArray(prevList) ? prevList : []) {
            if (p?.id && !nextIdSet.has(p.id)) removedIds.push(p.id);
          }
          return (Array.isArray(nextList) ? nextList : []).map((item) => {
            const oldItem = prevMap.get(item.id);
            if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
              return { ...item, updatedAtMs: now } as T;
            }
            return item;
          });
        };
        data = {
          ...data,
          sinDisep: stampList(data.sinDisep, prev.sinDisep),
          debeUniforme: stampList(data.debeUniforme, prev.debeUniforme),
          informesClientes: stampList(data.informesClientes, prev.informesClientes),
          liquidacionesFinales: stampList(data.liquidacionesFinales || [], prev.liquidacionesFinales || []),
        };
        if (removedIds.length > 0) {
          markRecordIdsDeleted(removedIds);
        }
      }
    } catch {
      // ignore diff error
    }
    localStorage.setItem(STORAGE_KEY_ADMIN_SHEETS, JSON.stringify(data));
    broadcastCloudChange(
      'SHEET_MUTATION',
      summary,
      { name: actor.name, profile: actor.profileType || actor.department, email: actor.email },
      data
    );
  } catch (err) {
    console.error('Error saving admin informative sheets:', err);
  }
}

interface AdminInformativeSheetsViewProps {
  currentPersona: UserPersona;
  onNotify?: (msg: string) => void;
  currentPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export const AdminInformativeSheetsView: React.FC<AdminInformativeSheetsViewProps> = ({
  currentPersona,
  onNotify,
  currentPeriod,
  onPeriodChange,
}) => {
  const [activeSheet, setActiveSheet] = useState<
    'sin_disep' | 'debe_uniforme' | 'informes_clientes' | 'contratos' | 'liquidaciones_finales'
  >('informes_clientes');
  const [contractsCount, setContractsCount] = useState(() => getFixedTermContracts().length);
  const [gerencialClients, setGerencialClients] = useState<string[]>(() =>
    getGerencialClientsList(currentPeriod || DEFAULT_PERIOD)
  );
  const [customObjectiveIds, setCustomObjectiveIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const refreshContracts = () => {
      setContractsCount(getFixedTermContracts().length);
      setGerencialClients(getGerencialClientsList(currentPeriod || DEFAULT_PERIOD));
    };

    window.addEventListener(FIXED_TERM_CONTRACTS_EVENT, refreshContracts);
    window.addEventListener('invict_managerial_sheets_mutation', refreshContracts);
    window.addEventListener('storage', refreshContracts);
    const unsub = subscribeToCloudSync(() => {
      refreshContracts();
    });
    return () => {
      window.removeEventListener(FIXED_TERM_CONTRACTS_EVENT, refreshContracts);
      window.removeEventListener('invict_managerial_sheets_mutation', refreshContracts);
      window.removeEventListener('storage', refreshContracts);
      unsub();
    };
  }, [currentPeriod]);
  const [sheetsData, setSheetsData] = useState<AdminInformativeSheetsData>(() => getAdminInformativeSheets());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | InformeStatus>('TODOS');
  const [sortField, setSortField] = useState<'orderNumber' | 'clientName' | 'caseNumber' | 'sendDate' | 'status' | 'sentVia'>('orderNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleToggleSort = (field: 'orderNumber' | 'clientName' | 'caseNumber' | 'sendDate' | 'status' | 'sentVia') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Período seleccionado para la planilla de Informes a Clientes
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => currentPeriod || DEFAULT_PERIOD);

  // Modal para agregar / editar informe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInformeId, setEditingInformeId] = useState<string | null>(null);
  const [formClientName, setFormClientName] = useState('');
  const [formCaseNumber, setFormCaseNumber] = useState('');
  const [formSendDate, setFormSendDate] = useState(() => getTodayDateString());
  const [formDescription, setFormDescription] = useState('');
  const [formFollowUp, setFormFollowUp] = useState('');
  const [formStatus, setFormStatus] = useState<InformeStatus>('Pendiente');
  const [formSentVia, setFormSentVia] = useState('Email Corporativo');

  // Sincronizar período si cambia desde afuera
  useEffect(() => {
    if (currentPeriod && currentPeriod !== selectedPeriod) {
      setSelectedPeriod(currentPeriod);
    }
  }, [currentPeriod]);

  // Permisos:
  // 1. Planillas de Administración (Sin DISEP / Uniformes): ADM y GERENCIA
  const canEditAdmin = Boolean(
    currentPersona &&
      (currentPersona.department === 'ADM' ||
        currentPersona.profileType === 'administración' ||
        currentPersona.department === 'GERENCIA' ||
        currentPersona.profileType === 'GERENTE')
  );

  // 2. Planilla de Informes a Clientes: ÚNICAMENTE Auxiliar Administrativo y Operaciones (Marianela Sosa)
  const canEditInformes = Boolean(
    currentPersona &&
      (currentPersona.department === 'AUX_ADM' ||
        currentPersona.profileType === 'auxiliar' ||
        (currentPersona.profileType as string) === 'auxiliar_administrativo' ||
        currentPersona.department === 'OPERACIONES' ||
        currentPersona.profileType === 'operaciones' ||
        (currentPersona.name && currentPersona.name.toLowerCase().includes('marianela')) ||
        (currentPersona.email && currentPersona.email.toLowerCase().includes('marianela')) ||
        (currentPersona.role &&
          (currentPersona.role.toLowerCase().includes('auxiliar') ||
            currentPersona.role.toLowerCase().includes('operaciones'))) ||
        currentPersona.department === 'GERENCIA' ||
        currentPersona.profileType === 'GERENTE')
  );

  // 3. Planilla de Liquidaciones Finales: EXCLUSIVAMENTE Recursos Humanos (Tamara) y Gerencia
  const canEditLiquidaciones = Boolean(
    currentPersona &&
      (currentPersona.department === 'RRHH' ||
        currentPersona.profileType === 'recursos humanos' ||
        (currentPersona.name && currentPersona.name.toLowerCase().includes('tamara')) ||
        currentPersona.department === 'GERENCIA' ||
        currentPersona.profileType === 'GERENTE')
  );

  const canEditCurrentSheet =
    activeSheet === 'informes_clientes'
      ? canEditInformes
      : activeSheet === 'contratos'
      ? canEditFixedTermContracts(currentPersona)
      : activeSheet === 'liquidaciones_finales'
      ? canEditLiquidaciones
      : canEditAdmin;

  useEffect(() => {
    const unsub = subscribeToCloudSync((payload) => {
      if (payload.type === 'SHEET_MUTATION' || payload.type === 'FULL_STATE_SYNC' || payload.stateSnapshot) {
        setSheetsData(getAdminInformativeSheets());
      }
    });
    return () => unsub();
  }, []);

  const updateData = (nextData: AdminInformativeSheetsData, actionSummary: string) => {
    setSheetsData(nextData);
    saveAdminInformativeSheets(nextData, currentPersona, actionSummary);
  };

  // --- Handlers: PERSONAL SIN DISEP ---
  const handleAddSinDisep = () => {
    if (!canEditAdmin) return;
    const today = getTodayDateString();
    const newRow: PersonalSinDisepItem = {
      id: `disep-${Date.now()}`,
      fullName: '',
      entryDate: today,
      assignedObjective: '',
      observations: '',
      updatedAt: new Date().toLocaleDateString('es-AR'),
      updatedAtMs: Date.now(),
      updatedBy: currentPersona.name,
    };
    const next = { ...sheetsData, sinDisep: [...sheetsData.sinDisep, newRow] };
    updateData(next, `${currentPersona.name} agregó un registro en Personal Sin DISEP`);
    onNotify?.('Fila agregada en Planilla: Personal Sin DISEP');
  };

  const handleChangeSinDisep = (id: string, field: keyof PersonalSinDisepItem, value: string) => {
    if (!canEditAdmin) return;
    const nextList = sheetsData.sinDisep.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: value,
            updatedAt: new Date().toLocaleDateString('es-AR'),
            updatedAtMs: Date.now(),
            updatedBy: currentPersona.name,
          }
        : item
    );
    updateData({ ...sheetsData, sinDisep: nextList }, `${currentPersona.name} actualizó Personal Sin DISEP`);
  };

  const handleDeleteSinDisep = (id: string) => {
    if (!canEditAdmin) return;
    const target = sheetsData.sinDisep.find((i) => i.id === id);
    const nextList = sheetsData.sinDisep.filter((i) => i.id !== id);
    updateData({ ...sheetsData, sinDisep: nextList }, `${currentPersona.name} eliminó registro de Personal Sin DISEP`);
    onNotify?.(`Registro "${target?.fullName || 'Sin nombre'}" eliminado de Personal Sin DISEP.`);
  };

  // --- Handlers: PERSONAL QUE DEBE UNIFORME ---
  const handleAddDebeUniforme = () => {
    if (!canEditAdmin) return;
    const today = getTodayDateString();
    const newRow: PersonalDebeUniformeItem = {
      id: `unif-${Date.now()}`,
      fullName: '',
      entryDate: today,
      exitDate: today,
      assignedObjective: '',
      observations: '',
      updatedAt: new Date().toLocaleDateString('es-AR'),
      updatedAtMs: Date.now(),
      updatedBy: currentPersona.name,
    };
    const next = { ...sheetsData, debeUniforme: [...sheetsData.debeUniforme, newRow] };
    updateData(next, `${currentPersona.name} agregó un registro en Personal que Debe Uniforme`);
    onNotify?.('Fila agregada en Planilla: Personal que Debe Uniforme');
  };

  const handleChangeDebeUniforme = (id: string, field: keyof PersonalDebeUniformeItem, value: string) => {
    if (!canEditAdmin) return;
    const nextList = sheetsData.debeUniforme.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: value,
            updatedAt: new Date().toLocaleDateString('es-AR'),
            updatedAtMs: Date.now(),
            updatedBy: currentPersona.name,
          }
        : item
    );
    updateData({ ...sheetsData, debeUniforme: nextList }, `${currentPersona.name} actualizó Personal que Debe Uniforme`);
  };

  const handleDeleteDebeUniforme = (id: string) => {
    if (!canEditAdmin) return;
    const target = sheetsData.debeUniforme.find((i) => i.id === id);
    const nextList = sheetsData.debeUniforme.filter((i) => i.id !== id);
    updateData(
      { ...sheetsData, debeUniforme: nextList },
      `${currentPersona.name} eliminó registro de Personal que Debe Uniforme`
    );
    onNotify?.(`Registro "${target?.fullName || 'Sin nombre'}" eliminado de Personal que Debe Uniforme.`);
  };

  // --- Handlers: INFORMES A CLIENTES (Exclusivo Auxiliar Adm & Operaciones) ---
  const currentMonthInformes = useMemo(() => {
    return (sheetsData.informesClientes || []).filter(
      (item) => (item.monthPeriod || '').startsWith(selectedPeriod)
    );
  }, [sheetsData.informesClientes, selectedPeriod]);

  const handleOpenNewInformeModal = () => {
    if (!canEditInformes) return;
    setEditingInformeId(null);
    setFormClientName('');
    const nextNum = currentMonthInformes.length + 1;
    setFormCaseNumber(`CASO #${selectedPeriod.replace('-', '')}-${String(nextNum).padStart(2, '0')}`);
    setFormSendDate(getTodayDateString());
    setFormDescription('');
    setFormFollowUp('');
    setFormStatus('Pendiente');
    setFormSentVia('Email Corporativo');
    setIsModalOpen(true);
  };

  const handleOpenEditInformeModal = (item: InformeClienteItem) => {
    if (!canEditInformes) return;
    setEditingInformeId(item.id);
    setFormClientName(item.clientName);
    setFormCaseNumber(item.caseNumber);
    setFormSendDate(item.sendDate);
    setFormDescription(item.description || '');
    setFormFollowUp(item.followUp || '');
    setFormStatus(item.status);
    setFormSentVia(item.sentVia || 'Email Corporativo');
    setIsModalOpen(true);
  };

  const handleSaveInformeModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInformes) return;
    if (!formClientName.trim()) {
      alert('Por favor indica el nombre del Cliente u Objetivo.');
      return;
    }

    const todayAr = new Date().toLocaleDateString('es-AR');
    const nowMs = Date.now();

    if (editingInformeId) {
      // Editar existente
      const nextList = (sheetsData.informesClientes || []).map((inf) =>
        inf.id === editingInformeId
          ? {
              ...inf,
              clientName: formClientName.trim(),
              caseNumber: formCaseNumber.trim() || `CASO #${inf.orderNumber}`,
              sendDate: formSendDate,
              description: formDescription.trim() || undefined,
              followUp: formFollowUp.trim() || undefined,
              status: formStatus,
              sentVia: formSentVia,
              updatedAt: todayAr,
              updatedAtMs: nowMs,
              updatedBy: currentPersona.name,
            }
          : inf
      );
      updateData(
        { ...sheetsData, informesClientes: nextList },
        `${currentPersona.name} actualizó el informe de cliente "${formClientName}" (${formCaseNumber})`
      );
      onNotify?.(`Informe "${formCaseNumber}" actualizado con éxito.`);
    } else {
      // Crear nuevo informe correlativo para este mes
      const nextOrder = currentMonthInformes.length + 1;
      const newInforme: InformeClienteItem = {
        id: `inf-${nowMs}`,
        orderNumber: nextOrder,
        monthPeriod: selectedPeriod,
        clientName: formClientName.trim(),
        caseNumber: formCaseNumber.trim() || `CASO #${selectedPeriod.replace('-', '')}-${String(nextOrder).padStart(2, '0')}`,
        sendDate: formSendDate,
        description: formDescription.trim() || undefined,
        followUp: formFollowUp.trim() || undefined,
        status: formStatus,
        sentVia: formSentVia,
        senderName: `${currentPersona.name} (${currentPersona.profileType || currentPersona.department})`,
        updatedAt: todayAr,
        updatedAtMs: nowMs,
        updatedBy: currentPersona.name,
      };

      const nextList = [...(sheetsData.informesClientes || []), newInforme];
      updateData(
        { ...sheetsData, informesClientes: nextList },
        `${currentPersona.name} registró el informe N° ${nextOrder} para el cliente "${formClientName}"`
      );
      onNotify?.(`Informe N° ${nextOrder} guardado en la planilla de ${formatPeriodName(selectedPeriod)}.`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteInforme = (id: string) => {
    if (!canEditInformes) return;
    const target = (sheetsData.informesClientes || []).find((i) => i.id === id);
    if (!target) return;
    if (!window.confirm(`¿Deseas eliminar el informe N° ${target.orderNumber} (${target.clientName})?`)) return;

    // Eliminar y re-enumerar los del mes correspondiente
    const withoutTarget = (sheetsData.informesClientes || []).filter((i) => i.id !== id);
    const monthItems = withoutTarget
      .filter((i) => (i.monthPeriod || '').startsWith(target.monthPeriod))
      .sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0))
      .map((item, idx) => ({ ...item, orderNumber: idx + 1 }));

    const otherMonthsItems = withoutTarget.filter((i) => !(i.monthPeriod || '').startsWith(target.monthPeriod));
    const finalList = [...otherMonthsItems, ...monthItems];

    updateData(
      { ...sheetsData, informesClientes: finalList },
      `${currentPersona.name} eliminó el informe N° ${target.orderNumber} de ${target.clientName}`
    );
    onNotify?.(`Informe N° ${target.orderNumber} eliminado de la planilla.`);
  };

  const handleToggleInformeStatus = (id: string) => {
    if (!canEditInformes) return;
    const statusCycle: InformeStatus[] = ['Pendiente', 'En Gestión', 'Resuelto', 'Cerrado'];
    const nextList = (sheetsData.informesClientes || []).map((inf) => {
      if (inf.id === id) {
        const currentIdx = statusCycle.indexOf(inf.status);
        const nextStatus = statusCycle[(currentIdx + 1) % statusCycle.length];
        return {
          ...inf,
          status: nextStatus,
          updatedAt: new Date().toLocaleDateString('es-AR'),
          updatedAtMs: Date.now(),
          updatedBy: currentPersona.name,
        };
      }
      return inf;
    });

    updateData(
      { ...sheetsData, informesClientes: nextList },
      `${currentPersona.name} actualizó el estado de un informe de cliente`
    );
  };

  const handlePeriodChangeInternal = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    onPeriodChange?.(newPeriod);
  };

  // --- Handlers: LIQUIDACIONES FINALES (Exclusivo RR.HH. y Gerencia) ---
  const liquidacionesList = sheetsData.liquidacionesFinales || [];

  const handleAddLiquidacion = () => {
    if (!canEditLiquidaciones) return;
    const today = getTodayDateString();
    const newRow: LiquidacionFinalItem = {
      id: `liq-${Date.now()}`,
      fullName: '',
      assignedObjective: '',
      exitDate: today,
      settlementDate: today,
      amount: null,
      observations: '',
      status: 'PENDIENTE',
      updatedAt: new Date().toLocaleDateString('es-AR'),
      updatedAtMs: Date.now(),
      updatedBy: currentPersona.name,
    };
    const next = {
      ...sheetsData,
      liquidacionesFinales: [...liquidacionesList, newRow],
    };
    updateData(next, `${currentPersona.name} agregó un registro en Liquidaciones Finales`);
    onNotify?.('Fila agregada en Planilla: Liquidaciones Finales');
  };

  const handleChangeLiquidacion = (
    id: string,
    field: keyof LiquidacionFinalItem,
    value: string | number | null
  ) => {
    if (!canEditLiquidaciones) return;
    const nextList = liquidacionesList.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: value,
            updatedAt: new Date().toLocaleDateString('es-AR'),
            updatedAtMs: Date.now(),
            updatedBy: currentPersona.name,
          }
        : item
    );
    updateData(
      { ...sheetsData, liquidacionesFinales: nextList },
      `${currentPersona.name} actualizó Liquidaciones Finales`
    );
  };

  const handleToggleLiquidacionStatus = (id: string) => {
    if (!canEditLiquidaciones) return;
    const nextList = liquidacionesList.map((item) => {
      if (item.id === id) {
        const nextStatus: LiquidacionPaymentStatus = item.status === 'PAGO' ? 'PENDIENTE' : 'PAGO';
        return {
          ...item,
          status: nextStatus,
          updatedAt: new Date().toLocaleDateString('es-AR'),
          updatedAtMs: Date.now(),
          updatedBy: currentPersona.name,
        };
      }
      return item;
    });
    const changed = nextList.find((x) => x.id === id);
    updateData(
      { ...sheetsData, liquidacionesFinales: nextList },
      `${currentPersona.name} marcó la liquidación de "${changed?.fullName || 'Vigilador'}" como ${
        changed?.status === 'PAGO' ? 'PAGADO' : 'PENDIENTE'
      }`
    );
    onNotify?.(
      `Liquidación de "${changed?.fullName || 'Vigilador'}" actualizada a: ${
        changed?.status === 'PAGO' ? 'PAGADO' : 'PENDIENTE'
      }`
    );
  };

  const handleDeleteLiquidacion = (id: string) => {
    if (!canEditLiquidaciones) return;
    const target = liquidacionesList.find((i) => i.id === id);
    if (!window.confirm(`¿Deseas eliminar la liquidación de "${target?.fullName || 'Sin nombre'}"?`)) return;
    const nextList = liquidacionesList.filter((i) => i.id !== id);
    updateData(
      { ...sheetsData, liquidacionesFinales: nextList },
      `${currentPersona.name} eliminó registro de Liquidaciones Finales`
    );
    onNotify?.(`Registro "${target?.fullName || 'Sin nombre'}" eliminado de Liquidaciones Finales.`);
  };

  // --- Filtered Lists ---
  const q = searchTerm.toLowerCase().trim();

  const filteredLiquidaciones = useMemo(() => {
    if (!q) return liquidacionesList;
    return liquidacionesList.filter(
      (i) =>
        (i.fullName || '').toLowerCase().includes(q) ||
        (i.assignedObjective || '').toLowerCase().includes(q) ||
        (i.observations || '').toLowerCase().includes(q) ||
        (i.status === 'PAGO' ? 'pagado pago' : 'pendiente impago').includes(q)
    );
  }, [liquidacionesList, q]);

  // Métricas en tiempo real de Liquidaciones Finales
  const totalLiquidacionesCount = liquidacionesList.length;
  const paidLiquidacionesCount = liquidacionesList.filter((i) => i.status === 'PAGO').length;
  const pendingLiquidacionesCount = totalLiquidacionesCount - paidLiquidacionesCount;
  const totalLiquidacionesAmount = liquidacionesList.reduce(
    (acc, i) => acc + (i.amount !== null && i.amount !== undefined && !isNaN(Number(i.amount)) ? Number(i.amount) : 0),
    0
  );
  const paidLiquidacionesAmount = liquidacionesList
    .filter((i) => i.status === 'PAGO')
    .reduce(
      (acc, i) => acc + (i.amount !== null && i.amount !== undefined && !isNaN(Number(i.amount)) ? Number(i.amount) : 0),
      0
    );
  const remainingLiquidacionesAmount = Math.max(0, totalLiquidacionesAmount - paidLiquidacionesAmount);

  const filteredSinDisep = useMemo(() => {
    if (!q) return sheetsData.sinDisep;
    return sheetsData.sinDisep.filter(
      (i) =>
        i.fullName.toLowerCase().includes(q) ||
        i.assignedObjective.toLowerCase().includes(q) ||
        i.observations.toLowerCase().includes(q)
    );
  }, [sheetsData.sinDisep, q]);

  const filteredDebeUniforme = useMemo(() => {
    if (!q) return sheetsData.debeUniforme;
    return sheetsData.debeUniforme.filter(
      (i) =>
        i.fullName.toLowerCase().includes(q) ||
        i.assignedObjective.toLowerCase().includes(q) ||
        i.observations.toLowerCase().includes(q)
    );
  }, [sheetsData.debeUniforme, q]);

  const filteredInformes = useMemo(() => {
    const list = currentMonthInformes.filter((inf) => {
      if (statusFilter !== 'TODOS' && inf.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inf.clientName.toLowerCase().includes(q) ||
        inf.caseNumber.toLowerCase().includes(q) ||
        (inf.description && inf.description.toLowerCase().includes(q)) ||
        (inf.followUp && inf.followUp.toLowerCase().includes(q)) ||
        (inf.sentVia && inf.sentVia.toLowerCase().includes(q)) ||
        (inf.senderName && inf.senderName.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'orderNumber') {
        comp = (a.orderNumber || 0) - (b.orderNumber || 0);
      } else if (sortField === 'sendDate') {
        comp = (a.sendDate || '').localeCompare(b.sendDate || '');
      } else if (sortField === 'clientName') {
        comp = (a.clientName || '').localeCompare(b.clientName || '', 'es', { sensitivity: 'base' });
      } else if (sortField === 'caseNumber') {
        comp = (a.caseNumber || '').localeCompare(b.caseNumber || '', 'es', { numeric: true });
      } else if (sortField === 'status') {
        comp = (a.status || '').localeCompare(b.status || '');
      } else if (sortField === 'sentVia') {
        comp = (a.sentVia || '').localeCompare(b.sentVia || '');
      }
      return sortDirection === 'asc' ? comp : -comp;
    });

    return list;
  }, [currentMonthInformes, statusFilter, q, sortField, sortDirection]);

  // Métricas del mes de informes
  const totalInformesMes = currentMonthInformes.length;
  const resueltosMes = currentMonthInformes.filter((i) => i.status === 'Resuelto').length;
  const enGestionMes = currentMonthInformes.filter((i) => i.status === 'En Gestión').length;
  const pendientesMes = currentMonthInformes.filter((i) => i.status === 'Pendiente').length;

  // --- PDF Export ---
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Franja Superior Corporativa
    doc.setFillColor(190, 38, 41);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Membrete
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVICT SECURITY SOLUTIONS S.A.', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('PLANILLAS DE GESTIÓN & INFORMES OFICIALES A CLIENTES', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 14, 12, { align: 'right' });

    if (activeSheet === 'informes_clientes') {
      doc.setTextColor(20, 25, 35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`CONTROL MENSUAL DE INFORMES A CLIENTES · ${formatPeriodName(selectedPeriod).toUpperCase()}`, 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Filtro: ${statusFilter} | Búsqueda: ${searchTerm ? `"${searchTerm}"` : 'Ninguna'} | Orden: ${sortField} (${sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}) | Total: ${filteredInformes.length} informe(s)`,
        14,
        34
      );

      const tableRows = filteredInformes.map((r) => [
        `#${r.orderNumber}`,
        r.clientName,
        r.caseNumber,
        r.sendDate,
        r.sentVia || 'Email Corporativo',
        r.status,
        r.description || '-',
        r.followUp || '-',
        r.senderName || '-',
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['N°', 'Cliente / Objetivo', 'N° Caso', 'Fecha', 'Vía Envío', 'Estado', 'Descripción del Informe', 'Seguimiento / Medidas', 'Registrado Por']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [190, 38, 41],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 36, fontStyle: 'bold' },
          2: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 24 },
          5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 'auto' },
          7: { cellWidth: 'auto' },
          8: { cellWidth: 24 },
        },
        margin: { bottom: 16, left: 10, right: 10 },
      });

      applyRegisteredCreatorPdfFooter(doc, 'Documento oficial de entrega y seguimiento a clientes');
      doc.save(`INVICT_Informes_Clientes_${selectedPeriod}.pdf`);
      onNotify?.(`Planilla de Informes a Clientes (${formatPeriodName(selectedPeriod)}) exportada a PDF.`);
    } else if (activeSheet === 'sin_disep') {
      doc.setTextColor(20, 25, 35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('PLANILLA INFORMATIVA: PERSONAL SIN DISEP', 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Total Registros: ${filteredSinDisep.length}`, 14, 34);

      const tableRows = filteredSinDisep.map((r, idx) => [
        idx + 1,
        r.fullName,
        r.entryDate,
        r.assignedObjective,
        r.observations || '-',
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['#', 'Nombre y Apellido', 'Fecha Ingreso', 'Objetivo Asignado', 'Observaciones']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        margin: { bottom: 16, left: 12, right: 12 },
      });

      applyRegisteredCreatorPdfFooter(doc, 'Planilla Informativa: Personal Sin DISEP');
      doc.save(`INVICT_Personal_Sin_DISEP_${new Date().toISOString().slice(0, 10)}.pdf`);
      onNotify?.('Planilla de Personal Sin DISEP exportada a PDF.');
    } else if (activeSheet === 'liquidaciones_finales') {
      doc.setTextColor(20, 25, 35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('PLANILLA INFORMATIVA: LIQUIDACIONES FINALES (RR.HH. & GERENCIA)', 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Total Liquidaciones: ${totalLiquidacionesCount} (Pagadas: ${paidLiquidacionesCount} | Pendientes: ${pendingLiquidacionesCount}) · Total a Abonar: $${totalLiquidacionesAmount.toLocaleString('es-AR')} · Pagado: $${paidLiquidacionesAmount.toLocaleString('es-AR')} · Resta por Pagar: $${remainingLiquidacionesAmount.toLocaleString('es-AR')}`,
        14,
        34
      );

      const tableRows = filteredLiquidaciones.map((r, idx) => [
        idx + 1,
        r.fullName || '-',
        r.assignedObjective || '-',
        r.exitDate || '-',
        r.settlementDate || '-',
        r.amount !== null && r.amount !== undefined && r.amount !== ('' as any)
          ? `$ ${Number(r.amount).toLocaleString('es-AR')}`
          : 'Sin definir',
        r.observations || '-',
        r.status === 'PAGO' ? 'PAGADO' : 'PENDIENTE',
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['#', 'Nombre del Vigilador', 'Objetivo en el que estaba', 'Fecha de Baja', 'Fecha Liquidación (Citado)', 'Monto a Abonar', 'Observaciones', 'Estado de Pago']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        margin: { bottom: 16, left: 12, right: 12 },
      });

      applyRegisteredCreatorPdfFooter(doc, 'Planilla Informativa: Liquidaciones Finales');
      doc.save(`INVICT_Liquidaciones_Finales_${new Date().toISOString().slice(0, 10)}.pdf`);
      onNotify?.('Planilla de Liquidaciones Finales exportada a PDF.');
    } else {
      doc.setTextColor(20, 25, 35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('PLANILLA INFORMATIVA: PERSONAL QUE DEBE UNIFORME', 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Total Registros: ${filteredDebeUniforme.length}`, 14, 34);

      const tableRows = filteredDebeUniforme.map((r, idx) => [
        idx + 1,
        r.fullName,
        r.entryDate,
        r.exitDate,
        r.assignedObjective,
        r.observations || '-',
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['#', 'Nombre y Apellido', 'Fecha Ingreso', 'Fecha Baja', 'Objetivo Asignado', 'Observaciones']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        margin: { bottom: 16, left: 12, right: 12 },
      });

      applyRegisteredCreatorPdfFooter(doc, 'Planilla Informativa: Personal que Debe Uniforme');
      doc.save(`INVICT_Personal_Debe_Uniforme_${new Date().toISOString().slice(0, 10)}.pdf`);
      onNotify?.('Planilla de Personal que Debe Uniforme exportada a PDF.');
    }
  };

  // --- CSV Export ---
  const handleExportCSV = () => {
    const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const footerLine = `\n\n"# ${CSV_REGISTERED_WATERMARK}"\n`;
    if (activeSheet === 'sin_disep') {
      const headers = ['#', 'Nombre y Apellido del Vigilador', 'Fecha de Ingreso', 'Objetivo Asignado', 'Observaciones'];
      const rows = filteredSinDisep.map((r, idx) =>
        [String(idx + 1), escape(r.fullName), escape(r.entryDate), escape(r.assignedObjective), escape(r.observations)].join(';')
      );
      const csv =
        `\uFEFF# ${CSV_REGISTERED_WATERMARK}\n# PLANILLA INFORMATIVA: PERSONAL SIN DISEP\n` +
        headers.join(';') +
        '\n' +
        rows.join('\n') +
        footerLine;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Personal_Sin_DISEP_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Planilla de Personal Sin DISEP exportada a CSV.');
    } else if (activeSheet === 'debe_uniforme') {
      const headers = ['#', 'Nombre y Apellido del Vigilador', 'Fecha de Ingreso', 'Fecha de Baja', 'Objetivo Asignado', 'Observaciones'];
      const rows = filteredDebeUniforme.map((r, idx) =>
        [
          String(idx + 1),
          escape(r.fullName),
          escape(r.entryDate),
          escape(r.exitDate),
          escape(r.assignedObjective),
          escape(r.observations),
        ].join(';')
      );
      const csv =
        `\uFEFF# ${CSV_REGISTERED_WATERMARK}\n# PLANILLA INFORMATIVA: PERSONAL QUE DEBE UNIFORME\n` +
        headers.join(';') +
        '\n' +
        rows.join('\n') +
        footerLine;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Personal_Debe_Uniforme_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Planilla de Personal que Debe Uniforme exportada a CSV.');
    } else if (activeSheet === 'liquidaciones_finales') {
      const headers = [
        '#',
        'Nombre del Vigilador',
        'Objetivo en el que estaba',
        'Fecha de Baja',
        'Fecha de Liquidación (Citado en Oficinas)',
        'Monto a Abonar',
        'Observaciones',
        'Estado de Pago',
      ];
      const rows = filteredLiquidaciones.map((r, idx) =>
        [
          String(idx + 1),
          escape(r.fullName),
          escape(r.assignedObjective),
          escape(r.exitDate),
          escape(r.settlementDate),
          escape(
            r.amount !== null && r.amount !== undefined && r.amount !== ('' as any)
              ? String(r.amount)
              : ''
          ),
          escape(r.observations),
          escape(r.status === 'PAGO' ? 'PAGADO' : 'PENDIENTE'),
        ].join(';')
      );
      const summaryLine = `# RESUMEN: Total Liquidaciones: ${totalLiquidacionesCount} | Monto Total a Abonar: $${totalLiquidacionesAmount} | Abonado (Pagado): $${paidLiquidacionesAmount} | Resta por Pagar: $${remainingLiquidacionesAmount}\n`;
      const csv =
        `\uFEFF# ${CSV_REGISTERED_WATERMARK}\n# PLANILLA INFORMATIVA: LIQUIDACIONES FINALES\n` +
        summaryLine +
        headers.join(';') +
        '\n' +
        rows.join('\n') +
        footerLine;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Liquidaciones_Finales_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Planilla de Liquidaciones Finales exportada a CSV.');
    } else {
      const headers = ['N°', 'Cliente / Objetivo', 'N° de Caso', 'Fecha de Envío', 'Vía de Envío', 'Estado', 'Descripción', 'Seguimiento / Medidas', 'Registrado Por'];
      const rows = filteredInformes.map((r) =>
        [
          String(r.orderNumber),
          escape(r.clientName),
          escape(r.caseNumber),
          escape(r.sendDate),
          escape(r.sentVia || 'Email Corporativo'),
          escape(r.status),
          escape(r.description || '-'),
          escape(r.followUp || '-'),
          escape(r.senderName || '-'),
        ].join(';')
      );
      const csv =
        `\uFEFF# ${CSV_REGISTERED_WATERMARK}\n# PLANILLA DE INFORMES ENVIADOS A CLIENTES (${formatPeriodName(selectedPeriod)})\n` +
        headers.join(';') +
        '\n' +
        rows.join('\n') +
        footerLine;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Informes_Clientes_${selectedPeriod}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.(`Planilla de Informes a Clientes de ${formatPeriodName(selectedPeriod)} exportada a CSV.`);
    }
  };

  const getStatusBadge = (status: InformeStatus) => {
    switch (status) {
      case 'Resuelto':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Resuelto</span>
          </span>
        );
      case 'En Gestión':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700/60 flex items-center gap-1 shadow-sm">
            <Clock className="w-3 h-3 text-blue-400 animate-pulse" />
            <span>En Gestión</span>
          </span>
        );
      case 'Pendiente':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>Pendiente</span>
          </span>
        );
      case 'Cerrado':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-600 flex items-center gap-1 shadow-sm">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Cerrado</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#131926] via-[#172033] to-[#131926] border border-[#2a3650] rounded-3xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              Planillas Informativas & Control Operativo
            </span>

            {/* Indicador dinámico de permisos según la planilla activa */}
            {activeSheet === 'liquidaciones_finales' ? (
              canEditLiquidaciones ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Modo Edición Habilitado ({currentPersona.department === 'GERENCIA' ? 'Gerencia' : 'Recursos Humanos - Tamara'})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Modo Solo Lectura (Exclusivo Recursos Humanos y Gerencia)
                </span>
              )
            ) : activeSheet === 'contratos' ? (
              canEditFixedTermContracts(currentPersona) ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-violet-950/80 text-violet-300 border border-violet-700/60 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-violet-400" />
                  Modo Edición Habilitado ({currentPersona.department === 'GERENCIA' ? 'Gerencia' : 'Recursos Humanos'})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Modo Solo Lectura (Solo Recursos Humanos y Gerencia pueden editar)
                </span>
              )
            ) : activeSheet === 'informes_clientes' ? (
              canEditInformes ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Modo Edición Habilitado (Auxiliar Administrativo y Operaciones)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-full flex items-center gap-1" title="El resto de usuarios solo tiene acceso a visualizarla">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Modo Solo Lectura (Solo Auxiliar Administrativo y Operaciones pueden editar)
                </span>
              )
            ) : canEditAdmin ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Modo Edición Habilitado ({currentPersona.department === 'GERENCIA' ? 'Gerencia' : 'Administración'})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                Modo Lectura (Solo Administración y Gerencia pueden editar)
              </span>
            )}

            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-[#111622] text-slate-300 border border-[#253047] rounded-full flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-400" />
              Registro en tiempo real
            </span>
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">
            {activeSheet === 'liquidaciones_finales'
              ? 'Planillas Informativas: Liquidaciones Finales'
              : activeSheet === 'contratos'
              ? 'Planillas Informativas: Contratos a Plazo Fijo'
              : activeSheet === 'informes_clientes'
              ? 'Planillas Informativas: Informes Enviados a Clientes'
              : 'Control Informativo: Personal Sin DISEP & Devolución de Uniformes'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {activeSheet === 'liquidaciones_finales'
              ? 'Control numerado de liquidaciones finales de vigiladores: objetivo asignado (vinculado con clientes de Gerencia), fecha de baja, fecha de citación en oficinas, monto a abonar (opcional), observaciones y estado de pago.'
              : activeSheet === 'contratos'
              ? 'Registro numerado de contratos a plazo fijo: colaborador, objetivo asignado, inicio y fin de contrato. La fecha de fin se refleja en el calendario y Recursos Humanos recibe una alerta una semana antes del vencimiento.'
              : activeSheet === 'informes_clientes'
              ? 'Registro correlativo mensual de informes de seguridad y novedades remitidos a clientes. Control de número de caso, fecha de despacho, medidas adoptadas y resolución de incidentes.'
              : 'Registro informativo compartido en tiempo real para todos los puestos de la oficina. Estas planillas son de consulta operativa y no alteran los porcentajes de tareas.'}
          </p>
        </div>

        <div className={activeSheet === 'contratos' ? 'hidden' : 'flex flex-wrap items-center gap-2 shrink-0'}>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
            title="Exportar planilla a formato CSV para Excel"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar (CSV)</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
            title="Exportar documento oficial formateado en PDF con filtros aplicados"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Exportar (PDF)</span>
          </button>

          {activeSheet === 'informes_clientes' && canEditInformes && (
            <button
              onClick={handleOpenNewInformeModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Informe a Cliente</span>
            </button>
          )}

          {activeSheet === 'liquidaciones_finales' && canEditLiquidaciones && (
            <button
              onClick={handleAddLiquidacion}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Liquidación Final</span>
            </button>
          )}

          {(activeSheet === 'sin_disep' || activeSheet === 'debe_uniforme') && canEditAdmin && (
            <button
              onClick={activeSheet === 'sin_disep' ? handleAddSinDisep : handleAddDebeUniforme}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeSheet === 'sin_disep' ? '+ Agregar Vigilador Sin DISEP' : '+ Agregar Deuda de Uniforme'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Selector & Search Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* TAB 1: INFORMES A CLIENTES */}
          <button
            onClick={() => setActiveSheet('informes_clientes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'informes_clientes'
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/40'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>1. INFORMES A CLIENTES</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/40 text-white">
              {currentMonthInformes.length}
            </span>
          </button>

          {/* TAB 2: PERSONAL SIN DISEP */}
          <button
            onClick={() => setActiveSheet('sin_disep')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'sin_disep'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>2. PERSONAL SIN DISEP</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {sheetsData.sinDisep.length}
            </span>
          </button>

          {/* TAB 3: PERSONAL QUE DEBE UNIFORME */}
          <button
            onClick={() => setActiveSheet('debe_uniforme')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'debe_uniforme'
                ? 'bg-amber-600 text-black border-amber-500 shadow-lg'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <Shirt className="w-4 h-4" />
            <span>3. PERSONAL QUE DEBE UNIFORME</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {sheetsData.debeUniforme.length}
            </span>
          </button>

          {/* TAB 4: CONTRATOS A PLAZO FIJO (edición RR.HH. y Gerencia) */}
          <button
            onClick={() => setActiveSheet('contratos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'contratos'
                ? 'bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-950/40'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>4. CONTRATOS A PLAZO FIJO</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {contractsCount}
            </span>
          </button>

          {/* TAB 5: LIQUIDACIONES FINALES (edición exclusiva RR.HH. y Gerencia) */}
          <button
            onClick={() => setActiveSheet('liquidaciones_finales')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'liquidaciones_finales'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/40'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>5. LIQUIDACIONES FINALES</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {totalLiquidacionesCount}
            </span>
          </button>
        </div>

        {/* Search & Month Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeSheet === 'informes_clientes' && (
            <div className="flex items-center gap-1.5 p-1 bg-[#121620] border border-[#22293b] rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => handlePeriodChangeInternal(getAdjacentPeriod(selectedPeriod, -1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2436] transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-white">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                <span>{formatPeriodName(selectedPeriod)}</span>
              </div>
              <button
                type="button"
                onClick={() => handlePeriodChangeInternal(getAdjacentPeriod(selectedPeriod, 1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2436] transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 bg-[#121620] border border-[#22293b] rounded-xl min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                activeSheet === 'informes_clientes'
                  ? 'Buscar por cliente, caso, descripción o seguimiento...'
                  : activeSheet === 'liquidaciones_finales'
                  ? 'Buscar por vigilador, objetivo, observación o estado...'
                  : 'Buscar en la planilla...'
              }
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PLANILLA 5: LIQUIDACIONES FINALES (EDITA EXCLUSIVAMENTE RR.HH. Y GERENCIA) */}
      {/* ========================================================================= */}
      {activeSheet === 'liquidaciones_finales' && (
        <div className="space-y-4">
          {/* Cuadro de Métricas de Liquidaciones Finales */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#111927] via-[#131d2e] to-[#111927] border border-[#23324d] shadow-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Resumen & Métricas de Liquidaciones Finales
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {paidLiquidacionesCount} pagada(s) · {pendingLiquidacionesCount} pendiente(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Métrica 1: Cantidad de Liquidaciones */}
              <div className="p-3.5 rounded-2xl bg-[#0e1420] border border-[#222c40] flex items-center justify-between shadow">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Total Liquidaciones
                  </span>
                  <span className="text-2xl font-black text-white font-mono">
                    {totalLiquidacionesCount}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {paidLiquidacionesCount} abonadas / {pendingLiquidacionesCount} sin abonar
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Métrica 2: Monto Total a Abonar */}
              <div className="p-3.5 rounded-2xl bg-[#0e1420] border border-[#222c40] flex items-center justify-between shadow">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Monto Total a Abonar
                  </span>
                  <span className="text-xl font-black text-cyan-300 font-mono">
                    $ {totalLiquidacionesAmount.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-cyan-400/80 block mt-0.5">
                    Suma total de liquidaciones cargadas
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              {/* Métrica 3: Monto Ya Pagado */}
              <div className="p-3.5 rounded-2xl bg-[#0e1420] border border-emerald-800/50 flex items-center justify-between shadow">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                    Total Ya Abonado (Pagado)
                  </span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    $ {paidLiquidacionesAmount.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                    {paidLiquidacionesCount} liquidación(es) marcada(s) como PAGADO
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Métrica 4: Lo que Resta por Pagar */}
              <div className="p-3.5 rounded-2xl bg-[#0e1420] border border-amber-700/60 flex items-center justify-between shadow">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-400 block">
                    Resta por Pagar (Saldo Pendiente)
                  </span>
                  <span className="text-xl font-black text-amber-300 font-mono">
                    $ {remainingLiquidacionesAmount.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-amber-400/80 block mt-0.5">
                    {pendingLiquidacionesCount} liquidación(es) pendiente(s) de pago
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-400 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {totalLiquidacionesAmount > 0 && (
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>Progreso de cancelación de liquidaciones finales</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {Math.round((paidLiquidacionesAmount / totalLiquidacionesAmount) * 100)}% abonado
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#0b0f18] overflow-hidden border border-[#1f293d]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((paidLiquidacionesAmount / totalLiquidacionesAmount) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Liquidaciones Finales */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
            <div className="flex items-center justify-between border-b border-[#1f2637] pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Planilla 5: Liquidaciones Finales del Personal</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Edición exclusiva para Recursos Humanos (Tamara) y Gerencia. El objetivo se vincula directamente con los clientes cargados por Gerencia y el monto a abonar es opcional.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!canEditLiquidaciones && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Solo visualización
                  </span>
                )}
                {canEditLiquidaciones && (
                  <button
                    type="button"
                    onClick={handleAddLiquidacion}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Fila</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nombre del Vigilador</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[230px]">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-amber-400" />
                        <span>Objetivo en el que estaba</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-rose-400" />
                        <span>Fecha de Baja</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Fecha de Liquidación (Citado)</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Monto a Abonar (Opcional)</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[240px]">Observaciones</th>
                    <th className="py-2.5 px-3 text-center min-w-[145px]">Estado de Pago</th>
                    {canEditLiquidaciones && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433]">
                  {filteredLiquidaciones.map((item, idx) => {
                    const isCustomObj =
                      customObjectiveIds[item.id] ||
                      (Boolean(item.assignedObjective) && !gerencialClients.includes(item.assignedObjective));
                    const isPaid = item.status === 'PAGO';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isPaid ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'hover:bg-[#161b26]/70'
                        }`}
                      >
                        {/* 1. Numeración correlativa */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-black/40 border border-[#2b374e]">
                            #{idx + 1}
                          </span>
                        </td>

                        {/* 2. Nombre del Vigilador */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!canEditLiquidaciones}
                            value={item.fullName}
                            onChange={(e) => handleChangeLiquidacion(item.id, 'fullName', e.target.value)}
                            placeholder="Apellido y Nombre del vigilador..."
                            className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none transition-colors"
                          />
                        </td>

                        {/* 3. Objetivo en el que estaba (vinculado con clientes cargados por Gerencia) */}
                        <td className="py-2 px-3">
                          {canEditLiquidaciones ? (
                            isCustomObj ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  list="gerencia-clientes-liq-list"
                                  value={item.assignedObjective}
                                  onChange={(e) =>
                                    handleChangeLiquidacion(item.id, 'assignedObjective', e.target.value)
                                  }
                                  placeholder="Escribir o elegir objetivo..."
                                  className="w-full bg-[#161c28] border border-[#263147] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-semibold focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCustomObjectiveIds((prev) => ({ ...prev, [item.id]: false }))
                                  }
                                  className="px-2 py-1 rounded bg-[#1f283a] text-[10px] text-slate-300 hover:text-white cursor-pointer shrink-0"
                                  title="Volver a la lista de clientes de Gerencia"
                                >
                                  Lista
                                </button>
                              </div>
                            ) : (
                              <select
                                value={item.assignedObjective || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__CUSTOM__') {
                                    setCustomObjectiveIds((prev) => ({ ...prev, [item.id]: true }));
                                  } else {
                                    handleChangeLiquidacion(item.id, 'assignedObjective', e.target.value);
                                  }
                                }}
                                className="w-full bg-[#161c28] border border-[#263147] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-semibold focus:outline-none cursor-pointer"
                              >
                                <option value="">-- Seleccionar Cliente / Objetivo --</option>
                                {gerencialClients.map((cl) => (
                                  <option key={cl} value={cl}>
                                    {cl}
                                  </option>
                                ))}
                                <option value="__CUSTOM__">✏️ Otro objetivo (escribir manualmente)...</option>
                              </select>
                            )
                          ) : (
                            <span className="text-xs font-semibold text-amber-200 px-1">
                              {item.assignedObjective || '-'}
                            </span>
                          )}
                        </td>

                        {/* 4. Fecha de Baja */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            disabled={!canEditLiquidaciones}
                            value={item.exitDate}
                            onChange={(e) => handleChangeLiquidacion(item.id, 'exitDate', e.target.value)}
                            className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 font-mono focus:outline-none transition-colors"
                          />
                        </td>

                        {/* 5. Fecha de Liquidación (día citado en oficinas) */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            disabled={!canEditLiquidaciones}
                            value={item.settlementDate}
                            onChange={(e) =>
                              handleChangeLiquidacion(item.id, 'settlementDate', e.target.value)
                            }
                            className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none transition-colors"
                          />
                        </td>

                        {/* 6. Monto que se le abonará (NO obligatorio) */}
                        <td className="py-2 px-3">
                          {canEditLiquidaciones ? (
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-xs font-mono text-slate-400">$</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={
                                  item.amount !== null && item.amount !== undefined
                                    ? item.amount
                                    : ''
                                }
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const parsedVal =
                                    rawVal === '' ? null : Math.max(0, parseFloat(rawVal) || 0);
                                  handleChangeLiquidacion(item.id, 'amount', parsedVal);
                                }}
                                placeholder="Opcional (sin monto)"
                                className="w-full bg-[#161c28] border border-[#263147] focus:border-emerald-500 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold placeholder:text-slate-500 placeholder:font-normal focus:outline-none transition-colors"
                              />
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-xs text-emerald-300 px-1">
                              {item.amount !== null &&
                              item.amount !== undefined &&
                              item.amount !== ('' as any)
                                ? `$ ${Number(item.amount).toLocaleString('es-AR')}`
                                : <span className="text-slate-500 italic font-normal">Sin definir</span>}
                            </span>
                          )}
                        </td>

                        {/* 7. Observaciones */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!canEditLiquidaciones}
                            value={item.observations}
                            onChange={(e) =>
                              handleChangeLiquidacion(item.id, 'observations', e.target.value)
                            }
                            placeholder="Observaciones (opcional)..."
                            className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-colors"
                          />
                        </td>

                        {/* 8. Estado de Pago (Pagado / No Pagado - similar a sueldos del personal) */}
                        <td className="py-2 px-3 text-center">
                          {canEditLiquidaciones ? (
                            <button
                              type="button"
                              onClick={() => handleToggleLiquidacionStatus(item.id)}
                              className={`w-full px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                                isPaid
                                  ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border-emerald-600/70'
                                  : 'bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border-amber-700/60'
                              }`}
                              title="Clic para cambiar entre PAGADO y PENDIENTE"
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>PAGADO</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>PENDIENTE</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span
                              className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1 border ${
                                isPaid
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                              }`}
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>PAGADO</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>PENDIENTE</span>
                                </>
                              )}
                            </span>
                          )}
                        </td>

                        {/* 9. Acción Eliminar */}
                        {canEditLiquidaciones && (
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteLiquidacion(item.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Eliminar liquidación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filteredLiquidaciones.length === 0 && (
                    <tr>
                      <td colSpan={canEditLiquidaciones ? 9 : 8} className="py-10 text-center text-slate-400 text-xs">
                        <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-slate-300">
                          No hay liquidaciones finales cargadas en la planilla.
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1">
                          {canEditLiquidaciones
                            ? 'Haz clic en "+ Agregar Liquidación Final" para numerar y registrar la primera liquidación.'
                            : 'Recursos Humanos o Gerencia aún no han registrado liquidaciones finales.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <datalist id="gerencia-clientes-liq-list">
                {gerencialClients.map((cl) => (
                  <option key={cl} value={cl} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLANILLA 4: CONTRATOS A PLAZO FIJO (EDITA RR.HH. Y GERENCIA) */}
      {/* ========================================================================= */}
      {activeSheet === 'contratos' && (
        <FixedTermContractsSheet currentPersona={currentPersona} onNotify={onNotify} searchTerm={searchTerm} />
      )}

      {/* ========================================================================= */}
      {/* PLANILLA 1: INFORMES A CLIENTES (EXCLUSIVA AUXILIAR ADM Y OPERACIONES) */}
      {/* ========================================================================= */}
      {activeSheet === 'informes_clientes' && (
        <div className="space-y-4">
          {/* Tarjetas KPI de Informes del Mes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#121620] border border-[#22293b] flex items-center justify-between shadow">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Informes</span>
                <span className="text-xl font-black text-white">{totalInformesMes}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{formatPeriodName(selectedPeriod)}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121620] border border-[#22293b] flex items-center justify-between shadow">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Resueltos / Concluídos</span>
                <span className="text-xl font-black text-emerald-400">{resueltosMes}</span>
                <span className="text-[10px] text-emerald-400/80 block mt-0.5">Medidas tomadas</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121620] border border-[#22293b] flex items-center justify-between shadow">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">En Gestión</span>
                <span className="text-xl font-black text-blue-400">{enGestionMes}</span>
                <span className="text-[10px] text-blue-400/80 block mt-0.5">En trámite</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121620] border border-[#22293b] flex items-center justify-between shadow">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Pendiente Cliente</span>
                <span className="text-xl font-black text-amber-400">{pendientesMes}</span>
                <span className="text-[10px] text-amber-400/80 block mt-0.5">Acción requerida</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-400 flex items-center justify-center font-bold">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filtros de Estado */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[#121620] border border-[#22293b] rounded-2xl flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-rose-400" />
                Estado:
              </span>
              {(['TODOS', 'Pendiente', 'En Gestión', 'Resuelto', 'Cerrado'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-[#181f2d] text-slate-300 hover:text-white border border-[#252f44]'
                  }`}
                >
                  {st === 'TODOS' ? 'Todos' : st}
                </button>
              ))}
            </div>

            {/* Selector Rápido de Orden */}
            <div className="flex flex-wrap items-center gap-2 bg-[#181f2d] border border-[#252f44] px-3 py-1.5 rounded-xl text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-slate-400 font-semibold">Ordenar por:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="orderNumber" className="bg-[#181f2d] text-white">N° Correlativo</option>
                <option value="sendDate" className="bg-[#181f2d] text-white">Fecha de Envío</option>
                <option value="clientName" className="bg-[#181f2d] text-white">Cliente / Objetivo</option>
                <option value="caseNumber" className="bg-[#181f2d] text-white">N° de Caso</option>
                <option value="status" className="bg-[#181f2d] text-white">Estado</option>
                <option value="sentVia" className="bg-[#181f2d] text-white">Vía de Envío</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2 py-0.5 rounded bg-[#252f44] hover:bg-[#323d57] text-white text-[11px] font-mono font-bold transition-colors cursor-pointer"
                title="Cambiar dirección de ordenamiento"
              >
                {sortDirection === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Mostrando <strong className="text-white">{filteredInformes.length}</strong> de {currentMonthInformes.length} informe(s)
            </div>
          </div>

          {/* Tabla de Informes a Clientes */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
            <div className="flex items-center justify-between border-b border-[#1f2637] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-4 h-4 text-rose-400" />
                  <span>Informes Remitidos a Clientes · {formatPeriodName(selectedPeriod)}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Planilla oficial de entrega de informes operativos, casos y seguimiento post-envío.
                </p>
              </div>

              {!canEditInformes && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Solo vista
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <th
                      onClick={() => handleToggleSort('orderNumber')}
                      className="py-2.5 px-3 text-center w-14 cursor-pointer hover:bg-[#202737] select-none transition-colors"
                      title="Ordenar por N° de orden"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>N°</span>
                        {sortField === 'orderNumber' ? (
                          <span className="text-rose-400 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleToggleSort('clientName')}
                      className="py-2.5 px-3 min-w-[200px] cursor-pointer hover:bg-[#202737] select-none transition-colors"
                      title="Ordenar por Cliente / Objetivo"
                    >
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-rose-400" />
                        <span>Cliente / Objetivo</span>
                        {sortField === 'clientName' ? (
                          <span className="text-rose-400 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleToggleSort('caseNumber')}
                      className="py-2.5 px-3 min-w-[140px] cursor-pointer hover:bg-[#202737] select-none transition-colors"
                      title="Ordenar por N° de Caso"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span>N° de Caso</span>
                        {sortField === 'caseNumber' ? (
                          <span className="text-rose-400 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleToggleSort('sendDate')}
                      className="py-2.5 px-3 min-w-[120px] cursor-pointer hover:bg-[#202737] select-none transition-colors"
                      title="Ordenar por Fecha de Envío"
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Fecha Envío</span>
                        {sortField === 'sendDate' ? (
                          <span className="text-rose-400 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[260px]">
                      <span>Descripción del Informe (Breve)</span>
                    </th>
                    <th className="py-2.5 px-3 min-w-[260px]">
                      <span>Seguimiento & Medidas Tomadas</span>
                    </th>
                    <th
                      onClick={() => handleToggleSort('status')}
                      className="py-2.5 px-3 text-center min-w-[140px] cursor-pointer hover:bg-[#202737] select-none transition-colors"
                      title="Ordenar por Estado"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Estado</span>
                        {sortField === 'status' ? (
                          <span className="text-rose-400 font-bold">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px]">
                      <span>Registrado Por</span>
                    </th>
                    {canEditInformes && <th className="py-2.5 px-2 text-center w-20">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2433]">
                  {filteredInformes.map((item) => (
                    <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors group">
                      {/* N° Correlativo */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-black/40 border border-[#2b374e]">
                          #{item.orderNumber}
                        </span>
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold">●</span>
                          <span>{item.clientName}</span>
                        </div>
                        {item.sentVia && (
                          <span className="text-[10px] text-slate-400 font-normal block pl-3.5">
                            Vía: {item.sentVia}
                          </span>
                        )}
                      </td>

                      {/* CASO NÚMERO */}
                      <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                        <span className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/50">
                          {item.caseNumber}
                        </span>
                      </td>

                      {/* FECHA DE ENVÍO */}
                      <td className="py-3 px-3 font-mono text-slate-200">
                        {item.sendDate}
                      </td>

                      {/* DESCRIPCIÓN (NO OBLIGATORIA) */}
                      <td className="py-3 px-3 text-slate-300">
                        {item.description ? (
                          <p className="line-clamp-2 text-xs leading-relaxed" title={item.description}>
                            {item.description}
                          </p>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">- Sin descripción -</span>
                        )}
                      </td>

                      {/* SEGUIMIENTO (NO OBLIGATORIA) */}
                      <td className="py-3 px-3 text-slate-300">
                        {item.followUp ? (
                          <div className="p-2 rounded-xl bg-[#0d121c] border border-[#1e283b] text-xs leading-relaxed text-slate-200">
                            {item.followUp}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">- Sin medidas registradas -</span>
                        )}
                      </td>

                      {/* ESTADO DINÁMICO */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {canEditInformes ? (
                          <button
                            type="button"
                            onClick={() => handleToggleInformeStatus(item.id)}
                            className="cursor-pointer hover:scale-105 transition-transform"
                            title="Clic para cambiar de estado (Pendiente → En Gestión → Resuelto → Cerrado)"
                          >
                            {getStatusBadge(item.status)}
                          </button>
                        ) : (
                          <div>{getStatusBadge(item.status)}</div>
                        )}
                      </td>

                      {/* REGISTRADO POR */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <span className="font-semibold text-slate-300 block">{item.senderName || 'Operaciones'}</span>
                        {item.updatedAt && (
                          <span className="text-[10px] text-slate-500 font-mono">Modif: {item.updatedAt}</span>
                        )}
                      </td>

                      {/* ACCIONES (SOLO AUXILIAR Y OPERACIONES) */}
                      {canEditInformes && (
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditInformeModal(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#20293d] transition-colors cursor-pointer"
                              title="Editar informe"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInforme(item.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Eliminar informe"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredInformes.length === 0 && (
                    <tr>
                      <td colSpan={canEditInformes ? 9 : 8} className="py-12 text-center text-slate-400 text-xs">
                        <Send className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-slate-300">
                          No hay informes registrados para {formatPeriodName(selectedPeriod)}.
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1">
                          {canEditInformes
                            ? 'Haz clic en "+ Nuevo Informe a Cliente" para registrar el primer informe del mes (N° 1).'
                            : 'El personal autorizado (Auxiliar Administrativo u Operaciones) aún no ha cargado informes en este período.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLANILLA 2: PERSONAL SIN DISEP */}
      {/* ========================================================================= */}
      {activeSheet === 'sin_disep' && (
        <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
          <div className="flex items-center justify-between border-b border-[#1f2637] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <span>Planilla 2: Personal Sin DISEP</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detalle de vigiladores pendientes de habilitación o credencial DISEP, fecha de alta, objetivo asignado y estado del trámite.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredSinDisep.length} registro(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nombre y Apellido del Vigilador</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha de Ingreso</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>Objetivo Asignado</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[280px]">Observaciones</th>
                  {canEditAdmin && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredSinDisep.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.fullName}
                        onChange={(e) => handleChangeSinDisep(item.id, 'fullName', e.target.value)}
                        placeholder="Apellido y Nombre del vigilador..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEditAdmin}
                        value={item.entryDate}
                        onChange={(e) => handleChangeSinDisep(item.id, 'entryDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.assignedObjective}
                        onChange={(e) => handleChangeSinDisep(item.id, 'assignedObjective', e.target.value)}
                        placeholder="Objetivo o puesto asignado..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-semibold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.observations}
                        onChange={(e) => handleChangeSinDisep(item.id, 'observations', e.target.value)}
                        placeholder="Estado del trámite, turno, documentación pendiente..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none transition-colors"
                      />
                    </td>
                    {canEditAdmin && (
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteSinDisep(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredSinDisep.length === 0 && (
                  <tr>
                    <td colSpan={canEditAdmin ? 6 : 5} className="py-8 text-center text-slate-400 text-xs">
                      No hay registros cargados en Personal Sin DISEP.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLANILLA 3: PERSONAL QUE DEBE UNIFORME */}
      {/* ========================================================================= */}
      {activeSheet === 'debe_uniforme' && (
        <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
          <div className="flex items-center justify-between border-b border-[#1f2637] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shirt className="w-4 h-4 text-amber-400" />
                <span>Planilla 3: Personal que Debe Uniforme</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento de indumentaria corporativa, borcegos, camperas y prendas adeudadas por colaboradores desvinculados o en proceso de restitución.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredDebeUniforme.length} registro(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nombre y Apellido</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[130px]">Fecha Ingreso</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Fecha Egreso / Baja</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Último Objetivo</th>
                  <th className="py-2.5 px-3 min-w-[300px]">Prendas / Elementos Adeudados</th>
                  {canEditAdmin && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredDebeUniforme.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.fullName}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'fullName', e.target.value)}
                        placeholder="Apellido y Nombre..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEditAdmin}
                        value={item.entryDate}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'entryDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEditAdmin}
                        value={item.exitDate}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'exitDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.assignedObjective}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'assignedObjective', e.target.value)}
                        placeholder="Último objetivo..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEditAdmin}
                        value={item.observations}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'observations', e.target.value)}
                        placeholder="Detalle de prendas adeudadas..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 focus:outline-none transition-colors"
                      />
                    </td>
                    {canEditAdmin && (
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteDebeUniforme(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredDebeUniforme.length === 0 && (
                  <tr>
                    <td colSpan={canEditAdmin ? 7 : 6} className="py-8 text-center text-slate-400 text-xs">
                      No hay registros cargados en Devolución de Uniformes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR INFORME A CLIENTE */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-xl bg-[#121620] border border-[#2b374e] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingInformeId ? 'Editar Informe Remitido' : 'Nuevo Informe a Cliente'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Período: {formatPeriodName(selectedPeriod)} · N° asignado: #{editingInformeId ? (currentMonthInformes.find(i => i.id === editingInformeId)?.orderNumber || 1) : currentMonthInformes.length + 1}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveInformeModal} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cliente */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Cliente / Objetivo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="clientes-sugeridos"
                    required
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="Ej. Bodegas Luján de Cuyo"
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  <datalist id="clientes-sugeridos">
                    {CLIENTES_HABITUALES.map((cl) => (
                      <option key={cl} value={cl} />
                    ))}
                  </datalist>
                </div>

                {/* Número de Caso */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    N° de Caso / Expediente <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCaseNumber}
                    onChange={(e) => setFormCaseNumber(e.target.value)}
                    placeholder="Ej. CASO #4105"
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Fecha de Envío */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Fecha de Envío <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formSendDate}
                    onChange={(e) => setFormSendDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Vía de Envío */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Vía de Envío
                  </label>
                  <select
                    value={formSentVia}
                    onChange={(e) => setFormSentVia(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="Email Corporativo">Email Corporativo</option>
                    <option value="WhatsApp Corporativo">WhatsApp Corporativo</option>
                    <option value="Entrega en Mano (Físico)">Entrega en Mano (Físico)</option>
                    <option value="Portal de Cliente">Portal de Cliente</option>
                  </select>
                </div>

                {/* Estado Inicial */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Estado de Resolución
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as InformeStatus)}
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="Pendiente">Pendiente (Acción requerida)</option>
                    <option value="En Gestión">En Gestión (Medidas en curso)</option>
                    <option value="Resuelto">Resuelto (Solución confirmada)</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>
              </div>

              {/* Descripción (No obligatoria) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">
                    Descripción Breve del Informe
                  </label>
                  <span className="text-[10px] text-slate-500 italic">Opcional</span>
                </div>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Detalla sucintamente el asunto o motivo del informe remitido al cliente..."
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              {/* Seguimiento / Medidas (No obligatoria) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">
                    Seguimiento & Medidas Tomadas
                  </label>
                  <span className="text-[10px] text-slate-500 italic">Opcional</span>
                </div>
                <textarea
                  value={formFollowUp}
                  onChange={(e) => setFormFollowUp(e.target.value)}
                  rows={3}
                  placeholder="¿Qué medidas tomó la empresa? ¿El cliente realizó alguna acción o confirmó recepción? ¿Se resolvió?"
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#20293d]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#181f2d] hover:bg-[#20293d] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingInformeId ? 'Guardar Cambios' : 'Registrar Informe'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
