import { AreaType, InternalMessage, TaskComment, UserPersona, UserProfileType } from '../types';

export interface PuestoMentionDef {
  tag: string;
  name: string;
  role: string;
  department: AreaType;
  profileType: UserProfileType;
  email: string;
  badgeBg: string;
  aliases: string[];
}

export const PUESTO_MENTION_DEFS: PuestoMentionDef[] = [
  {
    tag: '@Gerencia',
    name: 'Gerencia General',
    role: 'Dirección Ejecutiva',
    department: 'GERENCIA',
    profileType: 'GERENTE',
    email: 'consultasinvictsolutionss.a@gmail.com',
    badgeBg: 'bg-red-950/80 text-red-200 border-red-700/70',
    aliases: ['gerencia', 'gerente', 'yamila', 'domingo', 'direccion'],
  },
  {
    tag: '@Subgerencia',
    name: 'Sub Gerencia',
    role: 'Sub Gerencia / Vicepresidencia',
    department: 'SUB_GERENCIA',
    profileType: 'SUB_GERENTE',
    email: 'laura@invictsecurity.com.ar',
    badgeBg: 'bg-rose-950/80 text-rose-200 border-rose-700/70',
    aliases: ['subgerencia', 'sub_gerencia', 'subgerente', 'laura'],
  },
  {
    tag: '@Operaciones',
    name: 'Operaciones',
    role: 'Jefatura Operativa',
    department: 'OPERACIONES',
    profileType: 'operaciones',
    email: 'operaciones@invictsecurity.com.ar',
    badgeBg: 'bg-indigo-950/80 text-indigo-200 border-indigo-700/70',
    aliases: ['operaciones', 'marianela', 'sosa'],
  },
  {
    tag: '@Supervisión',
    name: 'Supervisión',
    role: 'Inspección y Móviles',
    department: 'SUPERVISIÓN',
    profileType: 'supervisión',
    email: 'supervision@invictsecurity.com.ar',
    badgeBg: 'bg-amber-950/80 text-amber-200 border-amber-700/70',
    aliases: ['supervision', 'supervisor', 'carlos', 'bilbao', 'pablo', 'tejera'],
  },
  {
    tag: '@RRHH',
    name: 'Recursos Humanos',
    role: 'Gestión de Personal',
    department: 'RRHH',
    profileType: 'recursos humanos',
    email: 'rrhh@invictsecurity.com.ar',
    badgeBg: 'bg-emerald-950/80 text-emerald-200 border-emerald-700/70',
    aliases: ['rrhh', 'rr.hh', 'recursoshumanos', 'recursos', 'tamara', 'alvarez', 'pilar'],
  },
  {
    tag: '@Administración',
    name: 'Administración',
    role: 'Facturación y Pagos',
    department: 'ADM',
    profileType: 'administración',
    email: 'administracion@invictsecurity.com.ar',
    badgeBg: 'bg-blue-950/80 text-blue-200 border-blue-700/70',
    aliases: ['administracion', 'administraci', 'adm', 'giuliana', 'giuli', 'paura'],
  },
  {
    tag: '@Auxiliar',
    name: 'Auxiliar Adm.',
    role: 'Asistencia Administrativa',
    department: 'AUX_ADM',
    profileType: 'auxiliar',
    email: 'auxiliar@invictsecurity.com.ar',
    badgeBg: 'bg-teal-950/80 text-teal-200 border-teal-700/70',
    aliases: ['auxiliar', 'aux_adm', 'auxadm', 'kevin', 'lorenzo', 'valeria'],
  },
  {
    tag: '@Selección',
    name: 'Selección',
    role: 'Reclutamiento e Ingresos',
    department: 'SELECCION',
    profileType: 'selección',
    email: 'seleccion@invictsecurity.com.ar',
    badgeBg: 'bg-purple-950/80 text-purple-200 border-purple-700/70',
    aliases: ['seleccion', 'reclutamiento', 'mariana'],
  },
];

export function normalizeMentionStr(str: string | undefined | null): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrae todos los tokens @mencionados dentro de un texto (normalizados sin tildes).
 * Ejemplo: "@RRHH se le dio de baja @Operaciones @Administraci ón" -> ['rrhh', 'operaciones', 'administraci']
 */
export function extractMentionTokens(text: string | undefined | null): string[] {
  const norm = normalizeMentionStr(text);
  if (!norm) return [];
  const matches = norm.match(/@([a-z0-9._]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1)).filter(Boolean);
}

/**
 * Determina si un texto o lista de menciones es público para todos (@todos o sin ninguna mención dirigida).
 */
export function isBroadcastToAll(text: string | undefined | null): boolean {
  const tokens = extractMentionTokens(text);
  return tokens.includes('todos') || tokens.includes('todo') || tokens.includes('all');
}

/**
 * Determina si un mensaje o comentario está dirigido a una o más personas/puestos específicos.
 * Si menciona a alguien con @ (y no tiene @todos) o tiene destinatarios en `mentions` / `isDirect`,
 * entonces es un mensaje dirigido y SOLO el autor y los mencionados pueden verlo y responderlo.
 */
export function isDirectedCommunication(params: {
  text?: string;
  mentions?: string[];
  isDirect?: boolean;
  recipientEmail?: string;
  recipientName?: string;
}): boolean {
  const { text, mentions, isDirect, recipientEmail, recipientName } = params;
  if (isBroadcastToAll(text)) return false;
  if (isDirect) return true;
  if (recipientEmail && recipientEmail.trim().length > 0) return true;
  if (recipientName && recipientName.trim().length > 0) return true;
  if (Array.isArray(mentions) && mentions.length > 0) return true;
  const tokens = extractMentionTokens(text);
  return tokens.length > 0;
}

/**
 * Verifica si un token `@...` corresponde a un usuario/puesto específico.
 */
function doesTokenMatchPersona(
  token: string,
  persona: UserPersona
): boolean {
  if (!token) return false;
  const cleanToken = normalizeMentionStr(token).replace(/^@/, '');
  if (!cleanToken) return false;

  // 1. Verificar por definición de puesto/departamento del usuario
  const myDept = persona.department;
  const myProfile = persona.profileType;

  for (const def of PUESTO_MENTION_DEFS) {
    const isMyDef =
      (myDept && def.department === myDept) ||
      (myProfile && def.profileType === myProfile);
    if (!isMyDef) continue;

    if (def.aliases.includes(cleanToken)) {
      return true;
    }
    // Soporte para palabras truncadas por espacio accidental, ej: "@administraci ón" -> token "administraci"
    if (
      cleanToken.length >= 5 &&
      def.aliases.some((alias) => alias.startsWith(cleanToken) || cleanToken.startsWith(alias))
    ) {
      // Evitar confusión entre 'adm' y 'aux_adm'
      if (def.department === 'ADM' && cleanToken.startsWith('aux')) continue;
      if (def.department === 'AUX_ADM' && cleanToken === 'adm') continue;
      return true;
    }
  }

  // 2. Verificar por nombre propio actual del usuario en `persona.name`
  const nameParts = normalizeMentionStr(persona.name)
    .split(/[\s/()-]+/)
    .filter((part) => part.length >= 3 && !['invict', 'general', 'direccion', 'movil', 'zona'].includes(part));

  if (nameParts.some((part) => part === cleanToken)) {
    return true;
  }

  // 3. Verificar por prefijo del email del usuario (antes de @)
  const emailUser = normalizeMentionStr((persona.email || '').split('@')[0]);
  if (emailUser && emailUser.length >= 3 && emailUser === cleanToken) {
    return true;
  }

  return false;
}

/**
 * Verifica si un email en `mentions` o `recipientEmail` corresponde a `persona`.
 */
function doesEmailMatchPersona(
  rawEmail: string | undefined | null,
  persona: UserPersona,
  allPersonas?: UserPersona[]
): boolean {
  if (!rawEmail) return false;
  const email = rawEmail.trim().toLowerCase();
  if (!email) return false;

  // Coincidencia exacta de email
  if (persona.email && persona.email.trim().toLowerCase() === email) {
    return true;
  }

  // Coincidencia por email institucional del puesto (PUESTO_MENTION_DEFS)
  for (const def of PUESTO_MENTION_DEFS) {
    if (def.email.toLowerCase() === email) {
      if (persona.department === def.department || persona.profileType === def.profileType) {
        return true;
      }
    }
  }

  // Si en `allPersonas` ese email pertenece al mismo departamento que `persona`
  if (allPersonas && persona.department && persona.department !== 'TODOS') {
    const matchedOwner = allPersonas.find(
      (p) => p.email && p.email.trim().toLowerCase() === email
    );
    if (matchedOwner && matchedOwner.department === persona.department) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica si `persona` es el autor del mensaje o comentario.
 */
export function isPersonaMessageAuthor(
  persona: UserPersona,
  authorName?: string,
  authorEmail?: string,
  authorProfile?: UserProfileType
): boolean {
  if (authorEmail && persona.email) {
    if (authorEmail.trim().toLowerCase() === persona.email.trim().toLowerCase()) {
      return true;
    }
  }

  if (authorProfile && persona.profileType && authorProfile === persona.profileType) {
    return true;
  }

  const normAuthor = normalizeMentionStr(authorName);
  const normMyName = normalizeMentionStr(persona.name);
  if (normAuthor && normMyName) {
    if (normAuthor === normMyName) return true;
    // Ej: "Carlos Bilbao (Supervisor)" vs "Carlos Bilbao" o "Bilbao (Supervisión Móvil)"
    const myFirst = normMyName.split(/[\s/()-]+/)[0];
    const authorFirst = normAuthor.split(/[\s/()-]+/)[0];
    if (myFirst && myFirst.length >= 4 && myFirst === authorFirst) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica si `persona` fue mencionada explícitamente en el texto o en los metadatos del mensaje.
 */
export function isPersonaMentioned(
  persona: UserPersona,
  params: {
    text?: string;
    mentions?: string[];
    recipientEmail?: string;
    recipientName?: string;
  },
  allPersonas?: UserPersona[]
): boolean {
  const { text, mentions, recipientEmail, recipientName } = params;

  // 1. Verificar tokens @ en el texto
  const tokens = extractMentionTokens(text);
  if (tokens.some((token) => doesTokenMatchPersona(token, persona))) {
    return true;
  }

  // 2. Verificar recipientName si existe
  if (recipientName) {
    const recipientTokens = normalizeMentionStr(recipientName).split(/[\s/()-]+/);
    if (recipientTokens.some((t) => doesTokenMatchPersona(t, persona))) {
      return true;
    }
  }

  // 3. Verificar recipientEmail si existe
  if (doesEmailMatchPersona(recipientEmail, persona, allPersonas)) {
    return true;
  }

  // 4. Verificar array `mentions` (SOLO si en el texto no hay @tokens explícitos que contradigan,
  // o si el email de `mentions` corresponde directamente al usuario/puesto mencionado)
  if (Array.isArray(mentions) && mentions.length > 0) {
    if (mentions.some((mEmail) => doesEmailMatchPersona(mEmail, persona, allPersonas))) {
      // Atención: antiguamente el sistema agregaba 'consultasinvictsolutionss.a@gmail.com' como copia oculta
      // cuando no había menciones. Por eso, si el email es consultasinvictsolutionss.a@gmail.com y en el texto
      // hay otros @tokens explícitos (ej: "@Auxiliar @Operaciones") pero NO está "@Gerencia",
      // solo es mención a Gerencia si el texto menciona a Gerencia o no hay otros @tokens.
      const isGerenciaUser =
        persona.department === 'GERENCIA' || persona.profileType === 'GERENTE';
      if (isGerenciaUser && tokens.length > 0) {
        const gerenciaExplicitInText = tokens.some((t) => doesTokenMatchPersona(t, persona));
        if (!gerenciaExplicitInText) {
          return false;
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Regla central de privacidad para Mensajes del Feed (`InternalMessage`):
 * - Si el mensaje es dirigido a una o más personas/puestos (tiene `@mención`, `mentions`, `isDirect`, etc. y NO tiene `@todos`),
 *   SOLO el autor del mensaje y la(s) persona(s)/puesto(s) mencionada(s) pueden visualizarlo y responderlo.
 * - Si el mensaje NO tiene destinatarios específicos (o tiene `@todos`), todos pueden visualizarlo.
 */
export function canPersonaViewMessage(
  msg: InternalMessage,
  currentPersona: UserPersona,
  allPersonas?: UserPersona[]
): boolean {
  const directed = isDirectedCommunication({
    text: msg.content,
    mentions: msg.mentions,
    isDirect: msg.isDirect,
    recipientEmail: msg.recipientEmail,
    recipientName: msg.recipientName,
  });

  if (!directed) {
    return true;
  }

  if (isPersonaMessageAuthor(currentPersona, msg.authorName, msg.authorEmail)) {
    return true;
  }

  return isPersonaMentioned(
    currentPersona,
    {
      text: msg.content,
      mentions: msg.mentions,
      recipientEmail: msg.recipientEmail,
      recipientName: msg.recipientName,
    },
    allPersonas
  );
}

/**
 * Regla central de privacidad para Comentarios dentro de una Tarea (`TaskComment`):
 * - Si el comentario menciona a una o más personas/puestos específicos (`@...` y no `@todos`),
 *   SOLO el autor del comentario y la(s) persona(s)/puesto(s) mencionada(s) pueden visualizarlo y responderlo.
 */
export function canPersonaViewComment(
  comment: TaskComment,
  currentPersona: UserPersona,
  allPersonas?: UserPersona[]
): boolean {
  const directed = isDirectedCommunication({
    text: comment.text,
  });

  if (!directed) {
    return true;
  }

  if (isPersonaMessageAuthor(currentPersona, comment.author, comment.authorEmail, comment.authorProfile)) {
    return true;
  }

  return isPersonaMentioned(
    currentPersona,
    {
      text: comment.text,
    },
    allPersonas
  );
}

/**
 * Devuelve la etiqueta `@Nombre` o `@Puesto` ideal para responderle al autor de un mensaje/comentario.
 */
export function getReplyMentionTagForAuthor(authorName: string, authorRole?: string): string {
  const normName = normalizeMentionStr(authorName);
  const normRole = normalizeMentionStr(authorRole);

  if (normName.includes('yamila') || normName.includes('direccion') || normRole.includes('gerente general')) {
    return '@Gerencia';
  }
  if (normName.includes('laura') || normRole.includes('sub gerente') || normRole.includes('subgerencia')) {
    return '@Subgerencia';
  }
  if (normName.includes('marianela') || normRole.includes('operaciones')) {
    return '@Operaciones';
  }
  if (normName.includes('carlos') || normName.includes('bilbao')) {
    return '@Carlos';
  }
  if (normName.includes('pablo') || normName.includes('tejera')) {
    return '@Pablo';
  }
  if (normRole.includes('supervisor') || normRole.includes('supervision')) {
    return '@Supervisión';
  }
  if (normName.includes('tamara') || normName.includes('pilar') || normRole.includes('recursos humanos') || normRole.includes('rrhh')) {
    return '@RRHH';
  }
  if (normName.includes('giuliana') || normRole.includes('administracion')) {
    return '@Administración';
  }
  if (normName.includes('kevin') || normName.includes('valeria') || normRole.includes('auxiliar')) {
    return '@Auxiliar';
  }
  if (normName.includes('seleccion') || normName.includes('mariana')) {
    return '@Selección';
  }

  const firstWord = (authorName || '').trim().split(/\s+/)[0] || 'Usuario';
  return `@${firstWord}`;
}

/**
 * Extrae las etiquetas legibles de los destinatarios mencionados en un mensaje/comentario.
 */
export function getDirectedRecipientsSummary(text: string, recipientName?: string): string {
  if (recipientName) return recipientName;
  const matches = String(text || '').match(/@([A-Za-zÁÉÍÓÚáéíóúÑñ0-9._]+)/g);
  if (!matches || matches.length === 0) return 'Destinatario';
  return Array.from(new Set(matches)).join(', ');
}
