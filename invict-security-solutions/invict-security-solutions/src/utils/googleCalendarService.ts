/**
 * Google Calendar Integration Service for INVICT Security
 * Implements client-side Firebase Auth with in-memory OAuth token caching,
 * Google Calendar v3 API fetching, event creation, and task synchronization.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Task, GoogleCalendarEvent, AreaType } from '../types';

// 1. Initialize Firebase App and Auth once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 2. Configure Google Provider with required Calendar scopes
const calendarProvider = new GoogleAuthProvider();
calendarProvider.addScope('https://www.googleapis.com/auth/calendar');
calendarProvider.addScope('https://www.googleapis.com/auth/calendar.events');

// In-memory token cache (strictly NO localStorage or sessionStorage as required by skill)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initialize Google Auth listener. Clears memory token on logout.
 */
export const initGoogleCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google using popup
 */
export const signInWithGoogleCalendar = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, calendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso para Google Calendar.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error de autenticación con Google Calendar:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get in-memory access token
 */
export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Set in-memory token (e.g. after fresh login)
 */
export const setCalendarAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out from Google
 */
export const signOutGoogleCalendar = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Fetch events from the user's primary Google Calendar for a date range
 */
export const fetchGoogleCalendarEvents = async (
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> => {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('No autenticado en Google Calendar. Inicie sesión primero.');
  }

  const params = new URLSearchParams();
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);
  params.append('singleEvents', 'true');
  params.append('orderBy', 'startTime');
  params.append('maxResults', '100');

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Sesión de Google Calendar expirada. Por favor inicie sesión nuevamente.');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Error al obtener eventos de Google Calendar (${res.status})`);
  }

  const data = await res.json();
  const items = data.items || [];
  return items.map((item: any) => ({
    id: item.id,
    summary: item.summary || '(Sin título)',
    description: item.description || '',
    start: item.start || {},
    end: item.end || {},
    htmlLink: item.htmlLink,
    location: item.location || '',
    isInvictTask: (item.description || '').includes('INVICT Security') || (item.summary || '').startsWith('[INVICT'),
  }));
};

/**
 * Create an event in the user's primary Google Calendar
 */
export const createGoogleCalendarEvent = async (eventPayload: {
  summary: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  location?: string;
}): Promise<GoogleCalendarEvent> => {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('No autenticado en Google Calendar.');
  }

  const { summary, description, startDate, endDate, startTime, endTime, location } = eventPayload;

  let startObj: any = {};
  let endObj: any = {};

  if (startTime && endTime) {
    startObj = { dateTime: `${startDate}T${startTime}:00-03:00`, timeZone: 'America/Argentina/Mendoza' };
    endObj = { dateTime: `${endDate || startDate}T${endTime}:00-03:00`, timeZone: 'America/Argentina/Mendoza' };
  } else {
    // All-day event
    startObj = { date: startDate };
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    endObj = { date: endDate || nextDayStr };
  }

  const body = {
    summary,
    description,
    start: startObj,
    end: endObj,
    location: location || 'Mendoza, Argentina - Base Central INVICT Security',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Error al crear evento en Google Calendar (${res.status})`);
  }

  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    description: created.description,
    start: created.start,
    end: created.end,
    htmlLink: created.htmlLink,
    location: created.location,
    isInvictTask: true,
  };
};

/**
 * Delete an event from Google Calendar
 */
export const deleteGoogleCalendarEvent = async (eventId: string): Promise<void> => {
  const token = cachedAccessToken;
  if (!token) throw new Error('No autenticado en Google Calendar.');
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Error al eliminar evento de Google Calendar (${res.status})`);
  }
};

/**
 * Convert an INVICT task to Google Calendar Event payload
 */
export const buildEventPayloadFromTask = (task: Task) => {
  const priorityPrefix = task.priority === 'Urgente' ? '🚨 [URGENTE] ' : '';
  const areaLabel = task.area === 'RRHH' ? 'RR.HH.' : task.area;
  const summary = `${priorityPrefix}[INVICT - ${areaLabel}] ${task.title}`;
  const description = [
    `🛡️ INVICT Security - Tarea de Oficina Central`,
    `----------------------------------------`,
    `🏢 Área: ${areaLabel}`,
    `👤 Responsable Asignado: ${task.assignee} ${task.assigneeEmail ? `(${task.assigneeEmail})` : ''}`,
    `⚡ Prioridad: ${task.priority}`,
    `📌 Naturaleza: ${task.nature || 'Fija Mensual'}`,
    `🚦 Estado: ${task.status}`,
    `📅 Período: ${task.monthPeriod || '2026-10'}`,
    task.notes ? `\n📝 Notas / Instrucciones:\n${task.notes}` : '',
    `\n-- Sincronizado automáticamente por el panel de gestión INVICT Security --`
  ].filter(Boolean).join('\n');

  let targetDate = task.dueDate;
  if (!targetDate && task.startDate) targetDate = task.startDate;
  if (!targetDate) targetDate = '2026-10-15';

  if (targetDate.includes('/')) {
    const parts = targetDate.split('/');
    targetDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return {
    summary,
    description,
    startDate: targetDate,
    endDate: targetDate,
    location: 'Oficina Central INVICT Security',
  };
};
