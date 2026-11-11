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

export const INITIAL_RELEVAMIENTOS: RelevamientoItem[] = [];

const DEMO_IDS = new Set(['rel-1', 'rel-2', 'rel-3', 'rel-4', 'rel-5', 'rel-6']);
const DEMO_CLIENT_NAMES = new Set([
  'Bodegas Luján de Cuyo',
  'Barrio Privado La Vacherie',
  'Hospital Santa Isabel de Hungría',
  'Torre Residencial Da Vinci',
  'Hipermercado Átomo Maipú (Base Logística)',
  'Obra Complejo Procrear Maipú',
]);

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
 * Obtiene los relevamientos almacenados o fallback inicial vacío.
 * Purga automáticamente cualquier relevamiento de prueba previo.
 */
export function getRelevamientos(): RelevamientoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELEVAMIENTOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filtrar elementos de prueba si estuvieran en cache local
        const cleaned = parsed.filter(
          (r: RelevamientoItem) => !DEMO_IDS.has(r.id) && !DEMO_CLIENT_NAMES.has(r.clientName)
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_RELEVAMIENTOS, JSON.stringify(cleaned));
          return cleaned;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading relevamientos from storage:', err);
  }
  return INITIAL_RELEVAMIENTOS;
}

/**
 * Limpia totalmente la planilla de relevamientos y sincroniza en la nube
 */
export function clearAllRelevamientos(actor?: UserPersona): void {
  try {
    localStorage.setItem(STORAGE_KEY_RELEVAMIENTOS, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RELEVAMIENTOS_EVENT, { detail: [] }));
    }
    if (actor) {
      broadcastCloudChange(
        'SHEET_MUTATION',
        `${actor.name} limpió la planilla de relevamientos dejando la lista vacía para carga inicial`,
        { name: actor.name, profile: actor.profileType || actor.department, email: actor.email },
        []
      );
    }
  } catch (err) {
    console.error('Error clearing relevamientos:', err);
  }
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
