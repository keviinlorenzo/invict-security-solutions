/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Task,
  Expense,
  InternalMessage,
  UserPersona,
  AreaType,
  TaskStatus,
  TaskModification,
  GoogleCalendarEvent
} from './types';
import {
  INITIAL_TASKS,
  INITIAL_EXPENSES,
  INITIAL_MESSAGES,
  isOldOrTestMessage,
  USER_PERSONAS
} from './data/mockData';
import { Lock, AtSign, ArrowRight } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TasksMatrixView } from './components/TasksMatrixView';
import { AdminInformativeSheetsView } from './components/AdminInformativeSheetsView';
import { ExecutiveReportsView } from './components/ExecutiveReportsView';
import { ExpensesView } from './components/ExpensesView';
import { InvictFeedView } from './components/InvictFeedView';
import { GerencialMetricsAndStatisticsView } from './components/GerencialMetricsAndStatisticsView';
import { FooterWatermark } from './components/FooterWatermark';
import { PersonnelManagementModal } from './components/PersonnelManagementModal';
import { EmailAlertsDrawer } from './components/EmailAlertsDrawer';
import { ExportReportModal } from './components/ExportReportModal';
import { ProfileSwitcherModal } from './components/ProfileSwitcherModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewTaskModal } from './components/NewTaskModal';
import { NewExpenseModal } from './components/NewExpenseModal';
import { CalendarView } from './components/CalendarView';
import { GoogleCalendarConfirmModal } from './components/GoogleCalendarConfirmModal';
import { GoogleCalendarSyncModal } from './components/GoogleCalendarSyncModal';
import { LoginScreen } from './components/LoginScreen';
import { setPersonaPassword, removePersonaCredential } from './utils/userCredentialsService';
import { BonoChatAssistant } from './components/BonoChatAssistant';
import { DesktopPwaInstallModal } from './components/DesktopPwaInstallModal';
import { MobileNavBar } from './components/MobileNavBar';
import {
  AuthSession,
  getStoredSession,
  storeSession,
  clearStoredSession,
  formatModificationTimestamp,
  determineProfileFromEmail
} from './utils/authService';
import {
  DEFAULT_PERIOD,
  formatPeriodName,
  formatCurrentFullDate,
  getTodayDateString,
  getAdjacentPeriod
} from './utils/dateUtils';
import {
  ensureMonthHasFixedTasks,
  renewMonthFixedTasks,
  buildWeeklyTaskInstancesForMonth,
  renewWeeklyFixedTasksForPeriod,
  getDayOfWeekLabel,
  getMonthlyTaskSeriesKey,
  setMonthlyTaskStopped
} from './utils/monthRenewalService';
import { resetMonthDataToZero } from './data/managerialSheetsData';
import { getEmailNotificationLogs } from './utils/emailAlertService';
import { registerServiceWorker } from './utils/serviceWorkerManager';
import { checkAndTriggerDeadlineNotifications } from './utils/notificationService';
import { exportTasksToCSV } from './utils/exportUtils';
import { exportTasksToPDF } from './utils/pdfExportUtils';
import {
  initGoogleCalendarAuth,
  signInWithGoogleCalendar,
  signOutGoogleCalendar,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  buildEventPayloadFromTask,
  getCalendarAccessToken
} from './utils/googleCalendarService';
import {
  subscribeToCloudSync,
  broadcastCloudChange,
  getCustomPosts,
  getDeletedPostIds,
  saveNewCustomPost,
  deleteWorkplacePost,
  updateWorkplacePost
} from './utils/cloudSyncService';
import { User } from 'firebase/auth';

export default function App() {
  // 1. Core State with LocalStorage Persistence
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('invict_tasks');
    const base = saved ? JSON.parse(saved) : INITIAL_TASKS;
    return ensureMonthHasFixedTasks(DEFAULT_PERIOD, base);
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('invict_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [messages, setMessages] = useState<InternalMessage[]>(() => {
    const saved = localStorage.getItem('invict_messages');
    let list: InternalMessage[] = saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    const cleanList = list.filter(m => !isOldOrTestMessage(m));
    if (saved && cleanList.length !== list.length) {
      localStorage.setItem('invict_messages', JSON.stringify(cleanList));
    }
    return cleanList;
  });

  const [personas, setPersonas] = useState<UserPersona[]>(() => {
    const saved = localStorage.getItem('invict_personas');
    let list: UserPersona[] = saved ? JSON.parse(saved) : [...USER_PERSONAS];
    const custom = getCustomPosts();
    const deleted = getDeletedPostIds();
    custom.forEach(cp => {
      if (!list.some(p => p.id === cp.id)) list.push(cp);
    });
    return list.filter(p => !deleted.includes(p.id));
  });

  const [currentPersona, setCurrentPersona] = useState<UserPersona>(() => {
    const savedId = localStorage.getItem('invict_active_persona_id');
    const list = localStorage.getItem('invict_personas') ? JSON.parse(localStorage.getItem('invict_personas')!) : USER_PERSONAS;
    return list.find((p: UserPersona) => p.id === savedId) || list[0];
  });

  const [currentPeriod, setCurrentPeriod] = useState<string>(() => {
    // Siempre abrir en el mes real actual (no en el último mes guardado)
    return DEFAULT_PERIOD;
  });

  // Detectar cambio de día (app abierta de un día para otro) y recargar con la fecha real
  useEffect(() => {
    const loadedDate = getTodayDateString();
    const id = setInterval(() => {
      if (getTodayDateString() !== loadedDate) window.location.reload();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [selectedArea, setSelectedArea] = useState<AreaType>(() => {
    const savedId = localStorage.getItem('invict_active_persona_id');
    const list = localStorage.getItem('invict_personas') ? JSON.parse(localStorage.getItem('invict_personas')!) : USER_PERSONAS;
    const active = list.find((p: UserPersona) => p.id === savedId) || list[0];
    return (active?.department as AreaType) || 'TODOS';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Email alerts state
  const [emailLogs, setEmailLogs] = useState(() => getEmailNotificationLogs());

  // Modals state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [isEmailAlertsModalOpen, setIsEmailAlertsModalOpen] = useState(false);
  const [isDesktopPwaModalOpen, setIsDesktopPwaModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);

  // Google Calendar Integration State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isCalendarSyncModalOpen, setIsCalendarSyncModalOpen] = useState(false);

  // User Confirmation Dialog State for Google Workspace mutations
  const [calendarConfirmModal, setCalendarConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    actionDescription: string;
    itemCount?: number;
    itemsList?: string[];
    dateInfo?: string;
    isDestructive?: boolean;
    userEmail?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    actionDescription: '',
    onConfirm: () => {},
  });

  // Auth Session State
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    return getStoredSession();
  });

  // Cloud Shared File Modifications
  const [cloudModifications, setCloudModifications] = useState<TaskModification[]>(() => {
    const saved = localStorage.getItem('invict_cloud_modifications');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [
      {
        id: 'mod-1',
        timestamp: new Date().toISOString(),
        formattedDate: formatModificationTimestamp(new Date()),
        userId: 'p-kevin',
        userName: 'Kevin',
        userEmail: 'kevin@invictsecurity.com.ar',
        userProfile: 'operaciones',
        actionDescription: 'Sincronización operativa en tiempo real',
        details: 'Control de rondas y supervisión de objetivos.',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('invict_cloud_modifications', JSON.stringify(cloudModifications));
  }, [cloudModifications]);

  useEffect(() => {
    localStorage.setItem('invict_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Real-time Cloud Synchronization Listener
  useEffect(() => {
    const unsubscribe = subscribeToCloudSync((payload) => {
      if (payload.authorEmail && payload.authorEmail !== '__initial__' && payload.authorEmail !== currentPersona.email) {
        if (payload.summary && payload.summary.includes('mensaje directo privado a')) {
          const recipientMatch = payload.summary.match(/mensaje directo privado a (.+)$/);
          const targetRecipientName = recipientMatch ? recipientMatch[1].trim().toLowerCase() : '';
          const myName = currentPersona.name.toLowerCase();
          if (targetRecipientName && (myName.includes(targetRecipientName) || targetRecipientName.includes(myName))) {
            showToast(`🔒 ${payload.summary}`);
          }
        } else {
          showToast(`⚡ ${payload.summary}`);
        }
      }
      if (payload.stateSnapshot) {
        if (Array.isArray(payload.stateSnapshot.invict_tasks)) {
          setTasks(payload.stateSnapshot.invict_tasks);
        }
        if (Array.isArray(payload.stateSnapshot.invict_expenses)) {
          setExpenses(payload.stateSnapshot.invict_expenses);
        }
        if (Array.isArray(payload.stateSnapshot.invict_messages)) {
          setMessages(payload.stateSnapshot.invict_messages.filter(m => !isOldOrTestMessage(m)));
        }
        if (Array.isArray(payload.stateSnapshot.invict_personas)) {
          setPersonas(payload.stateSnapshot.invict_personas);
        }
        if (Array.isArray(payload.stateSnapshot.invict_cloud_modifications)) {
          setCloudModifications(payload.stateSnapshot.invict_cloud_modifications);
        }
      }
      if (payload.type === 'TASK_MUTATION' && payload.data) {
        setTasks(payload.data);
      } else if (payload.type === 'EXPENSE_MUTATION' && payload.data) {
        setExpenses(payload.data);
      } else if (payload.type === 'MESSAGE_MUTATION' && payload.data) {
        const cleanData = Array.isArray(payload.data) ? payload.data.filter(m => !isOldOrTestMessage(m)) : payload.data;
        setMessages(cleanData);
      } else if (payload.type === 'POST_ADDED' && payload.data) {
        setPersonas(prev => {
          if (prev.some(p => p.id === payload.data.id)) return prev;
          return [...prev, payload.data];
        });
      } else if (payload.type === 'POST_DELETED' && payload.data) {
        setPersonas(prev => prev.filter(p => p.id !== payload.data.postId));
      } else if (payload.type === 'POST_UPDATED' && payload.data) {
        setPersonas(prev => prev.map(p => p.id === payload.data.id ? payload.data : p));
      }
    });
    return () => unsubscribe();
  }, [currentPersona]);

  // Cloud modification logger helper
  const logCloudModification = (
    actionDescription: string,
    details?: string,
    taskTitle?: string
  ): TaskModification => {
    const formatted = formatModificationTimestamp(new Date());
    const profile = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const mod: TaskModification = {
      id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      formattedDate: formatted,
      userId: currentPersona.id,
      userName: currentPersona.name,
      userEmail: currentPersona.email,
      userProfile: profile,
      actionDescription: taskTitle ? `${actionDescription}: "${taskTitle}"` : actionDescription,
      details,
    };
    setCloudModifications(prev => [mod, ...prev]);
    return mod;
  };

  const handleLoginSuccess = (user: UserPersona) => {
    const session: AuthSession = {
      user,
      token: 'invict-token-' + Date.now(),
      loginTime: new Date().toISOString(),
    };
    storeSession(session);
    setAuthSession(session);
    setCurrentPersona(user);
    setSelectedArea((user.department as AreaType) || 'TODOS');
    const isUserGerencia = user.department === 'GERENCIA' || user.profileType === 'GERENTE';
    if (!isUserGerencia && activeTab === 'dashboard') {
      setActiveTab('tasks');
    }
    logCloudModification(
      'Inició sesión en la nube',
      `Acceso registrado con perfil: ${user.profileType || 'operaciones'}`
    );
    showToast(`Bienvenido/a, ${user.name}. Perfil activo: ${user.profileType || user.role}`);
  };

  const handleLogout = () => {
    logCloudModification(
      'Cerró sesión corporativa',
      `Usuario: ${currentPersona.name} (${currentPersona.profileType || 'operaciones'})`
    );
    clearStoredSession();
    setAuthSession(null);
    showToast('Sesión finalizada. Ingrese con sus credenciales.');
  };

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('invict_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('invict_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('invict_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('invict_personas', JSON.stringify(personas));
  }, [personas]);

  useEffect(() => {
    localStorage.setItem('invict_active_persona_id', currentPersona.id);
  }, [currentPersona]);

  useEffect(() => {
    localStorage.setItem('invict_current_period', currentPeriod);
  }, [currentPeriod]);

  // Service Worker and Deadline Notification checks on mount
  useEffect(() => {
    registerServiceWorker();
    checkAndTriggerDeadlineNotifications(tasks);
  }, []);

  // Google Calendar Auth Listener
  useEffect(() => {
    const unsubscribe = initGoogleCalendarAuth(
      (user, token) => {
        setGoogleUser(user);
        loadGoogleCalendarEvents(currentPeriod);
      },
      () => {
        setGoogleUser(null);
        setGoogleEvents([]);
      }
    );
    return () => unsubscribe();
  }, [currentPeriod]);

  const loadGoogleCalendarEvents = async (periodStr: string) => {
    const token = getCalendarAccessToken();
    if (!token) return;
    try {
      const [year, month] = periodStr.split('-');
      const timeMin = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
      const timeMax = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
      const events = await fetchGoogleCalendarEvents(timeMin, timeMax);
      setGoogleEvents(events);
    } catch (err: any) {
      console.warn('Error loading Google Calendar events:', err.message);
    }
  };

  const handleSignInGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogleCalendar();
      if (result) {
        setGoogleUser(result.user);
        showToast(`Google Calendar conectado exitosamente como ${result.user.email}`);
        await loadGoogleCalendarEvents(currentPeriod);
      }
    } catch (err: any) {
      showToast(`Error al iniciar sesión con Google: ${err.message || 'Operación cancelada'}`);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutGoogleCalendar();
      setGoogleUser(null);
      setGoogleEvents([]);
      showToast('Desconectado de Google Calendar');
    } catch (err: any) {
      showToast('Error al cerrar sesión de Google Calendar');
    }
  };

  const handleRequestSyncTaskToGoogle = (task: Task) => {
    if (!googleUser) {
      showToast('Debe conectar su cuenta de Google Calendar primero.');
      return;
    }
    setCalendarConfirmModal({
      isOpen: true,
      title: 'Crear Evento en Google Calendar',
      actionDescription: `Se programará el evento "${task.title}" en su cuenta de Google Calendar con recordatorio para la fecha de entrega.`,
      itemsList: [`[${task.area}] ${task.title} - Vence: ${task.dueDate} (${task.assignee})`],
      dateInfo: task.dueDate,
      userEmail: googleUser.email || undefined,
      onConfirm: async () => {
        try {
          const payload = buildEventPayloadFromTask(task);
          const created = await createGoogleCalendarEvent(payload);
          const nowIso = new Date().toISOString();
          const updatedTasks = tasks.map(t => t.id === task.id ? {
            ...t,
            googleEventId: created.id,
            googleSyncedAt: nowIso,
          } : t);
          setTasks(updatedTasks);
          broadcastCloudChange(
            'TASK_MUTATION',
            `Sincronizó la tarea "${task.title}" con Google Calendar`,
            { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
            updatedTasks
          );
          showToast(`Evento "${task.title}" agregado a Google Calendar.`);
          await loadGoogleCalendarEvents(currentPeriod);
        } catch (err: any) {
          showToast(`Error al sincronizar con Google Calendar: ${err.message}`);
        }
      },
    });
  };

  const handleRequestSyncAllPeriodTasks = (tasksToSync: Task[]) => {
    if (!googleUser) {
      showToast('Debe conectar su cuenta de Google Calendar primero.');
      return;
    }
    if (tasksToSync.length === 0) {
      showToast('No hay tareas para sincronizar.');
      return;
    }
    setCalendarConfirmModal({
      isOpen: true,
      title: `Sincronizar ${tasksToSync.length} Tareas a Google Calendar`,
      actionDescription: `Se crearán ${tasksToSync.length} eventos en su Google Calendar corporativo correspondientes a la planificación de ${formatPeriodName(currentPeriod)}.`,
      itemCount: tasksToSync.length,
      itemsList: tasksToSync.slice(0, 8).map(t => `[${t.area}] ${t.title} (${t.dueDate})`),
      userEmail: googleUser.email || undefined,
      onConfirm: async () => {
        let syncedCount = 0;
        const nowIso = new Date().toISOString();
        for (const task of tasksToSync) {
          try {
            const payload = buildEventPayloadFromTask(task);
            const created = await createGoogleCalendarEvent(payload);
            setTasks(prev => prev.map(t => t.id === task.id ? {
              ...t,
              googleEventId: created.id,
              googleSyncedAt: nowIso,
            } : t));
            syncedCount++;
          } catch (e) {
            console.error('Error syncing individual task:', task.title, e);
          }
        }
        showToast(`${syncedCount} tareas de ${formatPeriodName(currentPeriod)} sincronizadas a Google Calendar.`);
        await loadGoogleCalendarEvents(currentPeriod);
      },
    });
  };

  const handlePeriodChange = (newPeriod: string) => {
    setCurrentPeriod(newPeriod);
    const updated = ensureMonthHasFixedTasks(newPeriod, tasks);
    if (updated.length !== tasks.length) {
      setTasks(updated);
    }
  };

  const handleResetFixedTasks = () => {
    const updated = renewMonthFixedTasks(currentPeriod, tasks);
    setTasks(updated);
    broadcastCloudChange(
      'TASK_MUTATION',
      `Renovó tareas fijas de ${formatPeriodName(currentPeriod)}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast(`Tareas fijas mensuales y semanales renovadas para ${formatPeriodName(currentPeriod)}`);
  };

  const handleRenewWeeklyNextMonth = () => {
    const nextPeriod = getAdjacentPeriod(currentPeriod, 1);
    const { updatedTasks, addedCount, seriesCount } = renewWeeklyFixedTasksForPeriod(tasks, nextPeriod);
    if (seriesCount === 0) {
      showToast('No hay tareas Fijas Semanales activas registradas para renovar al mes siguiente.');
      return;
    }
    setTasks(updatedTasks);
    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} renovó las tareas Fijas Semanales para ${formatPeriodName(nextPeriod)}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updatedTasks
    );
    if (addedCount > 0) {
      showToast(
        `¡Se renovaron ${seriesCount} serie(s) Fija Semanal (${addedCount} tareas semanales) para todas las semanas de ${formatPeriodName(nextPeriod)}!`
      );
    } else {
      showToast(
        `Las tareas Fijas Semanales ya están todas agendadas en las semanas de ${formatPeriodName(nextPeriod)}.`
      );
    }
  };

  // Limpia todo lo cargado/hablado en el mes seleccionado (tareas, gastos, mensajes,
  // chats con BONO, planillas gerenciales e historial de cambios) y deja las tareas fijas.
  const handleClearMonth = () => {
    const label = formatPeriodName(currentPeriod);
    if (!window.confirm(`¿Limpiar TODO lo realizado en ${label}?\n\nSe borrarán tareas, gastos, mensajes, chats con BONO y planillas del mes. Esta acción no se puede deshacer.`)) return;
    const [py, pm] = currentPeriod.split('-');
    const inPeriod = (d?: string) => !!d && (d.startsWith(currentPeriod) || d.includes(`/${pm}/${py}`));
    const updatedTasks = renewMonthFixedTasks(currentPeriod, tasks);
    setTasks(updatedTasks);
    setExpenses(prev => prev.filter(e => !inPeriod(e.date)));
    setMessages(prev => prev.filter(m => !inPeriod(m.timestamp)));
    setCloudModifications([]);
    resetMonthDataToZero(currentPeriod);
    Object.keys(localStorage)
      .filter(k => k.startsWith('bono_chat_'))
      .forEach(k => localStorage.removeItem(k));
    broadcastCloudChange(
      'TASK_MUTATION',
      `Limpió todos los datos de ${label}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updatedTasks
    );
    showToast(`Se limpiaron los datos de ${label}. Recargando...`);
    setTimeout(() => window.location.reload(), 1200);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const refreshEmailLogs = () => {
    setEmailLogs(getEmailNotificationLogs());
  };

  // Personnel handlers
  const handleUpdatePersona = (updated: UserPersona) => {
    const prevPersona = personas.find(p => p.id === updated.id);
    const oldName = prevPersona?.name;
    const oldEmail = prevPersona?.email;

    // 1. Update personas list in state and localStorage
    const updatedPersonas = personas.map(p => p.id === updated.id ? updated : p);
    setPersonas(updatedPersonas);
    try {
      localStorage.setItem('invict_personas', JSON.stringify(updatedPersonas));
    } catch (e) {
      console.warn('Error saving personas to localStorage', e);
    }

    // 2. Update active user if currently viewing as that persona
    if (currentPersona.id === updated.id) {
      setCurrentPersona(updated);
      const session = getStoredSession();
      if (session && session.user.id === updated.id) {
        storeSession({ ...session, user: updated });
      }
    }

    // 3. Immediately reassign all tasks that were assigned to the old name or post
    if (oldName && oldName !== updated.name) {
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => {
          const matchAssignee = t.assignee === oldName || (oldEmail && t.assigneeEmail === oldEmail);
          const matchAreaFallback = t.area === updated.department && t.assignee.toLowerCase().includes(oldName.toLowerCase());
          if (matchAssignee || matchAreaFallback) {
            return {
              ...t,
              assignee: updated.name,
              assigneeEmail: updated.email,
            };
          }
          return t;
        });
        try {
          localStorage.setItem('invict_tasks', JSON.stringify(updatedTasks));
        } catch (e) {}
        broadcastCloudChange(
          'TASK_MUTATION',
          `Reasignación por actualización de puesto: tareas de ${oldName} transferidas a ${updated.name}`,
          { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
          updatedTasks
        );
        return updatedTasks;
      });
    }

    // 4. Update workplace post in cloud and custom store
    updateWorkplacePost(updated, {
      name: currentPersona.name,
      profile: currentPersona.profileType,
      email: currentPersona.email,
    });

    showToast(`Puesto "${updated.role}" actualizado: asignado a ${updated.name}`);
  };

  const handleAddPersona = (newPersona: UserPersona, initialPassword?: string) => {
    setPersonas(prev => [...prev, newPersona]);
    const authorInfo = {
      name: currentPersona.name,
      profile: currentPersona.profileType,
      email: currentPersona.email,
    };
    saveNewCustomPost(newPersona, '', authorInfo);
    if (initialPassword && initialPassword.trim().length >= 6) {
      void setPersonaPassword(newPersona, initialPassword.trim(), authorInfo);
    }
    showToast(`Puesto "${newPersona.role}" creado y habilitado en la plataforma.`);
  };

  const handleDeletePersona = (personaId: string) => {
    const p = personas.find(item => item.id === personaId);
    const postName = p ? p.role : personaId;
    setPersonas(prev => prev.filter(item => item.id !== personaId));
    removePersonaCredential(personaId);
    deleteWorkplacePost(personaId, postName, {
      name: currentPersona.name,
      profile: currentPersona.profileType,
      email: currentPersona.email,
    });
    showToast(`Puesto "${postName}" eliminado por Gerencia.`);
  };

  const handleReassignTasksToPersona = (area: AreaType, newAssigneeName: string) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.area === area) {
          return { ...t, assignee: newAssigneeName };
        }
        return t;
      });
      try {
        localStorage.setItem('invict_tasks', JSON.stringify(updated));
      } catch (e) {}
      broadcastCloudChange(
        'TASK_MUTATION',
        `Reasignación de todas las tareas del área ${area} a ${newAssigneeName}`,
        { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
        updated
      );
      return updated;
    });
  };

  // Task Management handlers
  const handleAddTask = (newTaskData: Omit<Task, 'id'>) => {
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);

    if (newTaskData.nature === 'Fija Semanal') {
      const mod = logCloudModification('Registró tarea Fija Semanal con repetición automática', undefined, newTaskData.title);
      const weeklyInstances = buildWeeklyTaskInstancesForMonth(
        {
          ...newTaskData,
          lastModifiedBy: {
            name: currentPersona.name,
            email: currentPersona.email,
            profile: userProf,
          },
          lastModifiedAt: formatted,
          lastModifiedAction: 'Creación de serie Fija Semanal',
          history: [mod],
        },
        currentPeriod,
        newTaskData.dueDate
      );

      const updatedTasks = [...weeklyInstances, ...tasks];
      setTasks(updatedTasks);
      broadcastCloudChange(
        'TASK_MUTATION',
        `${currentPersona.name} (${userProf}) registró la tarea Fija Semanal "${newTaskData.title}" (${weeklyInstances.length} semanas)`,
        { name: currentPersona.name, profile: userProf, email: currentPersona.email },
        updatedTasks
      );
      showToast(
        `¡Tarea Fija Semanal registrada! Se anotaron sistemáticamente ${weeklyInstances.length} semanas en ${formatPeriodName(currentPeriod)} (${getDayOfWeekLabel(weeklyInstances[0]?.weeklyDayOfWeek)}).`
      );
      return;
    }

    const mod = logCloudModification('Creó nueva tarea en la nube', undefined, newTaskData.title);
    const newTask: Task = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      lastModifiedBy: {
        name: currentPersona.name,
        email: currentPersona.email,
        profile: userProf,
      },
      lastModifiedAt: formatted,
      lastModifiedAction: 'Creación de tarea',
      history: [mod],
    };
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} (${userProf}) creó la tarea "${newTask.title}"`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );
    showToast(`Tarea creada por ${currentPersona.name} en el archivo compartido`);
  };

  const handleToggleMonthlyRecurrence = (targetTask: Task, stopRecurrence: boolean) => {
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const taskPeriod = targetTask.monthPeriod || currentPeriod;
    const targetKey = getMonthlyTaskSeriesKey(targetTask.area, targetTask.title);
    const actionDesc = stopRecurrence
      ? `Frenó la repetición mensual desde ${formatPeriodName(taskPeriod)} en adelante`
      : 'Reactivó la repetición mensual';
    const mod = logCloudModification(actionDesc, undefined, targetTask.title);

    // Guardar en almacenamiento persistente sincronizado a partir del mes siguiente (para que deje de repetirse de aquí en adelante)
    const nextPeriod = getAdjacentPeriod(taskPeriod, 1);
    setMonthlyTaskStopped(targetTask.area, targetTask.title, stopRecurrence ? nextPeriod : null);

    let updatedTasks = tasks;

    if (stopRecurrence) {
      // Retirar ocurrencias futuras pendientes (de meses posteriores al actual) y marcar la tarea actual como frenada
      updatedTasks = tasks
        .filter(t => {
          if (
            (t.nature || 'Fija Mensual') === 'Fija Mensual' &&
            getMonthlyTaskSeriesKey(t.area, t.title) === targetKey &&
            (t.monthPeriod || '2026-10') > taskPeriod &&
            t.status !== 'Completada'
          ) {
            return false;
          }
          return true;
        })
        .map(t => {
          if (
            (t.nature || 'Fija Mensual') === 'Fija Mensual' &&
            getMonthlyTaskSeriesKey(t.area, t.title) === targetKey &&
            (t.monthPeriod || '2026-10') >= taskPeriod
          ) {
            return {
              ...t,
              monthlyRecurrenceStopped: true,
              monthlyStoppedFromPeriod: nextPeriod,
              lastModifiedBy: {
                name: currentPersona.name,
                email: currentPersona.email,
                profile: userProf,
              },
              lastModifiedAt: formatted,
              lastModifiedAction: actionDesc,
              history: [mod, ...(t.history || [])],
            };
          }
          return t;
        });
    } else {
      updatedTasks = tasks.map(t => {
        if (
          (t.nature || 'Fija Mensual') === 'Fija Mensual' &&
          getMonthlyTaskSeriesKey(t.area, t.title) === targetKey
        ) {
          return {
            ...t,
            monthlyRecurrenceStopped: false,
            monthlyStoppedFromPeriod: undefined,
            lastModifiedBy: {
              name: currentPersona.name,
              email: currentPersona.email,
              profile: userProf,
            },
            lastModifiedAt: formatted,
            lastModifiedAction: actionDesc,
            history: [mod, ...(t.history || [])],
          };
        }
        return t;
      });
    }

    setTasks(updatedTasks);
    if (selectedTaskForDetail && getMonthlyTaskSeriesKey(selectedTaskForDetail.area, selectedTaskForDetail.title) === targetKey) {
      const refreshed = updatedTasks.find(t => t.id === selectedTaskForDetail.id) || null;
      setSelectedTaskForDetail(refreshed);
    }

    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} ${stopRecurrence ? 'frenó' : 'reactivó'} la repetición mensual de "${targetTask.title}"`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );

    showToast(
      stopRecurrence
        ? `Repetición mensual frenada para "${targetTask.title}". Ya no se repetirá en los meses siguientes.`
        : `Repetición mensual reactivada para "${targetTask.title}".`
    );
  };

  const handleToggleWeeklyRecurrence = (targetTask: Task, stopRecurrence: boolean) => {
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const actionDesc = stopRecurrence
      ? 'Detuvo la repetición automática semanal'
      : 'Reactivó la repetición automática semanal';
    const mod = logCloudModification(actionDesc, undefined, targetTask.title);

    const isSameSeries = (t: Task) => {
      if (t.nature !== 'Fija Semanal') return false;
      if (targetTask.weeklySeriesId && t.weeklySeriesId === targetTask.weeklySeriesId) return true;
      return (
        t.area === targetTask.area &&
        t.title.toLowerCase().trim() === targetTask.title.toLowerCase().trim()
      );
    };

    let updatedTasks: Task[];

    if (stopRecurrence) {
      // Marcar la serie como detenida y retirar las ocurrencias futuras aún no completadas posteriores a esta semana
      updatedTasks = tasks
        .filter(t => {
          if (isSameSeries(t) && t.id !== targetTask.id && t.dueDate > targetTask.dueDate && t.status !== 'Completada') {
            return false;
          }
          return true;
        })
        .map(t => {
          if (isSameSeries(t)) {
            return {
              ...t,
              weeklyRecurrenceStopped: true,
              lastModifiedBy: {
                name: currentPersona.name,
                email: currentPersona.email,
                profile: userProf,
              },
              lastModifiedAt: formatted,
              lastModifiedAction: actionDesc,
              history: [mod, ...(t.history || [])],
            };
          }
          return t;
        });
    } else {
      // Reactivar la serie y volver a proyectar las semanas faltantes del mes actual
      const reactivated = tasks.map(t => {
        if (isSameSeries(t)) {
          return {
            ...t,
            weeklyRecurrenceStopped: false,
            lastModifiedBy: {
              name: currentPersona.name,
              email: currentPersona.email,
              profile: userProf,
            },
            lastModifiedAt: formatted,
            lastModifiedAction: actionDesc,
            history: [mod, ...(t.history || [])],
          };
        }
        return t;
      });
      updatedTasks = renewWeeklyFixedTasksForPeriod(reactivated, currentPeriod).updatedTasks;
    }

    setTasks(updatedTasks);
    if (selectedTaskForDetail && isSameSeries(selectedTaskForDetail)) {
      const refreshed = updatedTasks.find(t => t.id === selectedTaskForDetail.id) || null;
      setSelectedTaskForDetail(refreshed);
    }

    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} ${stopRecurrence ? 'detuvo' : 'reactivó'} la repetición semanal de "${targetTask.title}"`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );

    showToast(
      stopRecurrence
        ? `Repetición semanal detenida para "${targetTask.title}". Se retiraron las semanas futuras pendientes.`
        : `Repetición semanal reactivada para "${targetTask.title}". Se agendaron las semanas del mes.`
    );
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const task = tasks.find(t => t.id === taskId);
    const taskTitle = task ? task.title : taskId;
    const actionDesc = `Cambió estado a "${newStatus}"`;
    const mod = logCloudModification(actionDesc, undefined, taskTitle);

    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          completedDate: newStatus === 'Completada' ? nowIso : undefined,
          lastModifiedBy: {
            name: currentPersona.name,
            email: currentPersona.email,
            profile: userProf,
          },
          lastModifiedAt: formatted,
          lastModifiedAction: actionDesc,
          history: [mod, ...(t.history || [])],
        };
      }
      return t;
    });

    setTasks(updatedTasks);

    if (selectedTaskForDetail && selectedTaskForDetail.id === taskId) {
      setSelectedTaskForDetail(prev => prev ? {
        ...prev,
        status: newStatus,
        completedDate: newStatus === 'Completada' ? nowIso : undefined,
        lastModifiedBy: {
          name: currentPersona.name,
          email: currentPersona.email,
          profile: userProf,
        },
        lastModifiedAt: formatted,
        lastModifiedAction: actionDesc,
        history: [mod, ...(prev.history || [])],
      } : null);
    }

    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} (${userProf}) actualizó "${taskTitle}" a ${newStatus}`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );
    showToast(`Modificación guardada: ${currentPersona.name} cambió estado a "${newStatus}"`);
  };

  const handleUpdateTaskDetails = (updatedTask: Task, actionDescription: string) => {
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const mod = logCloudModification(actionDescription, undefined, updatedTask.title);

    const taskWithAudit: Task = {
      ...updatedTask,
      lastModifiedBy: {
        name: currentPersona.name,
        email: currentPersona.email,
        profile: userProf,
      },
      lastModifiedAt: formatted,
      lastModifiedAction: actionDescription,
      history: [mod, ...(updatedTask.history || [])],
    };

    const updatedTasks = tasks.map(t => {
      if (t.id === updatedTask.id) return taskWithAudit;
      if (
        updatedTask.weeklySeriesId &&
        t.weeklySeriesId === updatedTask.weeklySeriesId &&
        t.status !== 'Completada'
      ) {
        return {
          ...t,
          title: updatedTask.title,
          area: updatedTask.area,
          assignee: updatedTask.assignee,
          priority: updatedTask.priority,
          notes: updatedTask.notes,
          lastModifiedBy: {
            name: currentPersona.name,
            email: currentPersona.email,
            profile: userProf,
          },
          lastModifiedAt: formatted,
          lastModifiedAction: actionDescription,
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    setSelectedTaskForDetail(taskWithAudit);

    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} (${userProf}) modificó "${updatedTask.title}"`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );
    showToast(`Tarea modificada por ${currentPersona.name}`);
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && (task.nature || 'Fija Mensual') === 'Fija Mensual') {
      // Si se borra una tarea Fija Mensual, también frenar su repetición desde este mes en adelante para que no vuelva a crearse
      setMonthlyTaskStopped(task.area, task.title, task.monthPeriod || currentPeriod);
    }
    logCloudModification('Retiró tarea de la planilla', undefined, task?.title || taskId);
    const updatedTasks = tasks.filter(t => {
      if (t.id === taskId) return false;
      if (
        task &&
        (task.nature || 'Fija Mensual') === 'Fija Mensual' &&
        (t.nature || 'Fija Mensual') === 'Fija Mensual' &&
        getMonthlyTaskSeriesKey(t.area, t.title) === getMonthlyTaskSeriesKey(task.area, task.title) &&
        (t.monthPeriod || '2026-10') > (task.monthPeriod || currentPeriod) &&
        t.status !== 'Completada'
      ) {
        return false;
      }
      return true;
    });
    setTasks(updatedTasks);
    if (selectedTaskForDetail && selectedTaskForDetail.id === taskId) {
      setSelectedTaskForDetail(null);
    }
    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} retiró la tarea "${task?.title || taskId}"`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updatedTasks
    );
    showToast('Tarea retirada del archivo en la nube.');
  };

  const handleAddTaskComment = (taskId: string, commentText: string, author: string, mentions?: string[]) => {
    const formatted = formatModificationTimestamp(new Date());
    const userProf = currentPersona.profileType || determineProfileFromEmail(currentPersona.email);
    const task = tasks.find(t => t.id === taskId);
    const taskTitle = task ? task.title : taskId;
    const actionDesc = `Agregó comentario: "${commentText.slice(0, 35)}..."`;
    const mod = logCloudModification(actionDesc, commentText, taskTitle);

    const newComment = {
      id: `comm-${Date.now()}`,
      author,
      authorEmail: currentPersona.email,
      authorProfile: userProf,
      text: commentText,
      timestamp: formatted,
    };

    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const comments = t.comments || [];
        return {
          ...t,
          commentsCount: (t.commentsCount || 0) + 1,
          comments: [...comments, newComment],
          lastModifiedBy: {
            name: currentPersona.name,
            email: currentPersona.email,
            profile: userProf,
          },
          lastModifiedAt: formatted,
          lastModifiedAction: actionDesc,
          history: [mod, ...(t.history || [])],
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    if (selectedTaskForDetail && selectedTaskForDetail.id === taskId) {
      setSelectedTaskForDetail(prev => prev ? {
        ...prev,
        commentsCount: (prev.commentsCount || 0) + 1,
        comments: [...(prev.comments || []), newComment],
        lastModifiedBy: {
          name: currentPersona.name,
          email: currentPersona.email,
          profile: userProf,
        },
        lastModifiedAt: formatted,
        lastModifiedAction: actionDesc,
        history: [mod, ...(prev.history || [])],
      } : null);
    }

    broadcastCloudChange(
      'TASK_MUTATION',
      `${currentPersona.name} comentó en "${taskTitle}"`,
      { name: currentPersona.name, profile: userProf, email: currentPersona.email },
      updatedTasks
    );

    if (commentText.includes('@') || (mentions && mentions.length > 0)) {
      const newMsg: InternalMessage = {
        id: `msg-${Date.now()}`,
        authorName: currentPersona.name,
        authorRole: currentPersona.role,
        content: commentText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mentions: mentions || [],
        taskId,
      };
      const updatedMsgs = [newMsg, ...messages];
      setMessages(updatedMsgs);
      broadcastCloudChange(
        'MESSAGE_MUTATION',
        `${currentPersona.name} mencionó en la tarea "${taskTitle}"`,
        { name: currentPersona.name, profile: userProf, email: currentPersona.email },
        updatedMsgs
      );
    }

    showToast(`Comentario registrado en el archivo compartido`);
  };

  // Expenses handlers
  const handleAddExpense = (newExpData: Omit<Expense, 'id'>) => {
    const newExp: Expense = {
      ...newExpData,
      id: `exp-${Date.now()}`,
    };
    const updated = [newExp, ...expenses];
    setExpenses(updated);
    broadcastCloudChange(
      'EXPENSE_MUTATION',
      `${currentPersona.name} cargó un gasto operativo: $${newExp.amount}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast('Gasto operativo registrado en la nube.');
  };

  const handleUpdatePaymentStatus = (id: string, status: 'Pagado' | 'Pendiente' | 'En Revisión') => {
    const updated = expenses.map(e => e.id === id ? { ...e, paymentStatus: status } : e);
    setExpenses(updated);
    broadcastCloudChange(
      'EXPENSE_MUTATION',
      `${currentPersona.name} cambió estado de gasto a: ${status}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast(`Estado de pago actualizado a: ${status}`);
  };

  const handleUpdateExpense = (updatedExp: Expense) => {
    setExpenses(prev => {
      const updated = prev.map(e => e.id === updatedExp.id ? updatedExp : e);
      return updated;
    });
    broadcastCloudChange(
      'EXPENSE_MUTATION',
      `${currentPersona.name} actualizó comprobante de ${updatedExp.provider}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      expenses.map(e => e.id === updatedExp.id ? updatedExp : e)
    );
  };

  const handleDeleteExpense = (id: string) => {
    const exp = expenses.find(e => e.id === id);
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    broadcastCloudChange(
      'EXPENSE_MUTATION',
      `${currentPersona.name} retiró un comprobante: ${exp?.provider || id}`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast('Comprobante eliminado de la planilla.');
  };

  const handleBatchUpdateExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    broadcastCloudChange(
      'EXPENSE_MUTATION',
      `${currentPersona.name} actualizó la planilla de gastos y costos`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      newExpenses
    );
    showToast('Planilla de gastos y costos guardada en la nube.');
  };

  // Messages / Feed handlers
  const handleSendMessage = (
    content: string,
    mentions: string[],
    taskId?: string,
    directMeta?: { isDirect: boolean; recipientEmail?: string; recipientName?: string }
  ) => {
    const isDirect = directMeta?.isDirect ?? (
      mentions.length === 1 &&
      mentions[0].toLowerCase() !== 'consultasinvictsolutionss.a@gmail.com' &&
      !content.toLowerCase().includes('@todos')
    );

    const targetPersona = mentions.length === 1
      ? personas.find(p => p.email.toLowerCase() === mentions[0].toLowerCase())
      : undefined;

    const newMsg: InternalMessage = {
      id: `msg-${Date.now()}`,
      authorName: currentPersona.name,
      authorEmail: currentPersona.email,
      authorRole: currentPersona.role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mentions,
      isDirect,
      recipientEmail: directMeta?.recipientEmail || (isDirect ? mentions[0] : undefined),
      recipientName: directMeta?.recipientName || targetPersona?.name,
      taskId,
    };
    const updated = [newMsg, ...messages.filter(m => !isOldOrTestMessage(m))];
    setMessages(updated);
    const summary = isDirect && newMsg.recipientName
      ? `${currentPersona.name} envió un mensaje directo privado a ${newMsg.recipientName}`
      : `${currentPersona.name} publicó un mensaje en el feed interno`;
    broadcastCloudChange(
      'MESSAGE_MUTATION',
      summary,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    const updated = messages.filter(m => m.id !== messageId);
    setMessages(updated);
    localStorage.setItem('invict_messages', JSON.stringify(updated));
    broadcastCloudChange(
      'MESSAGE_MUTATION',
      `${currentPersona.name} eliminó un mensaje del feed interno`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast('Mensaje eliminado del feed.');
  };

  const handleClearOldFeedMessages = () => {
    if (!window.confirm('¿Deseas purgar todas las comunicaciones y chats de prueba antiguos del Feed?')) return;
    const updated = messages.filter(m => !isOldOrTestMessage(m));
    setMessages(updated);
    localStorage.setItem('invict_messages', JSON.stringify(updated));
    broadcastCloudChange(
      'MESSAGE_MUTATION',
      `${currentPersona.name} depuró los chats antiguos y de prueba del feed`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
    showToast('Feed depurado: se eliminaron los chats antiguos y de prueba.');
  };

  // Direct Header Export triggers
  const handleExportCurrentPeriodCSV = () => {
    const periodTasks = visibleTasks.filter(t => (t.monthPeriod || DEFAULT_PERIOD) === currentPeriod);
    exportTasksToCSV(periodTasks, `INVICT_Tareas_${currentPeriod}.csv`);
    showToast(`Planilla CSV de ${formatPeriodName(currentPeriod)} exportada.`);
  };

  const handleExportCurrentPeriodPDF = () => {
    const periodTasks = visibleTasks.filter(t => (t.monthPeriod || DEFAULT_PERIOD) === currentPeriod);
    exportTasksToPDF(periodTasks, `INVICT_Tareas_${currentPeriod}.pdf`);
    showToast(`Informe PDF de ${formatPeriodName(currentPeriod)} con marca de agua generado.`);
  };

  const isCurrentUserGerencia = Boolean(
    currentPersona && (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE')
  );
  const isCurrentUserSubGerencia = Boolean(
    currentPersona && (currentPersona.department === 'SUB_GERENCIA' || currentPersona.profileType === 'SUB_GERENTE')
  );
  const isCurrentUserExecutive = isCurrentUserGerencia || isCurrentUserSubGerencia;

  // Aislamiento estricto de tareas, gastos, personal y actividad de Gerencia General (Yamila y Domingo) para los demás usuarios
  const isGerenciaTextMatch = (val?: string): boolean => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return (
      lower.includes('gerencia general') ||
      lower.includes('dirección general') ||
      lower.includes('direccion general') ||
      lower.includes('yamila') ||
      lower.includes('domingo')
    );
  };

  const visiblePersonas = useMemo(() => {
    if (isCurrentUserGerencia) return personas;
    return personas.filter(p => p.department !== 'GERENCIA' && p.profileType !== 'GERENTE');
  }, [personas, isCurrentUserGerencia]);

  const visibleTasks = useMemo(() => {
    if (isCurrentUserGerencia) return tasks;
    const gerenciaEmails = new Set(
      personas
        .filter(p => p.department === 'GERENCIA' || p.profileType === 'GERENTE')
        .map(p => p.email.toLowerCase())
    );
    return tasks.filter(t => {
      if (t.area === 'GERENCIA') return false;
      if (t.assigneeEmail && gerenciaEmails.has(t.assigneeEmail.toLowerCase())) return false;
      if (isGerenciaTextMatch(t.assignee)) return false;
      return true;
    });
  }, [tasks, personas, isCurrentUserGerencia]);

  const visibleExpenses = useMemo(() => {
    if (isCurrentUserExecutive) return expenses;
    const commonCategories: Expense['category'][] = [
      'Compras de Insumos',
      'Viáticos Operativos',
      'Servicios de Oficina',
      'Mantenimiento / Ploteo',
      'Movilidad y Combustible',
      'Indumentaria / Uniformes',
    ];
    return expenses.filter(e => {
      if (!commonCategories.includes(e.category)) return false;
      if (isGerenciaTextMatch(e.responsible)) return false;
      return true;
    });
  }, [expenses, isCurrentUserExecutive]);

  const visibleModifications = useMemo(() => {
    if (isCurrentUserGerencia) return cloudModifications;
    return cloudModifications.filter(
      m => m.userProfile !== 'GERENTE' && !isGerenciaTextMatch(m.userName) && !isGerenciaTextMatch(m.actionDescription)
    );
  }, [cloudModifications, isCurrentUserGerencia]);

  const visibleMessages = useMemo(() => {
    const gerenciaTaskIds = new Set(tasks.filter(t => t.area === 'GERENCIA' || isGerenciaTextMatch(t.assignee)).map(t => t.id));

    return messages.filter(m => {
      // 1. Descartar mensajes de prueba antiguos
      if (isOldOrTestMessage(m)) return false;

      // 2. Aislamiento de tareas exclusivas de gerencia para usuarios no gerenciales
      if (!isCurrentUserGerencia && m.taskId && gerenciaTaskIds.has(m.taskId)) return false;

      // 3. Regla de Mención Individual (@) -> Mensaje Privado Directo:
      // Si el mensaje menciona a una sola persona, ÚNICAMENTE tienen acceso a visualizarlo el autor y la persona mencionada.
      // El resto de usuarios no puede visualizarlo bajo ninguna circunstancia.
      const isDirectMessage = m.isDirect || (
        Array.isArray(m.mentions) &&
        m.mentions.length === 1 &&
        m.mentions[0].toLowerCase() !== 'consultasinvictsolutionss.a@gmail.com' &&
        !m.content.toLowerCase().includes('@todos')
      );

      if (isDirectMessage) {
        const isAuthor =
          (m.authorEmail && m.authorEmail.toLowerCase() === currentPersona.email.toLowerCase()) ||
          (m.authorName && m.authorName.toLowerCase() === currentPersona.name.toLowerCase());

        const targetEmail = (m.recipientEmail || (Array.isArray(m.mentions) ? m.mentions[0] : '') || '').toLowerCase();
        const isRecipient =
          (targetEmail && targetEmail === currentPersona.email.toLowerCase()) ||
          (m.recipientName && m.recipientName.toLowerCase() === currentPersona.name.toLowerCase()) ||
          (Array.isArray(m.mentions) && m.mentions.some(e => e.toLowerCase() === currentPersona.email.toLowerCase())) ||
          (m.content && m.content.toLowerCase().includes(`@${currentPersona.name.split(' ')[0].toLowerCase()}`));

        // Solo visible para emisor y destinatario
        return isAuthor || isRecipient;
      }

      return true;
    });
  }, [messages, tasks, currentPersona, isCurrentUserGerencia]);

  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [dismissedMentionIds, setDismissedMentionIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('invict_dismissed_mentions');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const normalizeMentionStr = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const myDirectMentions = useMemo(() => {
    const myFirstName = normalizeMentionStr(currentPersona.name.split(' ')[0] || '');
    const myDept = normalizeMentionStr(currentPersona.department || '');
    const myProf = normalizeMentionStr(currentPersona.profileType || '');
    return visibleMessages.filter((m) => {
      if (m.authorName === currentPersona.name) return false;
      const emailMatch =
        m.mentions.some((e) => e.toLowerCase() === currentPersona.email.toLowerCase()) ||
        (isCurrentUserGerencia && m.mentions.includes('consultasinvictsolutionss.a@gmail.com'));
      if (emailMatch) return true;
      const normContent = normalizeMentionStr(m.content || '');
      return (
        (myFirstName && normContent.includes(`@${myFirstName}`)) ||
        (myDept && normContent.includes(`@${myDept}`)) ||
        (myProf && normContent.includes(`@${myProf}`)) ||
        normContent.includes('@todos')
      );
    });
  }, [visibleMessages, currentPersona, isCurrentUserGerencia]);

  const unreadDirectMentions = useMemo(
    () => myDirectMentions.filter((m) => !dismissedMentionIds.includes(m.id)),
    [myDirectMentions, dismissedMentionIds]
  );

  const handleDismissMention = (msgId: string) => {
    const next = Array.from(new Set([...dismissedMentionIds, msgId]));
    setDismissedMentionIds(next);
    try {
      localStorage.setItem('invict_dismissed_mentions', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleNavigateToMentionMessage = (msgId: string, taskId?: string) => {
    handleDismissMention(msgId);
    setFocusedMessageId(msgId);
    setActiveTab('feed');
  };

  // Counters synchronized with the selected Period and Area/Puesto in view
  const urgentTasksCount = visibleTasks.filter(t => {
    if (t.status === 'Completada') return false;
    if ((t.monthPeriod || DEFAULT_PERIOD) !== currentPeriod) return false;
    if (selectedArea && selectedArea !== 'TODOS' && t.area !== selectedArea) return false;
    return t.priority === 'Urgente';
  }).length;

  const unreadMentionsCount = unreadDirectMentions.length;

  // Garantizar que ningún puesto que no sea Gerencia acceda al Dashboard Gerencial, Estadísticas ni al filtro de área GERENCIA
  useEffect(() => {
    if (!isCurrentUserExecutive && (activeTab === 'dashboard' || activeTab === 'statistics')) {
      setActiveTab('tasks');
    }
    if (!isCurrentUserGerencia && selectedArea === 'GERENCIA') {
      setSelectedArea(isCurrentUserSubGerencia ? 'SUB_GERENCIA' : 'OPERACIONES');
    }
  }, [isCurrentUserGerencia, isCurrentUserSubGerencia, isCurrentUserExecutive, activeTab, selectedArea]);

  // Interfaz de inicio de sesión obligatoria
  if (!authSession) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        availablePersonas={personas}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-[#BE2629] selection:text-white relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141b2a] border border-[#2a374f] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <Header
        currentPersona={currentPersona}
        allPersonas={personas}
        onSelectPersona={(p) => {
          setCurrentPersona(p);
          setSelectedArea((p.department as AreaType) || 'TODOS');
          const pIsGerencia = p.department === 'GERENCIA' || p.profileType === 'GERENTE';
          if (!pIsGerencia && activeTab === 'dashboard') {
            setActiveTab('tasks');
          }
          storeSession({ user: p, token: 'invict-token', loginTime: new Date().toISOString() });
          showToast(`Perfil cambiado a ${p.name} (${p.profileType || p.department})`);
        }}
        tasks={visibleTasks}
        messages={visibleMessages}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        currentPeriod={currentPeriod}
        onPeriodChange={handlePeriodChange}
        onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
        onOpenNewExpenseModal={() => setIsNewExpenseModalOpen(true)}
        onNavigateToFeed={() => setActiveTab('feed')}
        onNavigateToReports={() => setActiveTab('reports')}
        onSelectTask={(task) => setSelectedTaskForDetail(task)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenProfileModal={() => {
          if (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE') {
            setIsProfileModalOpen(true);
          } else {
            showToast('Acceso Bloqueado: Solo Gerencia General puede conmutar de puesto.');
          }
        }}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenPersonnelModal={() => setIsPersonnelModalOpen(true)}
        onOpenEmailAlertsModal={() => setIsEmailAlertsModalOpen(true)}
        onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)}
        onLogout={handleLogout}
        onExportPeriodCSV={handleExportCurrentPeriodCSV}
        onExportPeriodPDF={handleExportCurrentPeriodPDF}
        totalEmailAlertsCount={emailLogs.length}
        onSelectMentionMessage={handleNavigateToMentionMessage}
        selectedArea={selectedArea}
      />

      {/* Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if ((tab === 'dashboard' || tab === 'statistics') && !isCurrentUserExecutive) {
              showToast('Acceso Restringido: Este panel es de uso exclusivo para Dirección General y Sub Gerencia.');
              setActiveTab('tasks');
              return;
            }
            setActiveTab(tab);
          }}
          selectedArea={selectedArea}
          onAreaChange={setSelectedArea}
          urgentTasksCount={urgentTasksCount}
          unreadMentionsCount={unreadMentionsCount}
          currentPersona={currentPersona}
          onOpenProfileModal={() => {
            if (isCurrentUserExecutive) {
              setIsProfileModalOpen(true);
            } else {
              showToast('Acceso Bloqueado: Solo Gerencia y Sub Gerencia pueden supervisar otros puestos.');
            }
          }}
          onOpenPersonnelModal={() => setIsPersonnelModalOpen(true)}
          onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 md:pb-6 bg-[#090b0f] flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {/* Banner de Notificación de Mención (@) con acceso directo al mensaje */}
            {unreadDirectMentions.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#23121a] via-[#1c1629] to-[#131d2e] border border-[#BE2629]/70 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-[#BE2629]/20 border border-[#BE2629]/50 text-[#ff6b6e] shrink-0">
                    <AtSign className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white uppercase tracking-wide">
                        Nueva Mención para ti ({unreadDirectMentions.length})
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-cyan-300 border border-cyan-800/50">
                        De: {unreadDirectMentions[0].authorName} · {unreadDirectMentions[0].timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 truncate mt-0.5">
                      "{unreadDirectMentions[0].content}"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      handleNavigateToMentionMessage(
                        unreadDirectMentions[0].id,
                        unreadDirectMentions[0].taskId
                      )
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white text-xs font-bold shadow transition-all cursor-pointer active:scale-95"
                  >
                    <span>Ver Mensaje donde te mencionaron</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDismissMention(unreadDirectMentions[0].id)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#161c28] hover:bg-[#222b3d] text-slate-300 hover:text-white text-xs font-semibold border border-[#2a354b] transition-colors cursor-pointer"
                  >
                    Leído
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && isCurrentUserExecutive ? (
              <DashboardView
                tasks={visibleTasks}
                expenses={expenses}
                selectedArea={selectedArea}
                onAreaChange={setSelectedArea}
                onNavigateToTasks={() => setActiveTab('tasks')}
                onNavigateToReports={() => setActiveTab('reports')}
                onNavigateToExpenses={() => setActiveTab('expenses')}
                onNavigateToCalendar={() => setActiveTab('calendar')}
                onSelectTask={(task) => setSelectedTaskForDetail(task)}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                onResetFixedTasks={isCurrentUserGerencia ? handleResetFixedTasks : undefined}
                onClearMonth={isCurrentUserGerencia ? handleClearMonth : undefined}
                onExportPeriod={handleExportCurrentPeriodCSV}
                isReadOnly={isCurrentUserSubGerencia}
                isSubGerencia={isCurrentUserSubGerencia}
              />
            ) : activeTab === 'dashboard' && !isCurrentUserExecutive ? (
              <div className="p-8 rounded-3xl bg-[#121622] border border-amber-600/60 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black text-white">Acceso Restringido a Dirección General</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  El <strong>Dashboard Gerencial C-Level</strong> contiene métricas globales, auditoría de cuellos de botella y balances ejecutivos reservados exclusivamente para Dirección General y Sub Gerencia.
                </p>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#a52023] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Ir a Matriz de Tareas de Oficina
                </button>
              </div>
            ) : null}

            {activeTab === 'statistics' && isCurrentUserExecutive ? (
              <GerencialMetricsAndStatisticsView
                tasks={visibleTasks}
                expenses={expenses}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                currentPersona={currentPersona}
                isGerencia={isCurrentUserGerencia}
                isSubGerencia={isCurrentUserSubGerencia}
                onNavigateToTasks={() => setActiveTab('tasks')}
                onNavigateToDashboard={() => setActiveTab('dashboard')}
              />
            ) : activeTab === 'statistics' && !isCurrentUserExecutive ? (
              <div className="p-8 rounded-3xl bg-[#121622] border border-amber-600/60 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black text-white">Acceso Restringido a Gerencia General</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  El panel de <strong>Métricas y Estadísticas Corporativas con Fórmulas de las Condiciones</strong> contiene análisis directivo y gráficos de alta dirección reservados exclusivamente para Dirección General.
                </p>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#a52023] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Ir a Matriz de Tareas de Oficina
                </button>
              </div>
            ) : null}

            {activeTab === 'tasks' && (
              <TasksMatrixView
                tasks={visibleTasks}
                selectedArea={selectedArea}
                onAreaChange={setSelectedArea}
                onSelectTask={(task) => setSelectedTaskForDetail(task)}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
                onDeleteTask={handleDeleteTask}
                globalSearchTerm={searchTerm}
                currentPersona={currentPersona}
                allPersonas={visiblePersonas}
                lastModification={visibleModifications[0] || null}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                onResetFixedTasks={isCurrentUserGerencia ? handleResetFixedTasks : undefined}
                onRenewWeeklyNextMonth={isCurrentUserExecutive ? handleRenewWeeklyNextMonth : undefined}
                onToggleWeeklyRecurrence={handleToggleWeeklyRecurrence}
                onToggleMonthlyRecurrence={handleToggleMonthlyRecurrence}
                onClearMonth={isCurrentUserGerencia ? handleClearMonth : undefined}
                onExportPeriod={handleExportCurrentPeriodCSV}
                onOpenAdminSheets={() => setActiveTab('admin_sheets')}
              />
            )}

            {activeTab === 'admin_sheets' && (
              <AdminInformativeSheetsView
                currentPersona={currentPersona}
                onNotify={showToast}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
              />
            )}

            {activeTab === 'reports' && (
              <ExecutiveReportsView
                tasks={visibleTasks}
                expenses={visibleExpenses}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                currentUser={currentPersona}
                allPersonas={visiblePersonas}
                onSelectTask={(task) => setSelectedTaskForDetail(task)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                tasks={visibleTasks}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                selectedArea={selectedArea}
                onAreaChange={setSelectedArea}
                onSelectTask={(task) => setSelectedTaskForDetail(task)}
                onOpenNewTaskModal={(date) => {
                  setIsNewTaskModalOpen(true);
                }}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                currentPersona={currentPersona}
                googleUser={googleUser}
                isGoogleLoading={isGoogleLoading}
                onSignInGoogle={handleSignInGoogle}
                onSignOutGoogle={handleSignOutGoogle}
                googleEvents={googleEvents}
                onRefreshGoogleEvents={() => loadGoogleCalendarEvents(currentPeriod)}
                onRequestSyncTaskToGoogle={handleRequestSyncTaskToGoogle}
                onRequestSyncAllPeriodTasks={handleRequestSyncAllPeriodTasks}
              />
            )}

            {activeTab === 'expenses' && (
              <ExpensesView
                expenses={visibleExpenses}
                onOpenNewExpenseModal={() => setIsNewExpenseModalOpen(true)}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
                onBatchUpdateExpenses={handleBatchUpdateExpenses}
                onAddExpense={handleAddExpense}
                currentPersona={currentPersona}
                onNavigateToDashboard={() => setActiveTab('dashboard')}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                onNotify={showToast}
              />
            )}

            {activeTab === 'feed' && (
              <InvictFeedView
                messages={visibleMessages}
                currentPersona={currentPersona}
                allPersonas={visiblePersonas}
                onSendMessage={handleSendMessage}
                onDeleteMessage={handleDeleteMessage}
                onClearOldMessages={handleClearOldFeedMessages}
                tasks={visibleTasks}
                onRefreshEmailLogs={refreshEmailLogs}
                onOpenEmailAlertsModal={() => setIsEmailAlertsModalOpen(true)}
                focusedMessageId={focusedMessageId}
                onClearFocusedMessage={() => setFocusedMessageId(null)}
                onSelectTask={(task) => setSelectedTaskForDetail(task)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Footer Watermark */}
      <FooterWatermark onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)} />

      {/* Modals & Drawers */}
      <PersonnelManagementModal
        isOpen={isPersonnelModalOpen}
        onClose={() => setIsPersonnelModalOpen(false)}
        personas={personas}
        currentUser={currentPersona}
        onUpdatePersona={handleUpdatePersona}
        onAddPersona={handleAddPersona}
        onDeletePersona={handleDeletePersona}
        tasks={tasks}
        onReassignTasksToPersona={handleReassignTasksToPersona}
        onNotify={showToast}
      />

      <EmailAlertsDrawer
        isOpen={isEmailAlertsModalOpen}
        onClose={() => setIsEmailAlertsModalOpen(false)}
        emailLogs={emailLogs}
        onRefreshLogs={refreshEmailLogs}
        onNotify={showToast}
      />

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tasks={visibleTasks}
        expenses={visibleExpenses}
        currentPeriod={currentPeriod}
        allPersonas={visiblePersonas}
        currentUser={currentPersona}
      />

      <ProfileSwitcherModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        personas={personas}
        currentPersona={currentPersona}
        onSelectPersona={(p) => {
          setCurrentPersona(p);
          const pIsGerencia = p.department === 'GERENCIA' || p.profileType === 'GERENTE';
          const pIsSubGerencia = p.department === 'SUB_GERENCIA' || p.profileType === 'SUB_GERENTE';
          const pIsExecutive = pIsGerencia || pIsSubGerencia;
          if (!pIsExecutive && activeTab === 'dashboard') {
            setActiveTab('tasks');
          }
          if (!pIsGerencia && selectedArea === 'GERENCIA') {
            setSelectedArea(pIsSubGerencia ? 'SUB_GERENCIA' : (p.department as AreaType) || 'OPERACIONES');
          }
        }}
        onOpenPersonnelModal={() => {
          setIsProfileModalOpen(false);
          setIsPersonnelModalOpen(true);
        }}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onNotify={showToast}
      />

      <TaskDetailModal
        isOpen={!!selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
        task={selectedTaskForDetail}
        onUpdateStatus={handleUpdateTaskStatus}
        onUpdateTaskDetails={handleUpdateTaskDetails}
        onAddComment={handleAddTaskComment}
        currentPersona={currentPersona}
        allPersonas={visiblePersonas}
        onRefreshEmailLogs={refreshEmailLogs}
        onToggleWeeklyRecurrence={handleToggleWeeklyRecurrence}
        onToggleMonthlyRecurrence={handleToggleMonthlyRecurrence}
        onDeleteTask={handleDeleteTask}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onAddTask={handleAddTask}
        currentPeriod={currentPeriod}
        defaultArea={selectedArea}
        personas={visiblePersonas}
        currentUser={currentPersona}
      />

      <NewExpenseModal
        isOpen={isNewExpenseModalOpen}
        onClose={() => setIsNewExpenseModalOpen(false)}
        onAddExpense={handleAddExpense}
        currentPeriod={currentPeriod}
        currentPersona={currentPersona}
      />

      {/* Google Calendar Mandatory User Confirmation Modal for Mutations */}
      <GoogleCalendarConfirmModal
        isOpen={calendarConfirmModal.isOpen}
        onClose={() => setCalendarConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={calendarConfirmModal.onConfirm}
        title={calendarConfirmModal.title}
        actionDescription={calendarConfirmModal.actionDescription}
        itemCount={calendarConfirmModal.itemCount}
        itemsList={calendarConfirmModal.itemsList}
        dateInfo={calendarConfirmModal.dateInfo}
        isDestructive={calendarConfirmModal.isDestructive}
        userEmail={calendarConfirmModal.userEmail}
      />

      {/* Google Calendar Batch Sync Modal */}
      <GoogleCalendarSyncModal
        isOpen={isCalendarSyncModalOpen}
        onClose={() => setIsCalendarSyncModalOpen(false)}
        tasks={visibleTasks}
        currentPeriod={currentPeriod}
        googleUser={googleUser}
        isGoogleLoading={isGoogleLoading}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        onConfirmSyncTasks={handleRequestSyncAllPeriodTasks}
        googleEvents={googleEvents}
        onRefreshGoogleEvents={() => loadGoogleCalendarEvents(currentPeriod)}
      />

      {/* Desktop PWA Installation Modal */}
      <DesktopPwaInstallModal
        isOpen={isDesktopPwaModalOpen}
        onClose={() => setIsDesktopPwaModalOpen(false)}
        onNotify={showToast}
      />

      {/* BONO - Floating AI Assistant */}
      <BonoChatAssistant
        currentUser={currentPersona}
        tasks={visibleTasks}
        onNavigateTab={(tab) => setActiveTab(tab as any)}
        onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)}
        onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
        onOpenNewExpenseModal={() => setIsNewExpenseModalOpen(true)}
      />

      {/* Mobile Navigation Bar (Fixed for Smartphones) */}
      <MobileNavBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'dashboard' && !isCurrentUserExecutive) {
            showToast('Acceso Restringido: El Dashboard Gerencial es exclusivo de Dirección General y Sub Gerencia.');
            setActiveTab('tasks');
            return;
          }
          setActiveTab(tab);
        }}
        selectedArea={selectedArea}
        onAreaChange={setSelectedArea}
        urgentTasksCount={urgentTasksCount}
        unreadMentionsCount={unreadMentionsCount}
        currentPersona={currentPersona}
        onOpenProfileModal={() => {
          if (isCurrentUserExecutive) {
            setIsProfileModalOpen(true);
          } else {
            showToast('Acceso Bloqueado: Solo Gerencia y Sub Gerencia pueden supervisar otros puestos.');
          }
        }}
        onOpenPersonnelModal={() => setIsPersonnelModalOpen(true)}
        onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)}
        onLogout={handleLogout}
      />
    </div>
  );
}
