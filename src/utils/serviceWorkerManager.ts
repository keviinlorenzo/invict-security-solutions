import { Task } from '../types';

let deferredInstallPrompt: any = null;
const installListeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach(cb => cb(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach(cb => cb(false));
  });
}

export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(!!deferredInstallPrompt);
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptInstallPWA(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredInstallPrompt) {
    return 'unsupported';
  }
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installListeners.forEach(cb => cb(false));
    return outcome;
  } catch (err) {
    console.error('Error prompting PWA install:', err);
    return 'unsupported';
  }
}

export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  // Purge legacy service worker caches that previously cached Supabase GET responses
  try {
    if ('caches' in window) {
      window.caches.keys().then((keys) => {
        keys.forEach((k) => {
          if (k !== 'invict-cache-v8') {
            void window.caches.delete(k);
          }
        });
      });
    }
  } catch {
    // ignore
  }
  return navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      try {
        void registration.update();
      } catch {
        // ignore
      }
      return registration;
    })
    .catch((err) => {
      console.warn('[SW Registration Error]:', err);
      return null;
    });
}

export function listenToServiceWorkerMessages(onNavigateToTask: (taskId: string) => void): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }
  const handler = (event: MessageEvent) => {
    if (!event.data) return;
    if (event.data.type === 'NAVIGATE_TO_TASK' && event.data.taskId) {
      onNavigateToTask(event.data.taskId);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

export function syncTasksToServiceWorker(urgentTasks: Task[]): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SYNC_URGENT_TASKS',
      payload: {
        tasks: urgentTasks.map(t => ({
          id: t.id,
          title: t.title,
          area: t.area,
          dueDate: t.dueDate,
          assignee: t.assignee,
        })),
      },
    });
  }
}

export function isServiceWorkerActive(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }
  return navigator.serviceWorker.getRegistration().then((reg) => {
    return !!(reg && (reg.active || reg.installing || reg.waiting));
  });
}
