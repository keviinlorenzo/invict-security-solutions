import { UserPersona, UserProfileType } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

// Collect full shared state from localStorage to push to remote devices
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

// --- FIREBASE FIRESTORE + SERVER /api/sync REAL-TIME MULTI-DEVICE ENGINE ---
let firestoreDb: Firestore | null = null;
let remoteSyncInitialized = false;

function initRemoteSync() {
  if (remoteSyncInitialized || typeof window === 'undefined') return;
  remoteSyncInitialized = true;

  // 1. Firestore real-time listener (activates automatically when Firestore is enabled in Firebase project)
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    firestoreDb = getFirestore(app);
    const stateDocRef = doc(firestoreDb, 'invict_corporate_sync', 'global_state');
    onSnapshot(
      stateDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const docData = snap.data();
        if (!docData || docData.clientId === CLIENT_INSTANCE_ID) return;
        const payload: CloudSyncPayload = docData.lastEvent || {
          id: `fs-${docData.updatedAt}`,
          type: 'FULL_STATE_SYNC',
          timestamp: docData.updatedAt || new Date().toISOString(),
          authorName: 'Sincronización Nube',
          authorProfile: 'GERENTE',
          authorEmail: '',
          summary: 'Estado actualizado desde la nube',
        };
        payload.stateSnapshot = docData.stateSnapshot;
        notifySubscribers(payload);
      },
      () => {
        // Firestore not enabled or permission denied: fallback to /api/sync polling silently
      }
    );
  } catch {
    // ignore init error
  }

  // 2. Server /api/sync polling (every 4 seconds + on window focus) for cross-device sync
  const pollServerSync = async () => {
    try {
      const res = await fetch(`/api/sync?since=${lastServerVersion}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.changed || !json.version) return;
      const isInitialFetch = lastServerVersion === 0;
      lastServerVersion = json.version;

      if (json.state && Object.keys(json.state).length > 0) {
        const eventPayload: CloudSyncPayload = json.lastEvent || {
          id: `srv-${json.version}`,
          type: 'FULL_STATE_SYNC',
          timestamp: json.updatedAt || new Date().toISOString(),
          authorName: 'Sincronización Nube',
          authorProfile: 'GERENTE',
          authorEmail: isInitialFetch ? '__initial__' : '',
          summary: 'Sincronización automática en tiempo real',
        };
        eventPayload.id = eventPayload.id || `srv-${json.version}`;
        eventPayload.stateSnapshot = json.state;
        notifySubscribers(eventPayload);
      } else if (isInitialFetch) {
        // Server store is empty: seed it with this device's current state
        pushStateToRemote(undefined, collectLocalSharedState());
      }
    } catch {
      // network offline
    }
  };

  setTimeout(pollServerSync, 600);
  setInterval(pollServerSync, 4000);
  window.addEventListener('focus', pollServerSync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollServerSync();
  });
}

async function pushStateToRemote(event?: CloudSyncPayload, stateSnapshot?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const snapshot = stateSnapshot || collectLocalSharedState();

  // Push to /api/sync endpoint
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
      if (json.version) lastServerVersion = json.version;
    }
  } catch {
    // ignore offline error
  }

  // Push to Firestore if available
  if (firestoreDb) {
    try {
      const stateDocRef = doc(firestoreDb, 'invict_corporate_sync', 'global_state');
      await setDoc(
        stateDocRef,
        {
          clientId: CLIENT_INSTANCE_ID,
          updatedAt: new Date().toISOString(),
          lastEvent: event || null,
          stateSnapshot: snapshot,
        },
        { merge: true }
      );
    } catch {
      // ignore if Firestore is disabled
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

  // 3. Push to remote cloud (/api/sync + Firestore) for all other devices
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
