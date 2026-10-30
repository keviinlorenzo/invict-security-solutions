import { UserPersona, UserProfileType, AreaType, Task } from '../types';

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
  type:
    | 'TASK_MUTATION'
    | 'EXPENSE_MUTATION'
    | 'LEGAL_MUTATION'
    | 'POST_ADDED'
    | 'POST_DELETED'
    | 'POST_UPDATED'
    | 'PASSWORD_UPDATED'
    | 'GENERIC_SYNC';
  timestamp: string;
  authorName: string;
  authorProfile: string;
  authorEmail: string;
  summary: string;
  data?: any;
}

// Singleton BroadcastChannel for real-time cloud communications
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

if (cloudChannel) {
  cloudChannel.onmessage = (event: MessageEvent<CloudSyncPayload>) => {
    if (event.data) {
      subscribers.forEach(cb => {
        try {
          cb(event.data);
        } catch (err) {
          console.error('Error invoking cloud sync subscriber', err);
        }
      });
    }
  };
}

// Storage event listener for fallback cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'invict_cloud_broadcast_event' && e.newValue) {
      try {
        const payload: CloudSyncPayload = JSON.parse(e.newValue);
        subscribers.forEach(cb => cb(payload));
      } catch (err) {
        // ignore
      }
    }
  });
}

export function subscribeToCloudSync(callback: SyncCallback): () => void {
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
  const payload: CloudSyncPayload = {
    type,
    timestamp: new Date().toISOString(),
    authorName: author.name,
    authorProfile: author.profile,
    authorEmail: author.email,
    summary,
    data,
  };

  // Broadcast via Channel
  if (cloudChannel) {
    try {
      cloudChannel.postMessage(payload);
    } catch (e) {
      console.warn('Failed to post to cloud channel', e);
    }
  }

  // Broadcast via localStorage storage event
  try {
    localStorage.setItem('invict_cloud_broadcast_event', JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
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

  // No universal backdoor: each account must be authenticated with its legitimate password
  // 1. Direct active password check for this profile
  if (inputPassword === activePassword) return true;

  // 2. Default profile initial password (only valid if not altered)
  if (inputPassword === defaultPassword) return true;

  // 3. Custom workplace post password
  try {
    const customPosts = getCustomPosts();
    const matchedPost = customPosts.find(p => p.email.toLowerCase() === (accountEmail || '').toLowerCase());
    if (matchedPost && (matchedPost as any).customPassword) {
      if (inputPassword === (matchedPost as any).customPassword) return true;
    }
  } catch (e) {}

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
  // 1. Update in main invict_personas localStorage
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

  // 2. Also keep custom posts array in sync
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
