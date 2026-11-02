import { Task, InternalMessage, UserPersona } from '../types';
import { calculateDaysRemaining } from './dateUtils';
import { sendEmailAlertForMention } from './emailAlertService';
import { USER_PERSONAS } from '../data/mockData';

const NOTIFICATIONS_ENABLED_KEY = 'invict_web_notifications_enabled';
const NOTIFIED_TASKS_KEY = 'invict_notified_tasks_ids';
const NOTIFIED_MESSAGES_KEY = 'invict_notified_messages_ids';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export const getNotificationPermissionState = getNotificationPermission;

export function isServiceWorkerAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'denied';
  }
}

export function areWebNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

export function setWebNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}

function getNotifiedIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const saved = localStorage.getItem(key);
  if (!saved) return new Set();
  try {
    return new Set(JSON.parse(saved));
  } catch (e) {
    return new Set();
  }
}

function saveNotifiedIds(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function showNativeNotification(title: string, options: NotificationOptions, taskId?: string): void {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_PERSISTENT_NOTIFICATION',
      payload: {
        title,
        options: {
          ...options,
          data: {
            taskId: taskId || null,
          },
        },
      },
    });
    return;
  }
  try {
    new Notification(title, options);
  } catch (e) {
    console.warn('[Notification API Fallback Warning]:', e);
  }
}

export function triggerPersistentNotification(
  title: string,
  body: string,
  tag = 'invict-notification',
  url = '/'
): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') {
    return false;
  }
  showNativeNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    requireInteraction: true,
  });
  return true;
}

export function checkAndTriggerDeadlineNotifications(tasks: Task[]): void {
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted' || !areWebNotificationsEnabled()) {
    return;
  }

  const notifiedTasks = getNotifiedIds(NOTIFIED_TASKS_KEY);

  tasks.forEach((task) => {
    if (task.status === 'Completada') return;
    const { days, status, label } = calculateDaysRemaining(task.dueDate, task.completedDate);
    const isUrgent = days <= 1 || status === 'vencida' || status === 'urgente_48h';
    if (isUrgent && !notifiedTasks.has(task.id)) {
      const title = status === 'vencida'
        ? `🚨 INVICT: Tarea Vencida - ${task.title}`
        : `⚠️ INVICT: Vence en menos de 24hs - ${task.title}`;
      const body = `Área: ${task.area} | Responsable: ${task.assignee}\nLímite: ${task.dueDate} (${label})`;
      showNativeNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `task-${task.id}`,
        requireInteraction: true,
      }, task.id);
      notifiedTasks.add(task.id);
    }
  });

  saveNotifiedIds(NOTIFIED_TASKS_KEY, notifiedTasks);
}

export function notifySingleMention(
  newMessage: InternalMessage,
  currentPersona: UserPersona,
  allPersonas: UserPersona[] = USER_PERSONAS,
  taskTitle?: string
): void {
  newMessage.mentions.forEach(mentionedEmail => {
    sendEmailAlertForMention(newMessage, mentionedEmail, allPersonas, taskTitle);
  });
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted' || !areWebNotificationsEnabled()) {
    return;
  }
  const isMentioned =
    newMessage.mentions.includes(currentPersona.email) ||
    (currentPersona.department === 'GERENCIA' && newMessage.mentions.includes('consultasinvictsolutionss.a@gmail.com'));
  if (isMentioned && newMessage.authorEmail !== currentPersona.email) {
    showNativeNotification(`🔔 Mención de ${newMessage.authorName} (${newMessage.authorRole})`, {
      body: newMessage.content,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `msg-${newMessage.id}`,
      requireInteraction: true,
    });
  }
}
