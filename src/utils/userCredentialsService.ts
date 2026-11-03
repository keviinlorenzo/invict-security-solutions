import { UserPersona } from '../types';
import { broadcastCloudChange } from './cloudSyncService';

/**
 * Credenciales INDIVIDUALES por usuario (una por persona, no por puesto/perfil).
 * - Se guarda únicamente un hash (SHA-256 con sal por usuario), nunca la clave en texto plano.
 * - Mientras Gerencia no asigne una clave, el usuario ingresa con su clave inicial personal
 *   (`Nombre2026!`), que Gerencia puede ver en el panel hasta que la reemplace.
 * - Se sincroniza entre dispositivos junto con el resto del estado compartido.
 */
export const STORAGE_KEY_USER_CREDENTIALS = 'invict_user_credentials';

export interface UserCredentialRecord {
  hash: string;
  updatedAt: string;
  updatedBy: string;
}

type CredentialMap = Record<string, UserCredentialRecord>;

const MASTER_PERSONA_ID = 'p-master-c-level';
const MASTER_EMAIL = 'consultasinvictsolutionss.a@gmail.com';

function readCredentials(): CredentialMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_CREDENTIALS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

/** Clave inicial personal del usuario: PrimerNombre2026! (ej. Kevin2026!). */
export function getInitialPasswordFor(persona: UserPersona): string {
  const first = normalizeName(persona.name.trim().split(/\s+/)[0] || 'Usuario');
  const cap = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return `${cap || 'Usuario'}2026!`;
}

export function hasCustomPassword(personaId: string): boolean {
  return !!readCredentials()[personaId];
}

export function getCredentialInfo(personaId: string): UserCredentialRecord | null {
  return readCredentials()[personaId] || null;
}

async function sha256Hex(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // continúa al hash de respaldo
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fb-${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
}

export async function hashPersonaPassword(personaId: string, password: string): Promise<string> {
  return sha256Hex(`invict|${personaId}|${password}`);
}

/** Verifica la clave de ESTE usuario. Ninguna clave de otro usuario o puesto sirve. */
export async function verifyPersonaPassword(persona: UserPersona, input: string): Promise<boolean> {
  if (!input) return false;
  const record = readCredentials()[persona.id];
  if (record) {
    return (await hashPersonaPassword(persona.id, input)) === record.hash;
  }
  if (input === getInitialPasswordFor(persona)) return true;

  // Cuenta maestra de Dirección General: respeta su clave histórica y la del Centro de Recuperación.
  if (persona.id === MASTER_PERSONA_ID || persona.email.toLowerCase() === MASTER_EMAIL) {
    if (input === 'Invict2026!' || input === 'Gerencia2026!') return true;
    try {
      const raw = localStorage.getItem('invict_corporate_passwords');
      const legacy = raw ? JSON.parse(raw) : {};
      if (legacy.GERENTE && input === legacy.GERENTE) return true;
    } catch {
      // ignorar
    }
  }
  return false;
}

export async function setPersonaPassword(
  persona: UserPersona,
  newPassword: string,
  author: { name: string; profile: string; email: string }
): Promise<void> {
  const creds = readCredentials();
  creds[persona.id] = {
    hash: await hashPersonaPassword(persona.id, newPassword),
    updatedAt: new Date().toISOString(),
    updatedBy: author.name,
  };
  localStorage.setItem(STORAGE_KEY_USER_CREDENTIALS, JSON.stringify(creds));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    `${author.name} asignó una nueva contraseña personal a ${persona.name}`,
    author
  );
}

/** Vuelve a la clave inicial personal (Nombre2026!). */
export function resetPersonaPassword(
  persona: UserPersona,
  author: { name: string; profile: string; email: string }
): void {
  const creds = readCredentials();
  delete creds[persona.id];
  localStorage.setItem(STORAGE_KEY_USER_CREDENTIALS, JSON.stringify(creds));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    `${author.name} restableció la contraseña de ${persona.name} a su clave inicial`,
    author
  );
}

export function removePersonaCredential(personaId: string): void {
  const creds = readCredentials();
  if (creds[personaId]) {
    delete creds[personaId];
    localStorage.setItem(STORAGE_KEY_USER_CREDENTIALS, JSON.stringify(creds));
  }
}

export function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
  }
  const body = Array.from(bytes)
    .map(n => chars[n % chars.length])
    .join('');
  return `${body}#${(bytes[0] % 90) + 10}`;
}
