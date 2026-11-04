import React, { useState, useMemo } from 'react';
import { InternalMessage, UserPersona, Task } from '../types';
import {
  Send,
  AtSign,
  MessageSquare,
  Mail,
  Check,
  RotateCw,
  Trash2,
  Lock
} from 'lucide-react';
import { sendMentionEmailAlert } from '../utils/emailAlertService';
import { triggerPersistentNotification } from '../utils/notificationService';

interface InvictFeedViewProps {
  messages: InternalMessage[];
  currentPersona: UserPersona;
  allPersonas: UserPersona[];
  onSendMessage: (content: string, mentions: string[], taskId?: string, directMeta?: { isDirect: boolean; recipientEmail?: string; recipientName?: string }) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClearOldMessages?: () => void;
  tasks: Task[];
  onRefreshEmailLogs?: () => void;
  onOpenEmailAlertsModal?: () => void;
  focusedMessageId?: string | null;
  onClearFocusedMessage?: () => void;
  onSelectTask?: (task: Task) => void;
}

export const InvictFeedView: React.FC<InvictFeedViewProps> = ({
  messages,
  currentPersona,
  allPersonas,
  onSendMessage,
  onDeleteMessage,
  onClearOldMessages,
  tasks,
  onRefreshEmailLogs,
  onOpenEmailAlertsModal,
  focusedMessageId,
  onClearFocusedMessage,
  onSelectTask,
}) => {
  const [content, setContent] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'mentions' | 'direct'>('all');
  const [lastNotificationStatus, setLastNotificationStatus] = useState<string | null>(null);
  const isExecutive = currentPersona.department === 'GERENCIA' || currentPersona.department === 'SUB_GERENCIA' || currentPersona.profileType === 'GERENTE' || currentPersona.profileType === 'SUB_GERENTE';

  // Detecta si se está mencionando a 1 sola persona (mensaje privado directo)
  const detectedSingleRecipient = useMemo(() => {
    if (!content.trim()) return null;
    if (/@todos\b/i.test(content)) return null;
    const normContent = content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const matches: UserPersona[] = [];
    allPersonas.forEach((p) => {
      const firstName = p.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const dept = (p.department || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const prof = (p.profileType || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        (firstName && normContent.includes(`@${firstName}`)) ||
        (dept && normContent.includes(`@${dept}`)) ||
        (prof && normContent.includes(`@${prof}`))
      ) {
        if (!matches.some(m => m.email === p.email)) {
          matches.push(p);
        }
      }
    });

    return matches.length === 1 ? matches[0] : null;
  }, [content, allPersonas]);

  React.useEffect(() => {
    if (focusedMessageId) {
      setFilterMode('all');
      setTimeout(() => {
        const el = document.getElementById(`feed-msg-${focusedMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
    }
  }, [focusedMessageId]);

  const mentionList = allPersonas.map(p => ({
    tag: `@${p.name.split(' ')[0]}`,
    name: p.name,
    email: p.email,
    role: p.role,
  }));

  const handleInsertMention = (tag: string) => {
    setContent((prev) => (prev ? `${prev} ${tag} ` : `${tag} `));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const foundMentions: string[] = [];
    const mentionedNames: string[] = [];
    const normContent = content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    allPersonas.forEach((p) => {
      const firstName = p.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const dept = (p.department || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const prof = (p.profileType || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        (firstName && normContent.includes(`@${firstName}`)) ||
        (dept && normContent.includes(`@${dept}`)) ||
        (prof && normContent.includes(`@${prof}`)) ||
        normContent.includes('@todos')
      ) {
        if (!foundMentions.includes(p.email)) {
          foundMentions.push(p.email);
          mentionedNames.push(p.name);
        }
      }
    });

    if (/@todos\b/i.test(content) && !foundMentions.includes('consultasinvictsolutionss.a@gmail.com')) {
      foundMentions.push('consultasinvictsolutionss.a@gmail.com');
      mentionedNames.push('Todo el Equipo');
    }

    const isSingleDirect = foundMentions.length === 1 && !/@todos\b/i.test(content) && foundMentions[0] !== 'consultasinvictsolutionss.a@gmail.com';
    const directMeta = isSingleDirect ? {
      isDirect: true,
      recipientEmail: foundMentions[0],
      recipientName: mentionedNames[0] || allPersonas.find(p => p.email === foundMentions[0])?.name,
    } : undefined;

    onSendMessage(content, foundMentions, selectedTaskId || undefined, directMeta);

    if (foundMentions.length > 0) {
      mentionList.forEach((m) => {
        if (foundMentions.includes(m.email)) {
          sendMentionEmailAlert({
            recipientEmail: m.email,
            recipientName: m.name,
            senderName: currentPersona.name,
            senderEmail: currentPersona.email,
            messageContent: content,
            taskTitle: tasks.find(t => t.id === selectedTaskId)?.title,
          });
        }
      });

      triggerPersistentNotification(
        `Mención de ${currentPersona.name}`,
        content.slice(0, 100),
        'invict-mention',
        `/`
      );

      onRefreshEmailLogs?.();
      setLastNotificationStatus(
        `Alerta por correo electrónico despachada a: ${mentionedNames.join(', ')}`
      );
      setTimeout(() => setLastNotificationStatus(null), 7000);
    }

    setContent('');
    setSelectedTaskId('');
  };

  const filteredMessages = messages.filter((msg) => {
    if (msg.id?.startsWith('msg-oct-') || msg.id === 'msg-1' || msg.id === 'msg-2') return false;
    if (msg.timestamp && (msg.timestamp.includes('/10/2026') || msg.timestamp.includes('2026-10'))) return false;

    // Aislamiento estricto de mensajes privados individuales:
    const isDirect = msg.isDirect || (
      Array.isArray(msg.mentions) &&
      msg.mentions.length === 1 &&
      msg.mentions[0].toLowerCase() !== 'consultasinvictsolutionss.a@gmail.com' &&
      !msg.content.toLowerCase().includes('@todos')
    );

    if (isDirect) {
      const isAuthor =
        (msg.authorEmail && msg.authorEmail.toLowerCase() === currentPersona.email.toLowerCase()) ||
        (msg.authorName && msg.authorName.toLowerCase() === currentPersona.name.toLowerCase());

      const targetEmail = (msg.recipientEmail || (Array.isArray(msg.mentions) ? msg.mentions[0] : '') || '').toLowerCase();
      const isRecipient =
        (targetEmail && targetEmail === currentPersona.email.toLowerCase()) ||
        (msg.recipientName && msg.recipientName.toLowerCase() === currentPersona.name.toLowerCase()) ||
        (Array.isArray(msg.mentions) && msg.mentions.some(e => e.toLowerCase() === currentPersona.email.toLowerCase())) ||
        (msg.content && msg.content.toLowerCase().includes(`@${currentPersona.name.split(' ')[0].toLowerCase()}`));

      if (!isAuthor && !isRecipient) return false;
    }

    if (filterMode === 'mentions') {
      const myFirstName = currentPersona.name.split(' ')[0].toLowerCase();
      const hasMyEmail = msg.mentions.includes(currentPersona.email);
      const hasMyName = msg.content.toLowerCase().includes(`@${myFirstName}`);
      return hasMyEmail || hasMyName;
    }

    if (filterMode === 'direct') {
      return isDirect;
    }

    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#121620] border border-[#22293b] rounded-2xl shadow">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/50 rounded flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Comunicación Operativa
            </span>
            <span className="text-xs text-slate-400">Canal Seguro Oficina Central</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Invict Feed: Novedades & Hilos de Tareas
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Usa <strong className="text-white">@nombre</strong> para notificar al puesto responsable y disparar automáticamente una alerta por correo electrónico corporativo.
          </p>
        </div>

        {onOpenEmailAlertsModal && (
          <button
            onClick={onOpenEmailAlertsModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-xl transition-colors active:scale-95 whitespace-nowrap self-start sm:self-center cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ver Bandeja de Alertas por Correo</span>
          </button>
        )}
      </div>

      {/* Real-time Alert Confirmation Banner */}
      {lastNotificationStatus && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastNotificationStatus}</span>
          </div>
          {onOpenEmailAlertsModal && (
            <button
              onClick={onOpenEmailAlertsModal}
              className="text-[11px] underline hover:text-white shrink-0 font-medium cursor-pointer"
            >
              Ver registro de envíos
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Form on left, Feed on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#121620] border border-[#22293b] rounded-2xl p-5 shadow space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-[#22293b] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <AtSign className="w-3.5 h-3.5 text-[#BE2629]" />
              Redactar Novedad Operativa
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {currentPersona.name}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Etiquetar para enviar alerta (@):
              </label>
              <div className="flex flex-wrap gap-1">
                {mentionList.map((m) => (
                  <button
                    key={m.tag}
                    type="button"
                    onClick={() => handleInsertMention(m.tag)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-[#181e2b] hover:bg-[#252f44] text-slate-300 hover:text-white border border-[#273248] transition-colors cursor-pointer"
                  >
                    {m.tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleInsertMention('@todos')}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors cursor-pointer"
                >
                  @todos
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Vincular a Tarea (Opcional):
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full text-xs p-2 bg-[#161a23] border border-[#262c3b] rounded-xl text-slate-200 focus:outline-none focus:border-[#BE2629] cursor-pointer"
              >
                <option value="">-- Sin vincular a una tarea específica --</option>
                {tasks.slice(0, 15).map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.area}] {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Mensaje o novedad:
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ejemplo: @Giuliana ya fueron enviadas las facturas de Kraft. Por favor ingresar el recibo de pago..."
                rows={4}
                className="w-full text-xs p-3 bg-[#161a23] border border-[#262c3b] rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] resize-none"
              />
            </div>

            {detectedSingleRecipient && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-[11px] text-purple-200 flex items-start gap-2 shadow-sm animate-in fade-in">
                <Lock className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                <div className="leading-snug">
                  <span className="font-bold text-white block">🔒 Mensaje Privado Individual</span>
                  <span>
                    Mencionas únicamente a <strong>{detectedSingleRecipient.name}</strong> ({detectedSingleRecipient.role}). Este mensaje <strong>solo llegará a esa persona</strong>; el resto del personal no tendrá acceso para visualizarlo.
                  </span>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#1e2538] text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Mail className="w-3.5 h-3.5" />
                <span>Alerta por correo electrónico activa</span>
              </div>
              <p className="leading-snug">
                Cada @ dispara un correo automático a la casilla corporativa del usuario mencionado con copia para auditoría.
              </p>
            </div>

            <button
              type="submit"
              disabled={!content.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow transition-colors active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publicar & Despachar Alerta</span>
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Feed Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-3 bg-[#121620] border border-[#22293b] rounded-2xl shadow flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-[#BE2629] text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas las Comunicaciones
              </button>
              <button
                onClick={() => setFilterMode('mentions')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filterMode === 'mentions'
                    ? 'bg-[#BE2629] text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AtSign className="w-3 h-3" />
                <span>Menciones hacia mí ({currentPersona.name.split(' ')[0]})</span>
              </button>
              <button
                onClick={() => setFilterMode('direct')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  filterMode === 'direct'
                    ? 'bg-purple-700 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3 h-3 text-purple-400" />
                <span>Mensajes Privados (1 a 1)</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredMessages.length} mensajes registrados
              </span>
              {onClearOldMessages && isExecutive && (
                <button
                  type="button"
                  onClick={onClearOldMessages}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar del feed mensajes antiguos o previos al uso real"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span className="hidden sm:inline">Limpiar Chats de Prueba</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredMessages.map((msg) => {
              const linkedTask = tasks.find(t => t.id === msg.taskId);
              const normText = (msg.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const myFirst = (currentPersona.name.split(' ')[0] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const isDirectMention =
                msg.mentions.some(e => e.toLowerCase() === currentPersona.email.toLowerCase()) ||
                (myFirst && normText.includes(`@${myFirst}`)) ||
                normText.includes('@todos');
              const isFocused = focusedMessageId === msg.id;
              const isDirectMsg = msg.isDirect || (
                Array.isArray(msg.mentions) &&
                msg.mentions.length === 1 &&
                msg.mentions[0].toLowerCase() !== 'consultasinvictsolutionss.a@gmail.com' &&
                !msg.content.toLowerCase().includes('@todos')
              );
              const isMsgAuthor = (msg.authorEmail && msg.authorEmail.toLowerCase() === currentPersona.email.toLowerCase()) ||
                (msg.authorName && msg.authorName.toLowerCase() === currentPersona.name.toLowerCase());

              return (
                <div
                  id={`feed-msg-${msg.id}`}
                  key={msg.id}
                  onClick={() => isFocused && onClearFocusedMessage?.()}
                  className={`p-4 border rounded-2xl shadow transition-all ${
                    isFocused
                      ? 'border-cyan-400 ring-2 ring-cyan-500/50 bg-[#172236]'
                      : isDirectMsg
                      ? 'border-purple-800/70 bg-gradient-to-r from-[#141221] to-[#121620] shadow-purple-950/20'
                      : isDirectMention
                      ? 'border-[#BE2629]/60 bg-[#161a26]'
                      : 'border-[#22293b] bg-[#121620] hover:border-[#2f384f]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#1e273a] text-slate-200 border border-[#2c3750] flex items-center justify-center font-bold text-xs shrink-0">
                        {msg.authorName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {msg.authorName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({msg.authorRole})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {msg.mentions.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1" title="Alerta por correo despachada">
                          <Mail className="w-2.5 h-2.5" />
                          <span>Notificado</span>
                        </span>
                      )}
                      {isDirectMsg && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700/80 flex items-center gap-1 shadow-sm">
                          <Lock className="w-2.5 h-2.5 text-purple-400" />
                          <span>{isMsgAuthor ? `Privado para ${msg.recipientName || 'destinatario'}` : `Privado para ti`}</span>
                        </span>
                      )}
                      {isDirectMention && !isDirectMsg && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#BE2629] text-white">
                          Te mencionó
                        </span>
                      )}
                      {onDeleteMessage && (isExecutive || msg.authorName === currentPersona.name) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Deseas eliminar este mensaje del Feed?')) {
                              onDeleteMessage(msg.id);
                            }
                          }}
                          title="Eliminar este mensaje"
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors ml-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap pl-10">
                    {msg.content.split(/(@\w+)/g).map((part, i) => {
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

                  {linkedTask && (
                    <div
                      onClick={() => onSelectTask?.(linkedTask)}
                      className="mt-3 ml-10 p-2.5 bg-[#0e121a] hover:bg-[#161e2e] rounded-xl border border-[#202737] hover:border-blue-500/50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-[#202737] text-slate-300 rounded shrink-0">
                          {linkedTask.area}
                        </span>
                        <span className="text-slate-300 truncate">
                          Tarea: <strong className="text-white">{linkedTask.title}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 shrink-0 font-bold">
                        Abrir Tarea ({linkedTask.status}) →
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredMessages.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs bg-[#121620] border border-[#22293b] rounded-2xl">
                No hay comunicaciones para mostrar bajo este filtro.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
