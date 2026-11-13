import { UserPersona, UserProfileType } from '../types';
import { supabase } from './supabaseClient';

// Corporate Default Passwords per Profile
export const DEFAULT_PROFILE_PASSWORDS: Record<UserProfileType, string> = {
  GERENTE: 'Gerencia2026!',
  SUB_GERENTE: 'Subgerencia2026!',
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
const STORAGE_KEY_DELETED_TASKS = 'invict_deleted_task_ids';

export function getDeletedTaskIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_TASKS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markTaskIdsDeleted(taskIds: string[]): void {
  if (typeof window === 'undefined' || !taskIds || taskIds.length === 0) return;
  try {
    const current = getDeletedTaskIds();
    const merged = Array.from(new Set([...taskIds, ...current])).slice(0, 1000);
    localStorage.setItem(STORAGE_KEY_DELETED_TASKS, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
}

function getTaskLastUpdatedMs(task: any): number {
  if (!task || typeof task !== 'object') return 0;
  let maxTs = 0;
  if (Array.isArray(task.history) && task.history.length > 0 && task.history[0]?.timestamp) {
    const parsed = Date.parse(task.history[0].timestamp);
    if (!isNaN(parsed) && parsed > maxTs) maxTs = parsed;
  }
  if (task.googleSyncedAt) {
    const parsed = Date.parse(task.googleSyncedAt);
    if (!isNaN(parsed) && parsed > maxTs) maxTs = parsed;
  }
  if (typeof task.id === 'string') {
    const match = task.id.match(/(\d{13})/);
    if (match) {
      const idTs = Number(match[1]);
      if (!isNaN(idTs) && idTs > maxTs) maxTs = idTs;
    }
  }
  return maxTs;
}

export function mergeTaskLists(
  localTasks: any[],
  remoteTasks: any[],
  extraDeletedIds?: string[]
): any[] {
  const safeLocal = Array.isArray(localTasks) ? localTasks : [];
  const safeRemote = Array.isArray(remoteTasks) ? remoteTasks : [];
  const deletedSet = new Set<string>([
    ...getDeletedTaskIds(),
    ...(Array.isArray(extraDeletedIds) ? extraDeletedIds : []),
  ]);

  const remoteMap = new Map<string, any>();
  for (const rt of safeRemote) {
    if (rt && typeof rt.id === 'string' && !deletedSet.has(rt.id)) {
      remoteMap.set(rt.id, rt);
    }
  }

  const localOnlyTasks: any[] = [];
  for (const lt of safeLocal) {
    if (!lt || typeof lt.id !== 'string' || deletedSet.has(lt.id)) continue;
    const rt = remoteMap.get(lt.id);
    if (!rt) {
      localOnlyTasks.push(lt);
      remoteMap.set(lt.id, lt);
    } else {
      const localTs = getTaskLastUpdatedMs(lt);
      const remoteTs = getTaskLastUpdatedMs(rt);
      const localHist = Array.isArray(lt.history) ? lt.history.length : 0;
      const remoteHist = Array.isArray(rt.history) ? rt.history.length : 0;
      const localComm = Array.isArray(lt.comments) ? lt.comments.length : 0;
      const remoteComm = Array.isArray(rt.comments) ? rt.comments.length : 0;

      if (
        localTs > remoteTs ||
        (localTs === remoteTs && (localHist > remoteHist || localComm > remoteComm))
      ) {
        remoteMap.set(lt.id, lt);
      }
    }
  }

  const seen = new Set<string>();
  const merged: any[] = [];

  for (const lt of localOnlyTasks) {
    if (!seen.has(lt.id)) {
      seen.add(lt.id);
      merged.push(remoteMap.get(lt.id) || lt);
    }
  }

  for (const rt of safeRemote) {
    if (rt && typeof rt.id === 'string' && !deletedSet.has(rt.id) && !seen.has(rt.id)) {
      seen.add(rt.id);
      merged.push(remoteMap.get(rt.id) || rt);
    }
  }

  return merged;
}

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
    'invict_stopped_monthly_tasks',
    'invict_expenses',
    'invict_messages',
    'invict_personas',
    'invict_cloud_modifications',
    'invict_admin_informative_sheets',
    'invict_fixed_term_contracts',
    STORAGE_KEY_PASSWORDS,
    'invict_user_credentials',
    STORAGE_KEY_CUSTOM_POSTS,
    STORAGE_KEY_DELETED_POSTS,
    STORAGE_KEY_DELETED_TASKS,
  ];
  for (const key of sharedKeys) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        let parsed = JSON.parse(raw);
        // Trim modification history (keep 40 most recent at start of array)
        if (key === 'invict_cloud_modifications' && Array.isArray(parsed) && parsed.length > 40) {
          parsed = parsed.slice(0, 40);
          try {
            localStorage.setItem(key, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        }
        snapshot[key] = parsed;
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

  // 1. Merge deleted task IDs first so deleted tasks are never resurrected
  if (Array.isArray(snapshot[STORAGE_KEY_DELETED_TASKS])) {
    markTaskIdsDeleted(snapshot[STORAGE_KEY_DELETED_TASKS]);
    snapshot[STORAGE_KEY_DELETED_TASKS] = getDeletedTaskIds();
  }

  // 2. Smart merge invict_tasks by task ID and modification timestamp
  if (Array.isArray(snapshot.invict_tasks)) {
    try {
      const localRaw = localStorage.getItem('invict_tasks');
      const localTasks = localRaw ? JSON.parse(localRaw) : [];
      const mergedTasks = mergeTaskLists(
        localTasks,
        snapshot.invict_tasks,
        snapshot[STORAGE_KEY_DELETED_TASKS]
      );
      snapshot.invict_tasks = mergedTasks;
    } catch {
      // fallback to snapshot.invict_tasks
    }
  }

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
let lastCheckTime = 0;
let pushDebounceTimer: any = null;
let pendingRemoteEvent: CloudSyncPayload | undefined;
let pendingSnapshot: Record<string, any> | undefined;
let isPushInFlight = false;
let queuedPushAfterFlight = false;

function handleRemoteRow(row: any, isInitialFetch: boolean) {
  if (!row) return;
  const rowVersion = Number(row.version || 0);
  if (rowVersion > 0 && rowVersion <= lastServerVersion && !isInitialFetch) return;
  if (rowVersion > 0) lastServerVersion = rowVersion;

  if (row.client_id === CLIENT_INSTANCE_ID && !isInitialFetch) return;

  const stateObj = row.state || {};
  if (Object.keys(stateObj).length > 0) {
    // Check before merging whether local storage has unpushed tasks or newer task modifications
    let needsRepushToCloud = false;
    if (typeof window !== 'undefined' && Array.isArray(stateObj.invict_tasks)) {
      try {
        const localRaw = localStorage.getItem('invict_tasks');
        const localTasks: any[] = localRaw ? JSON.parse(localRaw) : [];
        const remoteTasks: any[] = stateObj.invict_tasks;
        const remoteDeleted: string[] = Array.isArray(stateObj[STORAGE_KEY_DELETED_TASKS])
          ? stateObj[STORAGE_KEY_DELETED_TASKS]
          : [];
        const merged = mergeTaskLists(localTasks, remoteTasks, remoteDeleted);

        if (merged.length > remoteTasks.length) {
          needsRepushToCloud = true;
        } else {
          const remoteMap = new Map(remoteTasks.map((t: any) => [t.id, t]));
          for (const mt of merged) {
            const rt = remoteMap.get(mt.id);
            if (!rt || getTaskLastUpdatedMs(mt) > getTaskLastUpdatedMs(rt)) {
              needsRepushToCloud = true;
              break;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const baseEvent = row.last_event || {
      type: 'FULL_STATE_SYNC',
      timestamp: row.updated_at || new Date().toISOString(),
      authorName: 'Base de Datos Nube',
      authorProfile: 'GERENTE',
      authorEmail: isInitialFetch ? '__initial__' : '',
      summary: 'Sincronización en tiempo real desde la base de datos',
    };

    // Always assign a distinct row-snapshot event ID so it never collides with broadcast notification IDs
    const eventPayload: CloudSyncPayload = {
      ...baseEvent,
      id: `sb-row-v${rowVersion}-${row.updated_at || Date.now()}`,
      authorEmail: isInitialFetch ? '__initial__' : baseEvent.authorEmail,
      stateSnapshot: stateObj,
    };

    notifySubscribers(eventPayload);

    // If local browser had newly saved or modified tasks that were not yet in the remote row, push merged state immediately
    if (needsRepushToCloud) {
      void executePushToRemote(undefined, collectLocalSharedState());
    }
  } else if (isInitialFetch) {
    // Database is empty: seed initial state from this device
    pushStateToRemote(undefined, collectLocalSharedState());
  }
}

async function fetchFullRemoteState(isInitial = false) {
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
}

async function checkRemoteVersion() {
  const now = Date.now();
  // Throttle check so it cannot run more frequently than once every 8s
  if (now - lastCheckTime < 8000) return;
  lastCheckTime = now;

  try {
    // Ultra-lightweight HEAD check (~60 bytes transferred instead of 400KB+)
    const { data, error } = await supabase
      .from('invict_cloud_state')
      .select('id, version, updated_at, client_id')
      .eq('id', 'global_state')
      .maybeSingle();

    if (error || !data) return;

    const rowVersion = Number(data.version || 0);
    // If version hasn't changed or came from this exact client, do not download state!
    if (rowVersion > 0 && rowVersion <= lastServerVersion) return;
    if (data.client_id === CLIENT_INSTANCE_ID) {
      lastServerVersion = rowVersion;
      return;
    }

    // Only download full state when an actual newer version from another client is confirmed
    await fetchFullRemoteState(false);
  } catch {
    // network offline
  }
}

function initRemoteSync() {
  if (remoteSyncInitialized || typeof window === 'undefined') return;
  remoteSyncInitialized = true;

  // 1. Initial fetch of full database state
  fetchFullRemoteState(true);

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
          // Use a distinct broadcast ID prefix so it never blocks the subsequent full-state row update
          notifySubscribers({
            ...payload.event,
            id: `bcast-${payload.event.id || Date.now()}`,
          });
          // Immediately fetch and merge the updated state from Supabase
          void fetchFullRemoteState(false);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('Supabase Realtime subscription warning:', e);
  }

  // 3. Periodic fallback reconciliation: checks ONLY lightweight version every 60s
  setInterval(() => checkRemoteVersion(), 60000);
  window.addEventListener('focus', () => checkRemoteVersion());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkRemoteVersion();
  });

  // Flush any pending debounced push on tab close/unload
  window.addEventListener('beforeunload', () => {
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
      pushDebounceTimer = null;
      if (pendingSnapshot) {
        void executePushToRemote(pendingRemoteEvent, pendingSnapshot);
      }
    }
  });
}

async function executePushToRemote(event?: CloudSyncPayload, stateSnapshot?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  if (isPushInFlight) {
    pendingRemoteEvent = event || pendingRemoteEvent;
    pendingSnapshot = stateSnapshot || collectLocalSharedState();
    queuedPushAfterFlight = true;
    return;
  }

  isPushInFlight = true;
  try {
    const snapshot = stateSnapshot || collectLocalSharedState();

    // Always ensure snapshot has the freshest invict_tasks and deleted task IDs from localStorage
    const freshLocal = collectLocalSharedState();
    if (Array.isArray(freshLocal.invict_tasks)) {
      snapshot.invict_tasks = mergeTaskLists(
        freshLocal.invict_tasks,
        Array.isArray(snapshot.invict_tasks) ? snapshot.invict_tasks : [],
        getDeletedTaskIds()
      );
    }
    snapshot[STORAGE_KEY_DELETED_TASKS] = getDeletedTaskIds();

    // Before pushing, check if remote version is ahead of lastServerVersion so we never overwrite another colleague's tasks
    try {
      const { data: headRow } = await supabase
        .from('invict_cloud_state')
        .select('version')
        .eq('id', 'global_state')
        .maybeSingle();

      const remoteVer = Number(headRow?.version || 0);
      if (remoteVer > lastServerVersion) {
        const { data: fullRow } = await supabase
          .from('invict_cloud_state')
          .select('version, state')
          .eq('id', 'global_state')
          .maybeSingle();

        if (fullRow?.state) {
          const remoteDeleted = Array.isArray(fullRow.state[STORAGE_KEY_DELETED_TASKS])
            ? fullRow.state[STORAGE_KEY_DELETED_TASKS]
            : [];
          if (remoteDeleted.length > 0) {
            markTaskIdsDeleted(remoteDeleted);
          }
          snapshot[STORAGE_KEY_DELETED_TASKS] = getDeletedTaskIds();

          if (Array.isArray(fullRow.state.invict_tasks)) {
            const mergedTasks = mergeTaskLists(
              snapshot.invict_tasks || [],
              fullRow.state.invict_tasks,
              snapshot[STORAGE_KEY_DELETED_TASKS]
            );
            snapshot.invict_tasks = mergedTasks;
            try {
              localStorage.setItem('invict_tasks', JSON.stringify(mergedTasks));
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore pre-check network error and proceed with upsert
    }

    // Strip huge duplicate objects from event to keep egress and database row tiny
    const lightweightEvent = event
      ? {
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          authorName: event.authorName,
          authorProfile: event.authorProfile,
          authorEmail: event.authorEmail,
          summary: event.summary,
        }
      : null;

    // 1. Atomic RPC upsert directly to Supabase Postgres
    try {
      const { data, error } = await supabase.rpc('upsert_invict_cloud_state', {
        p_client_id: CLIENT_INSTANCE_ID,
        p_last_event: lightweightEvent,
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
          keepalive: true,
          body: JSON.stringify({
            clientId: CLIENT_INSTANCE_ID,
            event: lightweightEvent,
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

    // 2. Broadcast lightweight notification via Supabase Realtime channel for sub-100ms instant delivery
    if (lightweightEvent) {
      try {
        supabase.channel('invict-realtime-sync').send({
          type: 'broadcast',
          event: 'cloud_mutation',
          payload: { clientId: CLIENT_INSTANCE_ID, event: lightweightEvent },
        });
      } catch {
        // ignore
      }
    }
  } finally {
    isPushInFlight = false;
    if (queuedPushAfterFlight) {
      queuedPushAfterFlight = false;
      const nextEvt = pendingRemoteEvent;
      const nextSnap = pendingSnapshot || collectLocalSharedState();
      pendingRemoteEvent = undefined;
      pendingSnapshot = undefined;
      void executePushToRemote(nextEvt, nextSnap);
    }
  }
}

export function pushStateToRemote(event?: CloudSyncPayload, stateSnapshot?: Record<string, any>) {
  pendingRemoteEvent = event;
  pendingSnapshot = stateSnapshot || collectLocalSharedState();

  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
    pushDebounceTimer = null;
  }

  // Task mutations push immediately (0ms delay) so refreshing or closing right after saving never loses tasks
  if (event?.type === 'TASK_MUTATION') {
    const evt = pendingRemoteEvent;
    const snap = pendingSnapshot;
    pendingRemoteEvent = undefined;
    pendingSnapshot = undefined;
    void executePushToRemote(evt, snap);
    return;
  }

  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    const evt = pendingRemoteEvent;
    const snap = pendingSnapshot;
    pendingRemoteEvent = undefined;
    pendingSnapshot = undefined;
    void executePushToRemote(evt, snap);
  }, 150);
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
      if (type === 'TASK_MUTATION' && Array.isArray(data)) {
        // Automatically detect any removed task IDs so deleted tasks are never resurrected during merge
        try {
          const prevRaw = localStorage.getItem('invict_tasks');
          if (prevRaw) {
            const prevTasks: any[] = JSON.parse(prevRaw);
            const newIdSet = new Set(data.map((t: any) => t?.id).filter(Boolean));
            const removedIds = prevTasks
              .map((t: any) => t?.id)
              .filter((id: any) => typeof id === 'string' && !newIdSet.has(id));
            if (removedIds.length > 0) {
              markTaskIdsDeleted(removedIds);
            }
          }
        } catch {
          // ignore
        }
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

  // Obsoleto: el acceso se valida por usuario con userCredentialsService.verifyPersonaPassword.
  void accountEmail;
  return inputPassword === activePassword || inputPassword === defaultPassword;
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
  // Las contraseñas son individuales por usuario (ver userCredentialsService); no se guardan en el puesto.
  void initialPassword;
  const augmented = { ...post };
  current.push(augmented);
  localStorage.setItem(STORAGE_KEY_CUSTOM_POSTS, JSON.stringify(current));
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
