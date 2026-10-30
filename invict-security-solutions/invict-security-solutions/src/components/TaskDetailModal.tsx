import React, { useState } from 'react';
import { Task, TaskStatus, TaskNature, UserPersona, TaskPriority, ShiftType, AreaType } from '../types';
import {
  X,
  Clock,
  User,
  Send,
  AtSign,
  Check,
  Mail,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Repeat,
  Cloud,
  History,
  Edit3,
  Save,
  ShieldCheck,
  MapPin,
  Shield
} from 'lucide-react';
import { calculateDaysRemaining, formatDateLocale } from '../utils/dateUtils';
import { sendMentionEmailAlert } from '../utils/emailAlertService';
import { triggerPersistentNotification } from '../utils/notificationService';
import { InvictLogo } from './InvictLogo';
import { PROFILE_METADATA } from '../utils/authService';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onUpdateTaskDetails?: (updatedTask: Task, actionDescription: string) => void;
  onAddComment: (taskId: string, commentText: string, author: string, mentions?: string[]) => void;
  currentPersona: UserPersona;
  allPersonas: UserPersona[];
  onRefreshEmailLogs?: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  onUpdateStatus,
  onUpdateTaskDetails,
  onAddComment,
  currentPersona,
  allPersonas,
  onRefreshEmailLogs,
}) => {
  const [commentText, setCommentText] = useState('');
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArea, setEditArea] = useState<AreaType>('OPERACIONES');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('Normal');
  const [editShift, setEditShift] = useState<ShiftType>('General');
  const [editObjective, setEditObjective] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const isGerencia = currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE';

  // Sync edit fields when task changes
  React.useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditArea(task.area);
      setEditAssignee(task.assignee);
      setEditDueDate(task.dueDate);
      setEditPriority(task.priority);
      setEditShift(task.shiftType || 'General');
      setEditObjective(task.objectiveLocation || 'Base Central');
      setEditNotes(task.notes || '');
      setEditError(null);
      setIsEditing(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const daysInfo = calculateDaysRemaining(task.dueDate, task.completedDate);

  // Available Puestos & Individual Collaborators for @ mentions
  const PUESTO_MENTIONS = [
    { tag: '@Gerencia', name: 'Gerencia General (C-Level)', email: 'consultasinvictsolutionss.a@gmail.com', isPuesto: true, badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700/60' },
    { tag: '@Operaciones', name: 'Operaciones (Puestos & Oficina)', email: 'operaciones@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-red-950/80 text-red-300 border-red-700/60' },
    { tag: '@Supervisión', name: 'Supervisión en Terreno / Móvil', email: 'supervision@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-700/60' },
    { tag: '@RRHH', name: 'Recursos Humanos', email: 'rrhh@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' },
    { tag: '@Administración', name: 'Administración & Finanzas', email: 'administracion@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-700/60' },
    { tag: '@Auxiliar', name: 'Auxiliar Administrativo', email: 'auxiliar@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60' },
    { tag: '@Selección', name: 'Selección & REPRIV', email: 'seleccion@invictsecurity.com.ar', isPuesto: true, badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-700/60' },
  ];

  const PERSONA_MENTIONS = allPersonas.map(p => ({
    tag: `@${p.name.split(' ')[0]}`,
    name: p.name,
    email: p.email,
    isPuesto: false,
    badgeBg: 'bg-[#1e2535] text-slate-200 border-[#2b364d]'
  }));

  const allAvailableMentions = [...PUESTO_MENTIONS, ...PERSONA_MENTIONS];

  const handleInsertMention = (tag: string) => {
    setCommentText(prev => (prev ? `${prev.trim()} ${tag} ` : `${tag} `));
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const mentionsFound: string[] = [];
    const mentionedLabels: string[] = [];

    allAvailableMentions.forEach(m => {
      // Regex checking for tag without @ or with @
      const cleanTag = m.tag.replace('@', '');
      const regex = new RegExp(`@${cleanTag}\\b`, 'i');
      if (regex.test(commentText)) {
        if (!mentionsFound.includes(m.email)) {
          mentionsFound.push(m.email);
        }
        if (!mentionedLabels.includes(m.tag)) {
          mentionedLabels.push(m.tag);
        }
      }
    });

    onAddComment(task.id, commentText, currentPersona.name, mentionsFound);

    if (mentionsFound.length > 0) {
      allAvailableMentions.forEach(m => {
        if (mentionsFound.includes(m.email)) {
          sendMentionEmailAlert({
            recipientEmail: m.email,
            recipientName: m.name,
            senderName: currentPersona.name,
            senderEmail: currentPersona.email,
            messageContent: commentText,
            taskTitle: task.title,
          });
        }
      });
      triggerPersistentNotification(
        `Mención en tarea: ${task.title}`,
        `${currentPersona.name} etiquetó a ${mentionedLabels.join(', ')}: ${commentText.slice(0, 80)}`,
        `task-${task.id}`
      );
      onRefreshEmailLogs?.();
      setAlertFeedback(`Alerta y correo despachados a: ${mentionedLabels.join(', ')}`);
      setTimeout(() => setAlertFeedback(null), 5000);
    }
    setCommentText('');
  };

  const handleSaveEdits = () => {
    if (!onUpdateTaskDetails) return;

    if (!isGerencia && editArea === 'GERENCIA') {
      setEditError('Acceso restringido: Los usuarios no-Gerencia no pueden asignar ni transferir tareas al área Gerencia.');
      return;
    }

    const changes: string[] = [];
    if (editTitle !== task.title) changes.push(`Título: "${editTitle}"`);
    if (editArea !== task.area) changes.push(`Área: "${editArea}"`);
    if (editAssignee !== task.assignee) changes.push(`Responsable: "${editAssignee}"`);
    if (editDueDate !== task.dueDate) changes.push(`Vencimiento: ${editDueDate}`);
    if (editPriority !== task.priority) changes.push(`Prioridad: ${editPriority}`);
    if (editNotes !== (task.notes || '')) changes.push('Notas actualizadas');

    const desc = changes.length > 0 ? `Modificó campos (${changes.join(', ')})` : 'Actualizó datos de la tarea';
    const updatedTask: Task = {
      ...task,
      title: editTitle,
      area: editArea,
      assignee: editAssignee,
      dueDate: editDueDate,
      priority: editPriority,
      notes: editNotes,
    };
    onUpdateTaskDetails(updatedTask, desc);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#121620] border border-[#273248] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <InvictLogo size="xs" variant="isotype" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#20293d] text-slate-300 border border-[#2d3a54]">
                {task.area}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ID: {task.id}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                Archivo en la Nube
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && onUpdateTaskDetails && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-[#1e2638] hover:bg-[#28344d] rounded-lg transition-colors border border-[#2d3950] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Editar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Audit Notice */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#141b29] to-[#0f1420] border border-blue-900/40 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-700/50 text-blue-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Última modificación registrada en la nube:
                </span>
                {task.lastModifiedBy ? (
                  <div className="text-white font-semibold">
                    <span>{task.lastModifiedBy.name}</span>{' '}
                    <span className="text-blue-400 font-bold">({task.lastModifiedBy.profile})</span>
                    <span className="text-slate-400 text-[11px] ml-1.5">
                      el {task.lastModifiedAt || 'Reciente'}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-300 text-[11px]">
                    Planilla base inicial de {task.monthPeriod || '2026-10'}
                  </span>
                )}
                {task.lastModifiedAction && (
                  <span className="text-[10px] text-slate-400 italic block mt-0.5">
                    Acción: {task.lastModifiedAction}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right hidden sm:block">
              <span className="text-[9px] uppercase font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                Sincronizado en Vivo
              </span>
            </div>
          </div>

          {/* Edit Form or Display */}
          {isEditing ? (
            <div className="p-4 rounded-xl bg-[#0f131d] border border-blue-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" />
                  Editando Tarea Compartida
                </span>
                <span className="text-[10px] text-slate-400">
                  Editor: <strong className="text-white">{currentPersona.name} ({currentPersona.profileType})</strong>
                </span>
              </div>
              {editError && (
                <div className="p-3 rounded-lg bg-red-950/80 border border-red-700/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Título de la Tarea</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Puesto / Área Asignada</label>
                  <select
                    value={editArea}
                    onChange={(e) => {
                      const val = e.target.value as AreaType;
                      if (!isGerencia && val === 'GERENCIA') {
                        setEditError('Acceso restringido: Solo el personal de Gerencia puede asignar tareas al área Gerencia.');
                        return;
                      }
                      setEditError(null);
                      setEditArea(val);
                    }}
                    className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white"
                  >
                    <option value="OPERACIONES">Operaciones (Puestos & Oficina)</option>
                    <option value="SUPERVISIÓN">Supervisión en Terreno / Móvil</option>
                    <option value="RRHH">Recursos Humanos (RR.HH.)</option>
                    <option value="ADM">Administración (ADM)</option>
                    <option value="AUX_ADM">Auxiliar Administrativo</option>
                    <option value="SELECCION">Selección de Personal</option>
                    {isGerencia ? (
                      <option value="GERENCIA">Gerencia General (C-Level)</option>
                    ) : (
                      <option value="GERENCIA" disabled className="text-slate-500">
                        Gerencia General [Bloqueado: Exclusivo Gerencia]
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Responsable</label>
                  <input
                    type="text"
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Prioridad</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-1.5 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Notas / Procedimientos</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#2b374e] rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Modificación</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {task.title}
              </h2>
              {task.notes && (
                <p className="text-xs text-slate-300 mt-2 bg-[#161b26] p-3 rounded-xl border border-[#242c3e] leading-relaxed">
                  {task.notes}
                </p>
              )}
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#0e121a] p-3.5 rounded-2xl border border-[#1f2638]">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Responsable Asignado</span>
              <span className="text-white font-semibold mt-0.5 block">{task.assignee}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Fecha Límite</span>
              <span className="text-slate-200 font-mono mt-0.5 block">{formatDateLocale(task.dueDate)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Semáforo</span>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border inline-block mt-0.5 ${daysInfo.badgeClass}`}>
                {daysInfo.label}
              </span>
            </div>
          </div>

          {/* Status Change Selector */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#161c28] border border-[#242f44]">
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Estado de Ejecución
              </span>
              <span className="text-[10px] text-slate-400">
                El cambio se notificará con su firma ({currentPersona.name})
              </span>
            </div>
            <select
              value={task.status}
              onChange={(e) => onUpdateStatus(task.id, e.target.value as TaskStatus)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#11141c] border border-[#2e3b52] text-white focus:outline-none focus:border-[#BE2629] cursor-pointer"
            >
              <option value="No iniciada">No iniciada</option>
              <option value="En curso">En curso</option>
              <option value="Completada">Completada</option>
              <option value="Urgente/Prioritaria">Urgente/Prioritaria</option>
            </select>
          </div>

          {alertFeedback && (
            <div className="p-2.5 bg-emerald-950/70 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>{alertFeedback}</span>
            </div>
          )}

          {/* Audit Revisions History */}
          {task.history && task.history.length > 0 && (
            <div className="pt-2 border-t border-[#22293b]">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Historial de Modificaciones ({task.history.length})
                </h3>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {task.history.map((rev) => (
                  <div key={rev.id} className="p-2 bg-[#0f1420] rounded-xl border border-[#222c40] text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{rev.userName}</span>{' '}
                      <span className="text-blue-400 text-[10px]">({rev.userProfile})</span>:
                      <span className="text-slate-300 ml-1">{rev.actionDescription}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {rev.formattedDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Thread */}
          <div className="pt-2 border-t border-[#22293b]">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#BE2629]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Historial de Comentarios & Notificaciones ({task.comments?.length || 0})
              </h3>
            </div>
            <div className="space-y-2.5 max-h-44 overflow-y-auto mb-4">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-[#141924] border border-[#222b3d] text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-white">{c.author}</span>
                      <span className="font-mono text-[10px]">{c.timestamp}</span>
                    </div>
                    <p className="text-slate-200 leading-snug">
                      {c.text.split(/(@\w+)/g).map((part, i) => {
                        if (part.startsWith('@')) {
                          return (
                            <span key={i} className="font-bold text-[#BE2629] bg-[#BE2629]/10 px-1 py-0.2 rounded">
                              {part}
                            </span>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs bg-[#10131b] rounded-xl">
                  No hay comentarios registrados en esta tarea.
                </div>
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSendComment} className="space-y-2.5">
              <div className="space-y-1.5 bg-[#0f1420] p-2.5 rounded-xl border border-[#1f283a]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mr-1">
                    Mencionar Puesto:
                  </span>
                  {PUESTO_MENTIONS.map(m => (
                    <button
                      key={m.tag}
                      type="button"
                      onClick={() => handleInsertMention(m.tag)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${m.badgeBg}`}
                      title={`Notificar a todo el equipo de ${m.name}`}
                    >
                      {m.tag}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/5">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Colaborador:</span>
                  {PERSONA_MENTIONS.map(m => (
                    <button
                      key={m.tag}
                      type="button"
                      onClick={() => handleInsertMention(m.tag)}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-[#18202e] hover:bg-[#232e42] text-slate-300 border border-[#2b374e] cursor-pointer transition-colors"
                    >
                      {m.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escribe una observación (ej: @Gerencia verificar protocolo antes de cerrar)..."
                  className="flex-1 px-3.5 py-2.5 bg-[#141822] border border-[#273248] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629]"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#BE2629] hover:bg-[#a62b2e] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Observación</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141926] border-t border-[#202737] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Los cambios se guardan y difunden a todos los puestos en la nube.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1b2232] hover:bg-[#252f44] text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
