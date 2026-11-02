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
  USER_PERSONAS
} from './data/mockData';
import { Lock } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TasksMatrixView } from './components/TasksMatrixView';
import { ExecutiveReportsView } from './components/ExecutiveReportsView';
import { ExpensesView } from './components/ExpensesView';
import { InvictFeedView } from './components/InvictFeedView';
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
import { BonoChatAssistant } from './components/BonoChatAssistant';
import { DesktopPwaInstallModal } from './components/DesktopPwaInstallModal';
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
  getTodayDateString
} from './utils/dateUtils';
import { ensureMonthHasFixedTasks, renewMonthFixedTasks } from './utils/monthRenewalService';
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
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
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
  const [selectedArea, setSelectedArea] = useState<AreaType>('TODOS');
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
        showToast(`⚡ ${payload.summary}`);
      }
      if (payload.stateSnapshot) {
        if (Array.isArray(payload.stateSnapshot.invict_tasks)) {
          setTasks(payload.stateSnapshot.invict_tasks);
        }
        if (Array.isArray(payload.stateSnapshot.invict_expenses)) {
          setExpenses(payload.stateSnapshot.invict_expenses);
        }
        if (Array.isArray(payload.stateSnapshot.invict_messages)) {
          setMessages(payload.stateSnapshot.invict_messages);
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
        setMessages(payload.data);
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
    showToast(`Tareas fijas mensuales renovadas para ${formatPeriodName(currentPeriod)}`);
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
    saveNewCustomPost(newPersona, initialPassword || 'Invict2026!', {
      name: currentPersona.name,
      profile: currentPersona.profileType,
      email: currentPersona.email,
    });
    showToast(`Puesto "${newPersona.role}" creado y habilitado en la plataforma.`);
  };

  const handleDeletePersona = (personaId: string) => {
    const p = personas.find(item => item.id === personaId);
    const postName = p ? p.role : personaId;
    setPersonas(prev => prev.filter(item => item.id !== personaId));
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

    const updatedTasks = tasks.map(t => t.id === updatedTask.id ? taskWithAudit : t);
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
    logCloudModification('Retiró tarea de la planilla', undefined, task?.title || taskId);
    const updatedTasks = tasks.filter(t => t.id !== taskId);
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
  const handleSendMessage = (content: string, mentions: string[], taskId?: string) => {
    const newMsg: InternalMessage = {
      id: `msg-${Date.now()}`,
      authorName: currentPersona.name,
      authorRole: currentPersona.role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mentions,
      taskId,
    };
    const updated = [newMsg, ...messages];
    setMessages(updated);
    broadcastCloudChange(
      'MESSAGE_MUTATION',
      `${currentPersona.name} publicó un mensaje en el feed interno`,
      { name: currentPersona.name, profile: currentPersona.profileType, email: currentPersona.email },
      updated
    );
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

  // Aislamiento estricto de tareas: los demás administrativos no deben tener acceso a ver las tareas que registra Gerencia
  const visibleTasks = useMemo(() => {
    if (isCurrentUserGerencia) return tasks;
    return tasks.filter(t => t.area !== 'GERENCIA');
  }, [tasks, isCurrentUserGerencia]);

  // Counters
  const urgentTasksCount = visibleTasks.filter(t => {
    if (t.status === 'Completada') return false;
    return t.priority === 'Urgente';
  }).length;

  const unreadMentionsCount = messages.filter(m =>
    m.mentions.includes(currentPersona.email)
  ).length;

  // Garantizar que ningún puesto que no sea Gerencia acceda al Dashboard Gerencial
  useEffect(() => {
    if (!isCurrentUserGerencia && activeTab === 'dashboard') {
      setActiveTab('tasks');
    }
  }, [isCurrentUserGerencia, activeTab]);

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
          const pIsGerencia = p.department === 'GERENCIA' || p.profileType === 'GERENTE';
          if (!pIsGerencia && activeTab === 'dashboard') {
            setActiveTab('tasks');
          }
          storeSession({ user: p, token: 'invict-token', loginTime: new Date().toISOString() });
          showToast(`Perfil cambiado a ${p.name} (${p.profileType || p.department})`);
        }}
        tasks={visibleTasks}
        messages={messages}
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
      />

      {/* Body Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'dashboard' && !isCurrentUserGerencia) {
              showToast('Acceso Restringido: El Dashboard Gerencial es de uso exclusivo para Dirección General (C-Level).');
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
            if (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE') {
              setIsProfileModalOpen(true);
            } else {
              showToast('Acceso Bloqueado: Solo Gerencia General puede conmutar de puesto.');
            }
          }}
          onOpenPersonnelModal={() => setIsPersonnelModalOpen(true)}
          onOpenPwaModal={() => setIsDesktopPwaModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#090b0f] flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {activeTab === 'dashboard' && isCurrentUserGerencia ? (
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
                onResetFixedTasks={handleResetFixedTasks}
                onClearMonth={isCurrentUserGerencia ? handleClearMonth : undefined}
                onExportPeriod={handleExportCurrentPeriodCSV}
              />
            ) : activeTab === 'dashboard' && !isCurrentUserGerencia ? (
              <div className="p-8 rounded-3xl bg-[#121622] border border-amber-600/60 text-center max-w-xl mx-auto my-12 shadow-2xl space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black text-white">Acceso Restringido a Gerencia General</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  El <strong>Dashboard Gerencial C-Level</strong> contiene métricas globales, auditoría de cuellos de botella y balances ejecutivos reservados exclusivamente para Dirección General.
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
                allPersonas={personas}
                lastModification={cloudModifications[0] || null}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                onResetFixedTasks={handleResetFixedTasks}
                onClearMonth={isCurrentUserGerencia ? handleClearMonth : undefined}
                onExportPeriod={handleExportCurrentPeriodCSV}
              />
            )}

            {activeTab === 'reports' && (
              <ExecutiveReportsView
                tasks={visibleTasks}
                expenses={expenses}
                currentPeriod={currentPeriod}
                onPeriodChange={handlePeriodChange}
                currentUser={currentPersona}
                allPersonas={personas}
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
                expenses={expenses}
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
                messages={messages}
                currentPersona={currentPersona}
                allPersonas={personas}
                onSendMessage={handleSendMessage}
                tasks={visibleTasks}
                onRefreshEmailLogs={refreshEmailLogs}
                onOpenEmailAlertsModal={() => setIsEmailAlertsModalOpen(true)}
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
        expenses={expenses}
        currentPeriod={currentPeriod}
        allPersonas={personas}
      />

      <ProfileSwitcherModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        personas={personas}
        currentPersona={currentPersona}
        onSelectPersona={(p) => {
          setCurrentPersona(p);
          const pIsGerencia = p.department === 'GERENCIA' || p.profileType === 'GERENTE';
          if (!pIsGerencia && activeTab === 'dashboard') {
            setActiveTab('tasks');
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
        allPersonas={personas}
        onRefreshEmailLogs={refreshEmailLogs}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onAddTask={handleAddTask}
        currentPeriod={currentPeriod}
        defaultArea={selectedArea}
        personas={personas}
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
      />
    </div>
  );
}
