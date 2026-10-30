import { EmailNotificationLog, InternalMessage, UserPersona } from '../types';

const EMAIL_LOGS_STORAGE_KEY = 'invict_email_logs';

export function getEmailNotificationLogs(): EmailNotificationLog[] {
  const saved = localStorage.getItem(EMAIL_LOGS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing email logs:', e);
    }
  }
  return [
    {
      id: 'email-1',
      recipientEmail: 'pilar@invictsecurity.com.ar',
      recipientName: 'Pilar',
      senderName: 'Yamila',
      subject: '🚨 INVICT Alerta: Mención en Régimen Disciplinario - Carta Documento Herrera',
      bodySnippet: '@pilar por favor revisar el acuse de recibo de la intimación a Herrera por el relevo en Bodegas.',
      timestamp: '2026-10-14 09:15',
      status: 'Entregado',
      relatedTaskId: 't-oct-4',
    },
    {
      id: 'email-2',
      recipientEmail: 'consultasinvictsolutionss.a@gmail.com',
      recipientName: 'Dirección General (INVICT)',
      senderName: 'Kevin',
      subject: '📋 INVICT Alerta: Cronograma de Turnos y Relevos Quincenal',
      bodySnippet: '@gerencia Cronograma de turnos y relevos de vigiladores listo para validación quincenal.',
      timestamp: '2026-10-15 08:30',
      status: 'Entregado',
      relatedTaskId: 't-oct-3',
    },
  ];
}

export function saveEmailNotificationLogs(logs: EmailNotificationLog[]): void {
  localStorage.setItem(EMAIL_LOGS_STORAGE_KEY, JSON.stringify(logs));
}

export function sendEmailAlertForMention(
  message: InternalMessage,
  mentionedEmail: string,
  allPersonas: UserPersona[],
  taskTitle?: string
): EmailNotificationLog {
  const targetPersona = allPersonas.find(
    p => p.email.toLowerCase() === mentionedEmail.toLowerCase()
  );
  const recipientName = targetPersona
    ? targetPersona.name
    : (mentionedEmail.includes('gerencia') ? 'Gerencia General' : mentionedEmail);

  const now = new Date();
  const timeFormatted = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const subject = taskTitle
    ? `🚨 INVICT Alerta: ${message.authorName} te mencionó en "${taskTitle.slice(0, 40)}..."`
    : `🚨 INVICT Alerta: ${message.authorName} te mencionó en el Feed Corporativo`;

  const newLog: EmailNotificationLog = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: mentionedEmail,
    recipientName,
    senderName: message.authorName,
    subject,
    bodySnippet: message.content,
    timestamp: timeFormatted,
    status: 'Entregado',
    relatedTaskId: message.relatedTaskId || message.taskId,
  };

  const currentLogs = getEmailNotificationLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveEmailNotificationLogs(updatedLogs);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('invict-email-dispatched', { detail: newLog }));
  }

  return newLog;
}

export function sendMentionEmailAlert(params: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderEmail?: string;
  messageContent: string;
  taskTitle?: string;
}): EmailNotificationLog {
  const now = new Date();
  const timeFormatted = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const subject = params.taskTitle
    ? `🚨 INVICT Alerta: ${params.senderName} te mencionó en "${params.taskTitle.slice(0, 40)}..."`
    : `🚨 INVICT Alerta: ${params.senderName} te mencionó en el Feed Corporativo`;

  const newLog: EmailNotificationLog = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    senderName: params.senderName,
    subject,
    bodySnippet: params.messageContent,
    timestamp: timeFormatted,
    status: 'Entregado',
  };

  const currentLogs = getEmailNotificationLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveEmailNotificationLogs(updatedLogs);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('invict-email-dispatched', { detail: newLog }));
  }

  return newLog;
}

export function logSentEmailAlert(params: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderEmail?: string;
  subject: string;
  messageContent: string;
  type?: string;
}): EmailNotificationLog {
  const now = new Date();
  const timeFormatted = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const newLog: EmailNotificationLog = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    senderName: params.senderName,
    subject: params.subject,
    bodySnippet: params.messageContent,
    timestamp: timeFormatted,
    status: 'Entregado',
  };

  const currentLogs = getEmailNotificationLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveEmailNotificationLogs(updatedLogs);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('invict-email-dispatched', { detail: newLog }));
  }

  return newLog;
}

export function resendEmailAlert(logId: string): EmailNotificationLog | null {
  const currentLogs = getEmailNotificationLogs();
  let updatedLog: EmailNotificationLog | null = null;
  const newLogs = currentLogs.map(log => {
    if (log.id === logId) {
      updatedLog = {
        ...log,
        status: 'Reenviado' as const,
        timestamp: `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      };
      return updatedLog;
    }
    return log;
  });
  saveEmailNotificationLogs(newLogs);
  return updatedLog;
}

