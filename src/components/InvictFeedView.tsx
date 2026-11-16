import React, { useState, useMemo, useRef } from 'react';
import { InternalMessage, UserPersona, Task } from '../types';
import {
  Send,
  AtSign,
  MessageSquare,
  Mail,
  Trash2,
  Lock,
  Reply
} from 'lucide-react';
import { sendMentionEmailAlert } from '../utils/emailAlertService';
import { triggerPersistentNotification } from '../utils/notificationService';
import {
  PUESTO_MENTION_DEFS,
  canPersonaViewMessage,
  isDirectedCommunication,
  isPersonaMentioned,
  isPersonaMessageAuthor,
  getReplyMentionTagForAuthor,
  getDirectedRecipientsSummary
} from '../utils/messagePrivacyUtils';

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
  const [replyingToLabel, setReplyingToLabel] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isExecutive =
    currentPersona.department === 'GERENCIA' ||
    currentPersona.department === 'SUB_GERENCIA' ||
    currentPersona.profileType === 'GERENTE' ||
    currentPersona.profileType === 'SUB_GERENTE';

  // Detecta destinatarios específicos (@persona o @puesto) cuando no es @todos
  const detectedDirectedInfo = useMemo(() => {
    if (!content.trim()) return null;
    const isDirected = isDirectedCommunication({ text: content });
    if (!isDirected) return null;

    const summary = getDirectedRecipientsSummary(content);
    return {
      summary,
    };
  }, [content]);

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
    setTimeout(() => textareaRef.current?.focus(), 20);
  };

  const handleReplyToMessage = (msg: InternalMessage) => {
    const isAuthor = isPersonaMessageAuthor(currentPersona, msg.authorName, msg.authorEmail);
    const replyTag = isAuthor
      ? getDirectedRecipientsSummary(msg.content, msg.recipientName)
          .split(',')[0]
          .trim()
      : getReplyMentionTagForAuthor(msg.authorName, msg.authorRole);
    const normalizedTag = replyTag.startsWith('@') ? replyTag : `@${replyTag}`;

    if (msg.taskId) {
      setSelectedTaskId(msg.taskId);
    }
    setReplyingToLabel(`${msg.authorName} (${normalizedTag})`);
    setContent((prev) => {
      if (prev.toLowerCase().includes(normalizedTag.toLowerCase())) return prev;
      return `${normalizedTag} ${prev}`.trim() + ' ';
    });
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const foundMentions: string[] = [];
    const mentionedNames: string[] = [];

    // 1. Verificar menciones a puestos institucionales (PUESTO_MENTION_DEFS)
    PUESTO_MENTION_DEFS.forEach((def) => {
      const dummyPersona: UserPersona = {
        id: `def-${def.department}`,
        name: def.name,
        email: def.email,
        role: def.role,
        department: def.department,
        profileType: def.profileType,
        avatarBg: 'bg-slate-700',
      };
      if (isPersonaMentioned(dummyPersona, { text: content }, allPersonas)) {
        if (!foundMentions.includes(def.email)) {
          foundMentions.push(def.email);
          mentionedNames.push(`${def.name} (${def.tag})`);
        }
      }
    });

    // 2. Verificar menciones a colaboradores de allPersonas
    allPersonas.forEach((p) => {
      if (isPersonaMentioned(p, { text: content }, allPersonas) || /@todos\b/i.test(content)) {
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

    const isDirected = isDirectedCommunication({ text: content, mentions: foundMentions });
    const recipientSummary = isDirected ? getDirectedRecipientsSummary(content) : undefined;
    const directMeta = isDirected
      ? {
          isDirect: true,
          recipientEmail: foundMentions.length === 1 ? foundMentions[0] : undefined,
          recipientName: recipientSummary || mentionedNames.join(', '),
        }
      : undefined;

    onSendMessage(content, foundMentions, selectedTaskId || undefined, directMeta);

    if (foundMentions.length > 0) {
      foundMentions.forEach((targetEmail, idx) => {
        sendMentionEmailAlert({
          recipientEmail: targetEmail,
          recipientName: mentionedNames[idx] || targetEmail,
          senderName: currentPersona.name,
          senderEmail: currentPersona.email,
          messageContent: content,
          taskTitle: tasks.find(t => t.id === selectedTaskId)?.title,
        });
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
    setReplyingToLabel(null);
  };

  const filteredMessages = messages.filter((msg) => {
    if (msg.id?.startsWith('msg-oct-') || msg.id === 'msg-1' || msg.id === 'msg-2') return false;
    if (msg.timestamp && (msg.timestamp.includes('/10/2026') || msg.timestamp.includes('2026-10'))) return false;

    // Aislamiento estricto de mensajes dirigidos:
    // Si el mensaje va dirigido a una o más personas/puestos, SOLO el autor y los mencionados pueden visualizarlo y responderlo.
    if (!canPersonaViewMessage(msg, currentPersona, allPersonas)) {
      return false;
    }

    const isDirect = isDirectedCommunication({
      text: msg.content,
      mentions: msg.mentions,
      isDirect: msg.isDirect,
      recipientEmail: msg.recipientEmail,
      recipientName: msg.recipientName,
    });

    if (filterMode === 'mentions') {
      if (isPersonaMessageAuthor(currentPersona, msg.authorName, msg.authorEmail)) return false;
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
            {replyingToLabel && (
              <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-700/60 text-[11px] text-blue-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <Reply className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">
                    Respondiendo a: <strong>{replyingToLabel}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToLabel(null)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                  Dirigir a Puesto (@):
                </label>
                <div className="flex flex-wrap gap-1">
                  {PUESTO_MENTION_DEFS.map((m) => (
                    <button
                      key={m.tag}
                      type="button"
                      onClick={() => handleInsertMention(m.tag)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${m.badgeBg}`}
                      title={`Dirigir mensaje exclusivamente a ${m.name}`}
                    >
                      {m.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  Dirigir a Colaborador (@):
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
                    title="Visible para todos los usuarios"
                  >
                    @todos
                  </button>
                </div>
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
                {tasks.slice(0, 30).map((t) => (
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
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ejemplo: @Giuliana ya fueron enviadas las facturas de Kraft. Por favor ingresar el recibo de pago..."
                rows={4}
                className="w-full text-xs p-3 bg-[#161a23] border border-[#262c3b] rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] resize-none"
              />
            </div>

            {detectedDirectedInfo && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-[11px] text-purple-200 flex items-start gap-2 shadow-sm animate-in fade-in">
                <Lock className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                <div className="leading-snug">
                  <span className="font-bold text-white block">🔒 Mensaje Dirigido Privado</span>
                  <span>
                    Dirigido a <strong>{detectedDirectedInfo.summary}</strong>. Únicamente esa(s) persona(s) tendrán acceso a visualizar este mensaje y responderlo (oculto para el resto de usuarios).
                  </span>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#1e2538] text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Mail className="w-3.5 h-3.5" />
                <span>Alerta y privacidad activa</span>
              </div>
              <p className="leading-snug">
                Si etiquetas a una persona o puesto con @, solo los mencionados podrán ver y responder el mensaje.
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
                Todas mis Comunicaciones
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
                <span>Mensajes Dirigidos (@)</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredMessages.length} mensajes visibles
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
              const isDirectMention = isPersonaMentioned(
                currentPersona,
                {
                  text: msg.content,
                  mentions: msg.mentions,
                  recipientEmail: msg.recipientEmail,
                  recipientName: msg.recipientName,
                },
                allPersonas
              );
              const isFocused = focusedMessageId === msg.id;
              const isDirectMsg = isDirectedCommunication({
                text: msg.content,
                mentions: msg.mentions,
                isDirect: msg.isDirect,
                recipientEmail: msg.recipientEmail,
                recipientName: msg.recipientName,
              });
              const isMsgAuthor = isPersonaMessageAuthor(currentPersona, msg.authorName, msg.authorEmail);
              const recipientsLabel = getDirectedRecipientsSummary(msg.content, msg.recipientName);

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
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {msg.mentions.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1" title="Alerta por correo despachada">
                          <Mail className="w-2.5 h-2.5" />
                          <span>Notificado</span>
                        </span>
                      )}
                      {isDirectMsg && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700/80 flex items-center gap-1 shadow-sm">
                          <Lock className="w-2.5 h-2.5 text-purple-400" />
                          <span>
                            {isMsgAuthor
                              ? `Exclusivo para ${recipientsLabel}`
                              : `Dirigido a ti (${recipientsLabel})`}
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplyToMessage(msg);
                        }}
                        className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-700/60 flex items-center gap-1 transition-colors cursor-pointer"
                        title={`Responder a ${msg.authorName}`}
                      >
                        <Reply className="w-2.5 h-2.5" />
                        <span>Responder</span>
                      </button>
                      {onDeleteMessage && (isExecutive || isMsgAuthor) && (
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
                    {msg.content.split(/(@[A-Za-zÁÉÍÓÚáéíóúÑñ0-9._]+)/g).map((part, i) => {
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
