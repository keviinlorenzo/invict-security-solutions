import { UserPersona, UserProfileType } from '../types';
import { supabase } from './supabaseClient';

// Corporate Default Passwords per Profile
export const DEFAULT_PROFILE_PASSWORDS: Record<UserProfileType, string> = {
  GERENTE: 'Gerencia2026!',
  operaciones: 'Operaciones2026!',
  'recursos humanos': 'Rrhh2026!',
  'administración': 'Admin2026!',
  auxiliar: 'Auxiliar2026!',
  'selección': 'Seleccion2026!',
  'supervisión': 'Supervision2026!',
};

const STORAGE_KEY_PASSWORDS = 'invict_corporate_passwords';
const STORAGE_KEY_CUSTOM_POSTS = 'invict_custom_posts';
const STORAGE_KEY_DELETED_POSTS = 'invict_deleted_post_ids';

export interface CloudSyncPayload {
  id?: string;
  type:
    | 'TASK_MUTATION'
    | 'EXPENSE_MUTATION'
    | 'MESSAGE_MUTATION'
    | 'SHEET_MUTATION'
    | 'LEGAL_MUTATION'
    | 'POST_ADDED'
    | 'POST_DELETED'
    | 'POST_UPDATED'
    | 'PASSWORD_UPDATED'
    | 'GENERIC_SYNC'
    | 'FULL_STATE_SYNC';
  timestamp: string;
  authorName: string;
  authorProfile: string;
  authorEmail: string;
  summary: string;
  data?: any;
  stateSnapshot?: Record<string, any>;
}

const CLIENT_INSTANCE_ID = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let lastProcessedEventId = '';
let lastServerVersion = 0;

// Singleton BroadcastChannel for same-device cross-tab real-time sync
let cloudChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    cloudChannel = new BroadcastChannel('invict_corporate_cloud_sync');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment');
}

type SyncCallback = (payload: CloudSyncPayload) => void;
const subscribers = new Set<SyncCallback>();

function notifySubscribers(payload: CloudSyncPayload) {
  if (payload.id && payload.id === lastProcessedEventId) return;
  if (payload.id) lastProcessedEventId = payload.id;

  // Persist incoming state snapshots to localStorage so all tabs/components stay in sync
  if (payload.stateSnapshot && typeof window !== 'undefined') {
    applyStateSnapshotToLocalStorage(payload.stateSnapshot);
  }

  subscribers.forEach(cb => {
    try {
      cb(payload);
    } catch (err) {
      console.error('Error invoking cloud sync subscriber', err);
    }
  });
}

if (cloudChannel) {
  cloudChannel.onmessage = (event: MessageEvent<CloudSyncPayload>) => {
    if (event.data) {
      notifySubscribers(event.data);
    }
  };
}

// Storage event listener for fallback cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'invict_cloud_broadcast_event' && e.newValue) {
      try {
        const payload: CloudSyncPayload = JSON.parse(e.newValue);
        notifySubscribers(payload);
      } catch {
        // ignore
      }
    }
  });
}

// Collect full shared state from localStorage to push to remote database
export function collectLocalSharedState(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, any> = {};
  const sharedKeys = [
    'invict_tasks',
    'invict_expenses',
    'invict_messages',
    'invict_personas',
    'invict_cloud_modifications',
    STORAGE_KEY_PASSWORDS,
    STORAGE_KEY_CUSTOM_POSTS,
    STORAGE_KEY_DELETED_POSTS,
  ];
  for (const key of sharedKeys) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        snapshot[key] = JSON.parse(raw);
      } catch {
        snapshot[key] = raw;
      }
    }
  }
  // Include all managerial financial sheets
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('invict_managerial_sheets_')) {
      const raw = localStorage.getItem(k);
      if (raw !== null) {
        try {
          snapshot[k] = JSON.parse(raw);
        } catch {
          snapshot[k] = raw;
        }
      }
    }
  }
  return snapshot;
}

export function applyStateSnapshotToLocalStorage(snapshot: Record<string, any>): void {
  if (typeof window === 'undefined' || !snapshot) return;
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        // ignore quota errors
      }
    }
  }
}

// --- SUPABASE POSTGRES + REALTIME WEBSOCKET MULTI-DEVICE ENGINE ---
let remoteSyncInitialized = false;

function handleRemoteRow(row: any, isInitialFetch: boolean) {
  if (!row) return;
  const rowVersion = Number(row.version || 0);
  if (rowVersion > 0 && rowVersion <= lastServerVersion && !isInitialFetch) return;
  if (rowVersion > 0) lastServerVersion = rowVersion;

  if (row.client_id === CLIENT_INSTANCE_ID && !isInitialFetch) return;

  const stateObj = row.state || {};
  if (Object.keys(stateObj).length > 0) {
    const eventPayload: CloudSyncPayload = row.last_event || {
      id: `sb-${rowVersion}-${row.updated_at}`,
      type: 'FULL_STATE_SYNC',
      timestamp: row.updated_at || new Date().toISOString(),
      authorName: 'Base de Datos Nube',
      authorProfile: 'GERENTE',
      authorEmail: isInitialFetch ? '__initial__' : '',
      summary: 'Sincronización en tiempo real desde la base de datos',
    };
    eventPayload.id = eventPayload.id || `sb-${rowVersion}`;
    if (isInitialFetch) {
      eventPayload.authorEmail = '__initial__';
    }
    eventPayload.stateSnapshot = stateObj;
    notifySubscribers(eventPayload);
  } else if (isInitialFetch) {
    // Database is empty: seed initial state from this device
    pushStateToRemote(undefined, collectLocalSharedState());
  }
}

function initRemoteSync() {
  if (remoteSyncInitialized || typeof window === 'undefined') return;
  remoteSyncInitialized = true;

  // 1. Initial fetch from Supabase Postgres
  const fetchFromSupabase = async (isInitial = false) => {
    try {
      const { data, error } = await supabase
        .from('invict_cloud_state')
        .select('id, version, updated_at, client_id, last_event, state')
        .eq('id', 'global_state')
        .maybeSingle();

      if (!error && data) {
        handleRemoteRow(data, isInitial);
      }
    } catch {
      // network offline
    }
  };

  fetchFromSupabase(true);

  // 2. Supabase Realtime WebSocket subscription (instant push on any DB change + broadcast)
  try {
    supabase
      .channel('invict-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invict_cloud_state',
          filter: 'id=eq.global_state',
        },
        (changePayload) => {
          if (changePayload.new) {
            handleRemoteRow(changePayload.new, false);
          }
        }
      )
      .on('broadcast', { event: 'cloud_mutation' }, ({ payload }) => {
        if (payload && payload.clientId !== CLIENT_INSTANCE_ID && payload.event) {
          notifySubscribers(payload.event);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('Supabase Realtime subscription warning:', e);
  }

  // 3. Periodic reconciliation every 5s and on window focus
  setInterval(() => fetchFromSupabase(false), 5000);
  window.addEventListener('focus', () => fetchFromSupabase(false));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchFromSupabase(false);
  });
}

async function pushStateToRemote(event?: CloudSyncPayload, stateSnapshot?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const snapshot = stateSnapshot || collectLocalSharedState();

  // 1. Atomic RPC upsert directly to Supabase Postgres
  try {
    const { data, error } = await supabase.rpc('upsert_invict_cloud_state', {
      p_client_id: CLIENT_INSTANCE_ID,
      p_last_event: event || null,
      p_partial_state: snapshot,
    });
    if (!error && Array.isArray(data) && data[0]?.version) {
      lastServerVersion = Number(data[0].version);
    }
  } catch {
    // Fallback to /api/sync if direct call fails
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_INSTANCE_ID,
          event,
          partialState: snapshot,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.version) lastServerVersion = Number(json.version);
      }
    } catch {
      // ignore offline
    }
  }

  // 2. Also broadcast via Supabase Realtime channel for sub-100ms instant delivery
  if (event) {
    try {
      supabase.channel('invict-realtime-sync').send({
        type: 'broadcast',
        event: 'cloud_mutation',
        payload: { clientId: CLIENT_INSTANCE_ID, event },
      });
    } catch {
      // ignore
    }
  }
}

export function subscribeToCloudSync(callback: SyncCallback): () => void {
  initRemoteSync();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function broadcastCloudChange(
  type: CloudSyncPayload['type'],
  summary: string,
  author: { name: string; profile: string; email: string },
  data?: any
): void {
  initRemoteSync();

  // Ensure latest data is written to localStorage before collecting snapshot
  if (typeof window !== 'undefined' && data !== undefined) {
    try {
      if (type === 'TASK_MUTATION') {
        localStorage.setItem('invict_tasks', JSON.stringify(data));
      } else if (type === 'EXPENSE_MUTATION') {
        localStorage.setItem('invict_expenses', JSON.stringify(data));
      } else if (type === 'MESSAGE_MUTATION') {
        localStorage.setItem('invict_messages', JSON.stringify(data));
      }
    } catch {
      // ignore
    }
  }

  const stateSnapshot = collectLocalSharedState();
  const payload: CloudSyncPayload = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: new Date().toISOString(),
    authorName: author.name,
    authorProfile: author.profile,
    authorEmail: author.email,
    summary,
    data,
    stateSnapshot,
  };

  lastProcessedEventId = payload.id!;

  // 1. Broadcast via BroadcastChannel (same browser)
  if (cloudChannel) {
    try {
      cloudChannel.postMessage(payload);
    } catch (e) {
      console.warn('Failed to post to cloud channel', e);
    }
  }

  // 2. Broadcast via localStorage storage event
  try {
    localStorage.setItem('invict_cloud_broadcast_event', JSON.stringify(payload));
  } catch {
    // ignore
  }

  // 3. Persist in Supabase PostgreSQL + notify all connected devices in real time
  pushStateToRemote(payload, stateSnapshot);
}

// --- PASSWORD MANAGEMENT CONTROLLED BY GERENCIA ---
export function getProfilePasswords(): Record<UserProfileType, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PASSWORDS);
    if (!raw) return { ...DEFAULT_PROFILE_PASSWORDS };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_PROFILE_PASSWORDS, ...saved };
  } catch {
    return { ...DEFAULT_PROFILE_PASSWORDS };
  }
}

export function setProfilePassword(
  profile: UserProfileType,
  newPassword: string,
  author: { name: string; profile: string; email: string }
): void {
  const current = getProfilePasswords();
  current[profile] = newPassword;
  localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(current));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    `Gerencia actualizó la contraseña del perfil "${profile}"`,
    author,
    { profile, newPassword }
  );
}

export function resetAllCorporatePasswordsToDefault(authorName: string = 'Dirección General'): void {
  localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(DEFAULT_PROFILE_PASSWORDS));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    'Se restablecieron todas las contraseñas de los perfiles por defecto',
    { name: authorName, profile: 'GERENTE', email: 'consultasinvictsolutionss.a@gmail.com' },
    DEFAULT_PROFILE_PASSWORDS
  );
}

export function recoverGerenciaPassword(newPassword: string): void {
  const current = getProfilePasswords();
  current['GERENTE'] = newPassword || 'Gerencia2026!';
  localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(current));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    'La Dirección General restableció exitosamente su contraseña de acceso',
    { name: 'Dirección General', profile: 'GERENTE', email: 'consultasinvictsolutionss.a@gmail.com' },
    { profile: 'GERENTE', newPassword: current['GERENTE'] }
  );
}

export function updateSingleProfilePasswordFromRecovery(
  profile: UserProfileType,
  newPassword: string
): void {
  const current = getProfilePasswords();
  current[profile] = newPassword.trim() || DEFAULT_PROFILE_PASSWORDS[profile];
  localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(current));
  broadcastCloudChange(
    'PASSWORD_UPDATED',
    `Se actualizó la contraseña del puesto "${profile}" desde el Centro de Recuperación`,
    { name: 'Dirección General (Recuperación)', profile: 'GERENTE', email: 'consultasinvictsolutionss.a@gmail.com' },
    { profile, newPassword: current[profile] }
  );
}

export function verifyProfilePassword(
  profile: UserProfileType,
  inputPassword: string,
  accountEmail?: string
): boolean {
  if (!inputPassword) return false;
  const passwords = getProfilePasswords();
  const activePassword = passwords[profile] || DEFAULT_PROFILE_PASSWORDS[profile];
  const defaultPassword = DEFAULT_PROFILE_PASSWORDS[profile];

  if (inputPassword === activePassword) return true;
  if (inputPassword === defaultPassword) return true;

  try {
    const customPosts = getCustomPosts();
    const matchedPost = customPosts.find(p => p.email.toLowerCase() === (accountEmail || '').toLowerCase());
    if (matchedPost && (matchedPost as any).customPassword) {
      if (inputPassword === (matchedPost as any).customPassword) return true;
    }
  } catch {}

  return false;
}

// --- PUESTOS DE TRABAJO Y PERSONAL CONTROLLED BY GERENCIA ---
export function getCustomPosts(): UserPersona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_POSTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getDeletedPostIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_POSTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNewCustomPost(
  post: UserPersona,
  initialPassword: string,
  author: { name: string; profile: string; email: string }
): void {
  const current = getCustomPosts();
  const augmented = { ...post, customPassword: initialPassword || DEFAULT_PROFILE_PASSWORDS[post.profileType] };
  current.push(augmented);
  localStorage.setItem(STORAGE_KEY_CUSTOM_POSTS, JSON.stringify(current));
  if (initialPassword) {
    const passwords = getProfilePasswords();
    passwords[post.profileType] = initialPassword;
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(passwords));
  }
  broadcastCloudChange(
    'POST_ADDED',
    `Gerencia dio de alta un nuevo puesto de trabajo: "${post.role}" (${post.name})`,
    author,
    augmented
  );
}

export function deleteWorkplacePost(
  postId: string,
  postName: string,
  author: { name: string; profile: string; email: string }
): void {
  const deleted = getDeletedPostIds();
  if (!deleted.includes(postId)) {
    deleted.push(postId);
    localStorage.setItem(STORAGE_KEY_DELETED_POSTS, JSON.stringify(deleted));
  }
  const custom = getCustomPosts().filter(p => p.id !== postId);
  localStorage.setItem(STORAGE_KEY_CUSTOM_POSTS, JSON.stringify(custom));
  broadcastCloudChange(
    'POST_DELETED',
    `Gerencia eliminó el puesto de trabajo "${postName}" de la empresa`,
    author,
    { postId, postName }
  );
}

export function updateWorkplacePost(
  updated: UserPersona,
  author: { name: string; profile: string; email: string }
): void {
  try {
    const raw = localStorage.getItem('invict_personas');
    let list: UserPersona[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === updated.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updated };
    } else {
      list.push(updated);
    }
    localStorage.setItem('invict_personas', JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to update invict_personas in localStorage', e);
  }

  try {
    const custom = getCustomPosts();
    const idx = custom.findIndex(p => p.id === updated.id);
    if (idx >= 0) {
      custom[idx] = { ...custom[idx], ...updated };
    } else {
      custom.push(updated);
    }
    localStorage.setItem(STORAGE_KEY_CUSTOM_POSTS, JSON.stringify(custom));
  } catch (e) {
    console.warn('Failed to update custom posts in localStorage', e);
  }

  broadcastCloudChange(
    'POST_UPDATED',
    `Se actualizó el responsable del puesto "${updated.role}" a ${updated.name}`,
    author,
    updated
  );
}
