import { UserPersona } from '../types';
import { broadcastCloudChange } from '../utils/cloudSyncService';
import { getTodayDateString } from '../utils/dateUtils';

export type RelevamientoCategoria =
  | 'edificio'
  | 'barrio'
  | 'obra'
  | 'medicina'
  | 'supermercados'
  | 'empresas';

export type RelevamientoEstado = 'no iniciada' | 'en curso' | 'completada';

export interface RelevamientoComentario {
  id: string;
  authorName: string;
  authorProfile?: string;
  authorEmail?: string;
  timestamp: string;
  text: string;
}

export interface RelevamientoItem {
  id: string;
  orderNumber: number; // Enumerado correlativo N°
  clientName: string; // Nombre del Cliente
  category: RelevamientoCategoria; // Categoría con colores diferenciados
  observations?: string; // Observaciones
  status: RelevamientoEstado; // No iniciada / En curso / Completada
  conLicHigieneSeguridad: boolean; // Se realiza con el Lic. en Higiene y Seguridad o no
  comments?: RelevamientoComentario[]; // Conversación sobre ese relevamiento
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const STORAGE_KEY_RELEVAMIENTOS = 'invict_relevamientos';
export const RELEVAMIENTOS_EVENT = 'invict_relevamientos_updated';

export const RELEVAMIENTO_CATEGORIAS: {
  id: RelevamientoCategoria;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotColor: string;
}[] = [
  {
    id: 'edificio',
    label: 'Edificio Residencial / Comercial',
    shortLabel: 'Edificio',
    badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-700/70',
    dotColor: '#0284c7',
  },
  {
    id: 'barrio',
    label: 'Barrio Privado / Complejo',
    shortLabel: 'Barrio',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70',
    dotColor: '#059669',
  },
  {
    id: 'obra',
    label: 'Obra en Construcción',
    shortLabel: 'Obra',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/70',
    dotColor: '#d97706',
  },
  {
    id: 'medicina',
    label: 'Medicina & Centros de Salud',
    shortLabel: 'Medicina',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/70',
    dotColor: '#e11d48',
  },
  {
    id: 'supermercados',
    label: 'Supermercados & Retail',
    shortLabel: 'Supermercados',
    badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-700/70',
    dotColor: '#9333ea',
  },
  {
    id: 'empresas',
    label: 'Empresas, Industrias & Logística',
    shortLabel: 'Empresas',
    badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/70',
    dotColor: '#4f46e5',
  },
];

export const INITIAL_RELEVAMIENTOS: RelevamientoItem[] = [
  {
    id: 'rel-1',
    orderNumber: 1,
    clientName: 'Bodegas Luján de Cuyo',
    category: 'empresas',
    observations: 'Relevamiento perimetral integral: control de luminarias, portón principal de carga y sensores infrarrojos.',
    status: 'en curso',
    conLicHigieneSeguridad: true,
    createdAt: '2026-10-15',
    updatedAt: '2026-11-05',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [
      {
        id: 'c-1',
        authorName: 'Marianela Sosa',
        authorProfile: 'operaciones',
        authorEmail: 'marianela@invictsecurity.com.ar',
        timestamp: '05/11/2026 10:30 hs',
        text: 'Coordinado con el Lic. en HyS para realizar la visita técnica este jueves a las 09:00 hs.',
      },
      {
        id: 'c-2',
        authorName: 'Laura',
        authorProfile: 'SUB_GERENTE',
        authorEmail: 'laura@invictsecurity.com.ar',
        timestamp: '05/11/2026 11:15 hs',
        text: 'Excelente, revisar especialmente la salida posterior hacia viñedos.',
      },
    ],
  },
  {
    id: 'rel-2',
    orderNumber: 2,
    clientName: 'Barrio Privado La Vacherie',
    category: 'barrio',
    observations: 'Control de garita de ingreso, barreras automáticas, lectores TAG y rondas en perímetro norte.',
    status: 'completada',
    conLicHigieneSeguridad: false,
    createdAt: '2026-10-20',
    updatedAt: '2026-11-02',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [
      {
        id: 'c-3',
        authorName: 'Marianela Sosa',
        authorProfile: 'operaciones',
        authorEmail: 'marianela@invictsecurity.com.ar',
        timestamp: '02/11/2026 16:45 hs',
        text: 'Relevamiento finalizado. Informe entregado al Administrador del Barrio.',
      },
    ],
  },
  {
    id: 'rel-3',
    orderNumber: 3,
    clientName: 'Hospital Santa Isabel de Hungría',
    category: 'medicina',
    observations: 'Inspección de accesos a guardia médica, salidas de emergencia, señalética y cámaras en triage.',
    status: 'en curso',
    conLicHigieneSeguridad: true,
    createdAt: '2026-10-25',
    updatedAt: '2026-11-08',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [
      {
        id: 'c-4',
        authorName: 'Pilar',
        authorProfile: 'recursos humanos',
        authorEmail: 'pilar@invictsecurity.com.ar',
        timestamp: '08/11/2026 09:20 hs',
        text: 'Los vigiladores asignados ya cuentan con constancia de vacunación completa.',
      },
    ],
  },
  {
    id: 'rel-4',
    orderNumber: 4,
    clientName: 'Torre Residencial Da Vinci',
    category: 'edificio',
    observations: 'Relevamiento de molinetes peatonales, control de cocheras en subsuelo y protocolo para visitas.',
    status: 'no iniciada',
    conLicHigieneSeguridad: false,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [],
  },
  {
    id: 'rel-5',
    orderNumber: 5,
    clientName: 'Hipermercado Átomo Maipú (Base Logística)',
    category: 'supermercados',
    observations: 'Control de andenes de carga, garita de pesaje y prevención de pérdidas en playa de maniobras.',
    status: 'en curso',
    conLicHigieneSeguridad: true,
    createdAt: '2026-11-03',
    updatedAt: '2026-11-09',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [
      {
        id: 'c-5',
        authorName: 'Bilbao',
        authorProfile: 'supervisión',
        authorEmail: 'bilbao@invictsecurity.com.ar',
        timestamp: '09/11/2026 14:10 hs',
        text: 'Se verificó el funcionamiento de los reflectores perimetrales nocturnos con el encargado de turno.',
      },
    ],
  },
  {
    id: 'rel-6',
    orderNumber: 6,
    clientName: 'Obra Complejo Procrear Maipú',
    category: 'obra',
    observations: 'Inspección de vallado perimetral, casilla de serenos, matafuegos y libro de novedades de obra.',
    status: 'no iniciada',
    conLicHigieneSeguridad: true,
    createdAt: '2026-11-06',
    updatedAt: '2026-11-06',
    updatedBy: 'Marianela Sosa (Operaciones)',
    comments: [],
  },
];

/**
 * Permiso estricto: Sólo Operaciones (Marianela Sosa) y Gerencia pueden modificar los relevamientos.
 * El resto de usuarios sólo puede visualizar y realizar comentarios.
 */
export function canEditRelevamientos(persona?: UserPersona | null): boolean {
  if (!persona) return false;
  const name = (persona.name || '').toLowerCase();
  const dept = (persona.department || '').toUpperCase();
  const prof = (persona.profileType || '').toLowerCase();
  const role = (persona.role || '').toLowerCase();

  return (
    dept === 'OPERACIONES' ||
    prof === 'operaciones' ||
    name.includes('marianela') ||
    role.includes('operaciones') ||
    dept === 'GERENCIA' ||
    prof === 'gerente'
  );
}

/**
 * Obtiene los relevamientos almacenados o fallback inicial
 */
export function getRelevamientos(): RelevamientoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELEVAMIENTOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading relevamientos from storage:', err);
  }
  return INITIAL_RELEVAMIENTOS;
}

/**
 * Persiste los relevamientos en localStorage y emite evento local y broadcast en la nube
 */
export function saveRelevamientos(
  items: RelevamientoItem[],
  actor: UserPersona,
  summary: string
): void {
  try {
    localStorage.setItem(STORAGE_KEY_RELEVAMIENTOS, JSON.stringify(items));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RELEVAMIENTOS_EVENT, { detail: items }));
    }
    broadcastCloudChange(
      'SHEET_MUTATION',
      summary,
      { name: actor.name, profile: actor.profileType || actor.department, email: actor.email },
      items
    );
  } catch (err) {
    console.error('Error saving relevamientos:', err);
  }
}
