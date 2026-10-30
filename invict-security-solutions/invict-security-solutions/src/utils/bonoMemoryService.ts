import { UserPersona } from '../types';

export interface BonoUserContext {
  userId: string;
  name: string;
  role: string;
  department: string;
  firstInteraction: string;
  lastInteraction: string;
  interactionCount: number;
  recentTopics: string[];
  userNotes?: string[];
}

export interface BonoDepartmentMemory {
  department: string;
  knownUsers: Record<string, BonoUserContext>;
  sharedDepartmentTopics: string[];
  lastUpdated: string;
}

const MEMORY_STORAGE_PREFIX = 'bono_context_memory_';

/**
 * Get the storage key for a department's memory realm.
 * GERENCIA has a completely isolated realm from OPERACIONES and other departments.
 */
function getDepartmentStorageKey(department: string, isEffectiveGerencia: boolean): string {
  if (isEffectiveGerencia || department === 'GERENCIA') {
    return `${MEMORY_STORAGE_PREFIX}gerencia`;
  }
  // Sanitize department name for key
  const safeDept = department.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${MEMORY_STORAGE_PREFIX}${safeDept}`;
}

/**
 * Load department memory realm from localStorage.
 */
export function loadDepartmentMemory(
  department: string,
  isEffectiveGerencia: boolean
): BonoDepartmentMemory {
  const key = getDepartmentStorageKey(department, isEffectiveGerencia);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error loading Bono department memory:', e);
  }

  return {
    department: isEffectiveGerencia ? 'GERENCIA' : department,
    knownUsers: {},
    sharedDepartmentTopics: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save department memory realm to localStorage.
 */
export function saveDepartmentMemory(
  memory: BonoDepartmentMemory,
  isEffectiveGerencia: boolean
): void {
  const key = getDepartmentStorageKey(memory.department, isEffectiveGerencia);
  try {
    memory.lastUpdated = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(memory));
  } catch (e) {
    console.warn('Error saving Bono department memory:', e);
  }
}

/**
 * Record an interaction with a user, updating interaction counts and recent topics.
 * Enforces departmental memory isolation.
 */
export function recordBonoInteraction(
  user: UserPersona,
  messageText: string,
  isEffectiveGerencia: boolean
): BonoDepartmentMemory {
  const memory = loadDepartmentMemory(user.department, isEffectiveGerencia);
  const nowStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const existingUser = memory.knownUsers[user.id] || {
    userId: user.id,
    name: user.name,
    role: user.role,
    department: user.department,
    firstInteraction: nowStr,
    lastInteraction: nowStr,
    interactionCount: 0,
    recentTopics: [],
    userNotes: [],
  };

  existingUser.interactionCount += 1;
  existingUser.lastInteraction = nowStr;
  existingUser.name = user.name;
  existingUser.role = user.role;
  existingUser.department = user.department;

  // Extract relevant topics from user message
  const lowerMsg = messageText.toLowerCase();
  const candidateTopics: string[] = [];

  if (lowerMsg.includes('turno') || lowerMsg.includes('horario') || lowerMsg.includes('cuadrante')) {
    candidateTopics.push('Diagramación de Turnos');
  }
  if (lowerMsg.includes('gasto') || lowerMsg.includes('ticket') || lowerMsg.includes('factura') || lowerMsg.includes('insumo')) {
    candidateTopics.push('Rendición de Gastos de Oficina');
  }
  if (lowerMsg.includes('cheque') || lowerMsg.includes('e-check') || lowerMsg.includes('debito')) {
    candidateTopics.push('Seguimiento de Cheques y E-Checks');
  }
  if (lowerMsg.includes('feriado') || lowerMsg.includes('noviembre') || lowerMsg.includes('efemeride')) {
    candidateTopics.push('Feriados y Calendario Laboral');
  }
  if (lowerMsg.includes('guardia') || lowerMsg.includes('objetivo') || lowerMsg.includes('relevo')) {
    candidateTopics.push('Cobertura de Puestos');
  }
  if (isEffectiveGerencia) {
    if (lowerMsg.includes('rentabilidad') || lowerMsg.includes('margen')) {
      candidateTopics.push('Rentabilidad por Cliente');
    }
    if (lowerMsg.includes('sueldo') || lowerMsg.includes('anticipo')) {
      candidateTopics.push('Sueldos y Anticipos Societarios');
    }
    if (lowerMsg.includes('cobranza') || lowerMsg.includes('impago')) {
      candidateTopics.push('Alertas de Cobranzas');
    }
  }

  // Merge unique topics
  for (const topic of candidateTopics) {
    if (!existingUser.recentTopics.includes(topic)) {
      existingUser.recentTopics.unshift(topic);
    }
    if (!memory.sharedDepartmentTopics.includes(topic)) {
      memory.sharedDepartmentTopics.unshift(topic);
    }
  }
  existingUser.recentTopics = existingUser.recentTopics.slice(0, 6);
  memory.sharedDepartmentTopics = memory.sharedDepartmentTopics.slice(0, 8);

  memory.knownUsers[user.id] = existingUser;
  saveDepartmentMemory(memory, isEffectiveGerencia);
  return memory;
}

/**
 * Handle direct inquiries about Bono's context memory.
 * e.g., "¿Qué recuerdas de mí?", "¿Qué sabes de mí?", "¿Qué habló Gerencia con vos?"
 */
export function handleBonoMemoryQuery(
  query: string,
  user: UserPersona,
  isEffectiveGerencia: boolean
): string | null {
  const q = query.toLowerCase().trim();

  const isMemoryQuestion =
    q.includes('memoria') ||
    q.includes('recuerdas de mi') ||
    q.includes('recuerdas de mí') ||
    q.includes('que sabes de mi') ||
    q.includes('qué sabes de mí') ||
    q.includes('a quienes conoces') ||
    q.includes('a quiénes conoces') ||
    q.includes('mis datos') ||
    q.includes('historial conmigo');

  const isAskingAboutOtherDept =
    q.includes('gerencia') &&
    (q.includes('que hablo') ||
      q.includes('qué habló') ||
      q.includes('que consulto') ||
      q.includes('qué consultó') ||
      q.includes('que te dijo') ||
      q.includes('qué te dijo') ||
      q.includes('conversacion') ||
      q.includes('conversación'));

  // 1. STRICT SECURITY: If non-gerencia asks what Gerencia spoke about
  if (!isEffectiveGerencia && isAskingAboutOtherDept) {
    return (
      `🔒 **Aislamiento de Seguridad y Reglas de Compartimentación:**\n\n` +
      `Estimado/a **${user.name.split(' ')[0]}**: Por directivas de seguridad corporativa en INVICT Security Solutions S.A., ` +
      `las interacciones, consultas y memorias del sector de **Gerencia General** son estrictamente confidenciales e inaccesibles desde el puesto de **${user.department}**.\n\n` +
      `Mi módulo de Memoria de Contexto opera con compartimentación departamental: solo conservo nuestro historial de trabajo operativo, tus preferencias de consulta y los registros de tareas y gastos autorizados para tu área.`
    );
  }

  if (!isMemoryQuestion) {
    return null;
  }

  // Load current department memory
  const memory = loadDepartmentMemory(user.department, isEffectiveGerencia);
  const userContext = memory.knownUsers[user.id];

  const firstName = user.name.split(' ')[0];

  if (!userContext || userContext.interactionCount <= 1) {
    return (
      `🧠 **Memoria de Contexto de BONO:**\n\n` +
      `¡Hola, **${firstName}**! Tengo registrado en mi memoria que eres **${user.role}** en el departamento de **${user.department}** de INVICT Security Solutions.\n\n` +
      `• **Nivel de Acceso Activo:** ${isEffectiveGerencia ? '🛡️ Acceso Total Gerencial' : `📋 Sector Operativo / Administrativo (${user.department})`}\n` +
      `• **Estado:** Acabamos de comenzar a interactuar en esta sesión. A medida que conversemos sobre tus tareas, consultas o gastos, recordaré tus temas habituales para brindarte respuestas cada vez más ágiles y personalizadas.\n\n` +
      `¿En qué tarea o consulta operativa deseas que nos enfoquemos hoy?`
    );
  }

  const topicsList =
    userContext.recentTopics.length > 0
      ? userContext.recentTopics.map((t) => `• ${t}`).join('\n')
      : '• Consultas operativas y seguimiento de tareas diarias';

  return (
    `🧠 **Memoria de Contexto Personalizada de BONO:**\n\n` +
    `¡Hola de nuevo, **${firstName}**! Conservo en mi memoria activa los siguientes datos de nuestra colaboración:\n\n` +
    `👤 **Perfil del Colaborador:**\n` +
    `• **Nombre:** ${user.name}\n` +
    `• **Puesto / Rol:** ${user.role} (${user.department})\n` +
    `• **Canal de Memoria:** ${isEffectiveGerencia ? '👑 Gerencia General (Acceso Societario Total)' : `🏢 ${user.department} (Aislamiento Operativo Seguro)`}\n` +
    `• **Interacciones Registradas:** ${userContext.interactionCount} consultas\n` +
    `• **Última Interacción:** ${userContext.lastInteraction}\n\n` +
    `📌 **Temas Principales que Sueles Consultar:**\n` +
    `${topicsList}\n\n` +
    `🔒 **Seguridad y Confidencialidad:** Tus memorias y preferencias se encuentran resguardadas bajo las políticas de visibilidad de INVICT. Puedes consultar o reiniciar esta memoria en cualquier momento.`
  );
}

/**
 * Returns a personalized system prompt snippet embedding the user context memory.
 */
export function getPersonalizedSystemPromptContext(
  user: UserPersona,
  isEffectiveGerencia: boolean
): string {
  const memory = loadDepartmentMemory(user.department, isEffectiveGerencia);
  const userContext = memory.knownUsers[user.id];

  const recentTopics = userContext?.recentTopics?.join(', ') || 'Tareas del puesto y consultas operativas';
  const count = userContext?.interactionCount || 1;

  if (isEffectiveGerencia) {
    return (
      `MEMORIA DE CONTEXTO GERENCIAL DE BONO:
- Usuario: ${user.name} (${user.role}, GERENCIA)
- Historial: ${count} interacciones registradas.
- Temas habituales: ${recentTopics}.
- Autorización: Acceso total societario e irrestricto. Dirígete con máxima cordialidad ejecutiva y precisión analítica.`
    );
  }

  return (
    `MEMORIA DE CONTEXTO OPERATIVA DE BONO:
- Usuario: ${user.name} (${user.role}, ${user.department})
- Historial: ${count} interacciones registradas en el sector ${user.department}.
- Temas habituales: ${recentTopics}.
- REGLA ESTRICTA DE AISLAMIENTO: NUNCA menciones ni compartas temas tratados con Gerencia General ni datos de sueldos o rentabilidad. Si el usuario pregunta qué consultó Gerencia, responde que por política de seguridad esa memoria es confidencial del Directorio.`
  );
}
