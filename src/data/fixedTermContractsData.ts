// Planilla informativa: Contratos a Plazo Fijo (edición exclusiva Recursos Humanos y Gerencia)
import { UserPersona } from '../types';
import { broadcastCloudChange } from '../utils/cloudSyncService';
import { getTodayDateString } from '../utils/dateUtils';

export interface FixedTermContractItem {
  id: string;
  fullName: string; // Nombre del colaborador
  assignedObjective: string; // Objetivo asignado
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (se refleja en el calendario)
  observations?: string; // No obligatorio
  updatedAt?: string;
  updatedBy?: string;
}

export const STORAGE_KEY_FIXED_TERM_CONTRACTS = 'invict_fixed_term_contracts';
export const FIXED_TERM_CONTRACTS_EVENT = 'invict_fixed_term_contracts_mutation';
export const CONTRACT_ALERT_DAYS = 7;

const INITIAL_CONTRACTS: FixedTermContractItem[] = [];

export function getFixedTermContracts(): FixedTermContractItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FIXED_TERM_CONTRACTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading fixed term contracts:', err);
  }
  return INITIAL_CONTRACTS;
}

export function saveFixedTermContracts(
  contracts: FixedTermContractItem[],
  actor: UserPersona,
  summary: string
): void {
  try {
    localStorage.setItem(STORAGE_KEY_FIXED_TERM_CONTRACTS, JSON.stringify(contracts));
    broadcastCloudChange(
      'SHEET_MUTATION',
      summary,
      { name: actor.name, profile: actor.profileType || actor.department, email: actor.email },
      contracts
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FIXED_TERM_CONTRACTS_EVENT));
    }
  } catch (err) {
    console.error('Error saving fixed term contracts:', err);
  }
}

/** Usuario de Recursos Humanos (único destinatario de las alertas de vencimiento). */
export function isHumanResourcesUser(persona?: UserPersona | null): boolean {
  if (!persona) return false;
  return persona.department === 'RRHH' || persona.profileType === 'recursos humanos';
}

/** Solo Recursos Humanos y Gerencia pueden modificar la planilla. */
export function canEditFixedTermContracts(persona?: UserPersona | null): boolean {
  if (!persona) return false;
  return (
    isHumanResourcesUser(persona) ||
    persona.department === 'GERENCIA' ||
    persona.profileType === 'GERENTE'
  );
}

function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Días restantes hasta la fecha de fin (0 = hoy, negativo = vencido). null si no hay fecha válida. */
export function getContractDaysRemaining(endDate: string): number | null {
  const end = parseLocalDate(endDate);
  const today = parseLocalDate(getTodayDateString());
  if (!end || !today) return null;
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function formatContractDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr || '-';
  return d.toLocaleDateString('es-AR');
}

export type ContractAlertItem = FixedTermContractItem & { daysRemaining: number };

/** Contratos que finalizan dentro de la próxima semana (0 a 7 días). */
export function getContractsExpiringSoon(
  contracts: FixedTermContractItem[] = getFixedTermContracts()
): ContractAlertItem[] {
  const out: ContractAlertItem[] = [];
  for (const c of contracts) {
    const days = getContractDaysRemaining(c.endDate);
    if (days !== null && days >= 0 && days <= CONTRACT_ALERT_DAYS) {
      out.push({ ...c, daysRemaining: days });
    }
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Alertas de vencimiento: SOLO se entregan al usuario de Recursos Humanos.
 * Cualquier otro perfil recibe una lista vacía.
 */
export function getContractAlertsForPersona(persona?: UserPersona | null): ContractAlertItem[] {
  if (!isHumanResourcesUser(persona)) return [];
  return getContractsExpiringSoon();
}

export function describeContractDays(days: number): string {
  if (days === 0) return 'vence HOY';
  if (days === 1) return 'vence mañana';
  return `vence en ${days} días`;
}

export interface ContractCalendarEvent {
  id: string;
  date: string;
  fullName: string;
  assignedObjective: string;
}

export function getContractCalendarEvents(): ContractCalendarEvent[] {
  return getFixedTermContracts()
    .filter((c) => c.endDate && c.fullName)
    .map((c) => ({
      id: c.id,
      date: c.endDate,
      fullName: c.fullName,
      assignedObjective: c.assignedObjective,
    }));
}
