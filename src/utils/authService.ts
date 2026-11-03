import { UserPersona, UserProfileType, AreaType, AuthAccount } from '../types';

export interface AuthSession {
  user: UserPersona;
  token: string;
  loginTime: string;
}

// Pre-configured Corporate Accounts with default passwords
export const DEFAULT_CORPORATE_ACCOUNTS: Array<AuthAccount & { defaultPassword: string; personaId: string }> = [
  {
    id: 'acc-gerente-master',
    email: 'consultasinvictsolutionss.a@gmail.com',
    defaultPassword: 'Invict2026!',
    name: 'Dirección General (INVICT)',
    profileType: 'GERENTE',
    department: 'GERENCIA',
    avatarBg: 'bg-red-700',
    personaId: 'p-master-c-level',
  },
  {
    id: 'acc-gerente',
    email: 'yamila@invictsecurity.com.ar',
    defaultPassword: 'Invict2026!',
    name: 'Yamila',
    profileType: 'GERENTE',
    department: 'GERENCIA',
    avatarBg: 'bg-red-700',
    personaId: 'p-yamila',
  },
  {
    id: 'acc-subgerencia',
    email: 'laura@invictsecurity.com.ar',
    defaultPassword: 'Subgerencia2026!',
    name: 'Laura (Sub Gerencia)',
    profileType: 'SUB_GERENTE',
    department: 'SUB_GERENCIA',
    avatarBg: 'bg-rose-900',
    personaId: 'p-laura',
  },
  {
    id: 'acc-operaciones',
    email: 'operaciones@invictsecurity.com.ar',
    defaultPassword: 'Operaciones2026!',
    name: 'Kevin',
    profileType: 'operaciones',
    department: 'OPERACIONES',
    avatarBg: 'bg-indigo-700',
    personaId: 'p-kevin',
  },
  {
    id: 'acc-rrhh',
    email: 'rrhh@invictsecurity.com.ar',
    defaultPassword: 'Rrhh2026!',
    name: 'Pilar',
    profileType: 'recursos humanos',
    department: 'RRHH',
    avatarBg: 'bg-amber-700',
    personaId: 'p-pilar',
  },
  {
    id: 'acc-admin',
    email: 'administracion@invictsecurity.com.ar',
    defaultPassword: 'Admin2026!',
    name: 'Giuliana',
    profileType: 'administración',
    department: 'ADM',
    avatarBg: 'bg-blue-700',
    personaId: 'p-giuliana',
  },
  {
    id: 'acc-auxiliar',
    email: 'auxiliar@invictsecurity.com.ar',
    defaultPassword: 'Auxiliar2026!',
    name: 'Valeria',
    profileType: 'auxiliar',
    department: 'AUX_ADM',
    avatarBg: 'bg-emerald-700',
    personaId: 'p-valeria',
  },
  {
    id: 'acc-seleccion',
    email: 'seleccion@invictsecurity.com.ar',
    defaultPassword: 'Seleccion2026!',
    name: 'Mariana',
    profileType: 'selección',
    department: 'SELECCION',
    avatarBg: 'bg-purple-700',
    personaId: 'p-mariana',
  },
  {
    id: 'acc-supervision',
    email: 'supervision@invictsecurity.com.ar',
    defaultPassword: 'Supervision2026!',
    name: 'Bilbao (Supervisión Móvil)',
    profileType: 'supervisión',
    department: 'SUPERVISIÓN',
    avatarBg: 'bg-amber-700',
    personaId: 'p-bilbao',
  },
];

// Profile metadata dictionary for UI styling and badges
export const PROFILE_METADATA: Record<UserProfileType, {
  label: string;
  badge: string;
  bgDark: string;
  border: string;
  textColor: string;
  department: AreaType;
  description: string;
}> = {
  'GERENTE': {
    label: 'GERENTE',
    badge: 'bg-red-950/70 text-red-300 border-red-700/60',
    bgDark: 'bg-red-950/40',
    border: 'border-red-700/60',
    textColor: 'text-red-400',
    department: 'GERENCIA',
    description: 'Dirección Ejecutiva, control general de objetivos y auditoría integral.',
  },
  'SUB_GERENTE': {
    label: 'SUB GERENCIA',
    badge: 'bg-rose-950/80 text-rose-300 border-rose-600/70',
    bgDark: 'bg-rose-950/50',
    border: 'border-rose-600/70',
    textColor: 'text-rose-400',
    department: 'SUB_GERENCIA',
    description: 'Sub Gerencia / Vicepresidencia. Control operativo y auditoría gerencial con acceso total.',
  },
  'operaciones': {
    label: 'Operaciones',
    badge: 'bg-rose-950/70 text-rose-300 border-rose-700/60',
    bgDark: 'bg-rose-950/40',
    border: 'border-rose-700/60',
    textColor: 'text-rose-400',
    department: 'OPERACIONES',
    description: 'Supervisión de puestos, patrullaje móvil, relevos y guardias.',
  },
  'recursos humanos': {
    label: 'Recursos Humanos',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
    bgDark: 'bg-emerald-950/40',
    border: 'border-emerald-700/60',
    textColor: 'text-emerald-400',
    department: 'RRHH',
    description: 'Legajos, altas y bajas de vigiladores, licencias y sanciones UPSRA.',
  },
  'administración': {
    label: 'Administración',
    badge: 'bg-blue-950/70 text-blue-300 border-blue-700/60',
    bgDark: 'bg-blue-950/40',
    border: 'border-blue-700/60',
    textColor: 'text-blue-400',
    department: 'ADM',
    description: 'Facturación a clientes, cuentas por pagar y vencimientos fiscales.',
  },
  'auxiliar': {
    label: 'Auxiliar',
    badge: 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60',
    bgDark: 'bg-cyan-950/40',
    border: 'border-cyan-700/60',
    textColor: 'text-cyan-400',
    department: 'AUX_ADM',
    description: 'Caja chica, archivo documental, provisión de insumos y fotocopias.',
  },
  'selección': {
    label: 'Selección',
    badge: 'bg-purple-950/70 text-purple-300 border-purple-700/60',
    bgDark: 'bg-purple-950/40',
    border: 'border-purple-700/60',
    textColor: 'text-purple-400',
    department: 'SELECCION',
    description: 'Entrevistas, psicotécnicos, certificados REPRIV y altas de aspirantes.',
  },
  'supervisión': {
    label: 'Supervisión',
    badge: 'bg-amber-950/70 text-amber-300 border-amber-700/60',
    bgDark: 'bg-amber-950/40',
    border: 'border-amber-700/60',
    textColor: 'text-amber-400',
    department: 'SUPERVISIÓN',
    description: 'Rondas de inspección, control de libros de guardia y supervisores de zona.',
  },
};

const STORAGE_KEY_AUTH_USER = 'invict_auth_session';
const STORAGE_KEY_CUSTOM_ACCOUNTS = 'invict_custom_accounts';

export function getRegisteredAccounts(): Array<AuthAccount & { password?: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCOUNTS);
    const custom = raw ? JSON.parse(raw) : [];
    return [...DEFAULT_CORPORATE_ACCOUNTS, ...custom];
  } catch {
    return DEFAULT_CORPORATE_ACCOUNTS;
  }
}

export function saveNewAccount(account: AuthAccount): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCOUNTS);
    const custom: AuthAccount[] = raw ? JSON.parse(raw) : [];
    custom.push(account);
    localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(custom));
  } catch (err) {
    console.error('Error saving account to localStorage', err);
  }
}

export function determineProfileFromEmail(email: string): UserProfileType {
  const normalized = email.trim().toLowerCase();
  if (normalized.includes('subgeren') || normalized.includes('vicepresid') || normalized.includes('laura')) {
    return 'SUB_GERENTE';
  }
  if (normalized.includes('gerente') || normalized.includes('gerencia') || normalized.includes('yamila') || normalized.includes('domingo') || normalized.includes('consultasinvict')) {
    return 'GERENTE';
  }
  if (normalized.includes('supervis') || normalized.includes('bilbao') || normalized.includes('tejera')) {
    return 'supervisión';
  }
  if (normalized.includes('operacion') || normalized.includes('kevin')) {
    return 'operaciones';
  }
  if (normalized.includes('rrhh') || normalized.includes('recursos') || normalized.includes('pilar') || normalized.includes('humanos')) {
    return 'recursos humanos';
  }
  if (normalized.includes('admin') || normalized.includes('giuliana') || normalized.includes('factura') || normalized.includes('contab')) {
    return 'administración';
  }
  if (normalized.includes('auxiliar') || normalized.includes('valeria') || normalized.includes('caja')) {
    return 'auxiliar';
  }
  if (normalized.includes('seleccion') || normalized.includes('mariana') || normalized.includes('recrut')) {
    return 'selección';
  }
  // Default fallback
  return 'operaciones';
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(session));
  } catch (err) {
    console.error('Error storing session', err);
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
  } catch (err) {
    console.error('Error clearing session', err);
  }
}

export function formatModificationTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${d}/${m}/${y}, ${hh}:${mm}:${ss} hs`;
}
