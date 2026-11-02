import React, { useState, useEffect, useRef } from 'react';
import { UserPersona, Task, AreaType } from '../types';
import { calculateDaysRemaining, getCurrentPeriodString, getNextPeriodString, formatPeriodName } from '../utils/dateUtils';
import {
  generatePlainTextTable,
  calculateManagerialMetrics,
  updateSalaryAdvance,
  startNewMonth,
  getManagerialMonthData,
} from '../data/managerialSheetsData';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Search,
  BookOpen,
  ChevronDown,
  Minimize2,
  Maximize2,
  RefreshCw,
  ExternalLink,
  Laptop,
  ShieldCheck,
  Flame,
  Brain
} from 'lucide-react';
import {
  recordBonoInteraction,
  handleBonoMemoryQuery,
  getPersonalizedSystemPromptContext,
  loadDepartmentMemory,
} from '../utils/bonoMemoryService';

interface BonoMessage {
  id: string;
  sender: 'bono' | 'user';
  text: string;
  timestamp: string;
  sourceGrounding?: string[];
  suggestedAction?: {
    label: string;
    onClickTab?: string;
  };
}

interface BonoChatAssistantProps {
  currentUser: UserPersona;
  tasks: Task[];
  onNavigateTab?: (tab: string) => void;
  onOpenPwaModal?: () => void;
}

export const BonoChatAssistant: React.FC<BonoChatAssistantProps> = ({
  currentUser,
  tasks,
  onNavigateTab,
  onOpenPwaModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnreadAlert, setHasUnreadAlert] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [messages, setMessages] = useState<BonoMessage[]>(() => {
    const saved = localStorage.getItem(`bono_chat_${currentUser.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'bono',
        text: `¡Hola, ${currentUser.name.split(' ')[0]}! Soy **BONO**, tu compañero de trabajo en INVICT Security Solutions.\n\nEstoy aquí para acompañarte en el día a día de la oficina. Puedes consultarme:\n• Cómo registrar tareas y rendición de gastos operativos.\n• Tus recordatorios y plazos de entrega próximos a vencer.\n• Dudas sobre procesos, tareas asignadas y funciones de cada puesto.\n• Investigaciones y consultas normativas (convenio UPSRA, normativas laborales, etc.).\n\n¿En qué te puedo dar una mano hoy?`,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Filter tasks for current user
  const userTasks = tasks.filter(t => {
    const isAssignee = t.assignee.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]);
    const isArea = t.area === currentUser.department;
    return (isAssignee || isArea) && t.status !== 'Completada';
  });

  const urgentUserTasks = userTasks.filter(t => {
    const { status, days } = calculateDaysRemaining(t.dueDate, t.completedDate);
    return status === 'vencida' || days <= 1 || t.priority === 'Urgente';
  });

  useEffect(() => {
    if (urgentUserTasks.length > 0 && !isOpen) {
      setHasUnreadAlert(true);
    }
  }, [urgentUserTasks.length, isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(`bono_chat_${currentUser.id}`, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, currentUser.id]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: BonoMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Role Detection from query prefix or current persona
      const textLower = text.toLowerCase();
      const explicitAdmin =
        textLower.includes('[rol: demás administrativos]') ||
        textLower.includes('[rol: demas administrativos]');
      const explicitGerencia = textLower.includes('[rol: gerencia]');

      const isEffectiveGerencia =
        explicitGerencia ||
        (!explicitAdmin && (currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE'));

      const sensitiveKeywords = [
        'sueldo',
        'sueldos',
        'salario',
        'salarios',
        'anticipo',
        'anticipos',
        'retiro',
        'retiros',
        'directorio',
        'descuento banco',
        'descuentos banco',
        'comision banco',
        'cliente',
        'clientes',
        'facturacion',
        'facturación',
        'rentabilidad',
        'margen',
        'ganancia',
        'resumen gral',
        'resumen general',
        'planillas gerenciales',
      ];

      // Security Filter: Block non-gerencia from sensitive managerial data
      if (!isEffectiveGerencia && sensitiveKeywords.some(k => textLower.includes(k))) {
        const politeRefusal = `Estimado/a ${currentUser.name.split(' ')[0]}: La información sobre **Sueldos Personales, Retiros Directorio, Descuento Bancos, Clientes, Rentabilidad o Resumen General** es de uso exclusivo y confidencial de la Gerencia General de INVICT Security Solutions S.A.\n\nComo parte del sector administrativo, tienes habilitada la consulta, registro y edición de **"Gastos Comunes"** (insumos, viáticos de supervisores, librería, reparaciones menores). Para coordinar cualquier consulta vinculada a datos societarios, contratos de clientes o retribuciones, por favor contactar directamente con Yamila, Laura o Domingo.`;

        const bonoMsg: BonoMessage = {
          id: `bono-${Date.now()}`,
          sender: 'bono',
          text: politeRefusal,
          timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, bonoMsg]);
        setIsLoading(false);
        return;
      }

      // Filter tasks for current user
      const userTasks = tasks.filter(t => {
        const isAssignee = t.assignee.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0]);
        const isArea = t.area === currentUser.department;
        return (isAssignee || isArea) && t.status !== 'Completada';
      });

      // 1. Record interaction in departmental context memory
      recordBonoInteraction(currentUser, text, isEffectiveGerencia);

      let replyText = '';
      let groundingSources: string[] = [];
      let suggestedAction: { label: string; onClickTab?: string } | undefined = undefined;

      // 2. Check if user is asking about Bono's context memory
      const memoryAnswer = handleBonoMemoryQuery(text, currentUser, isEffectiveGerencia);
      if (memoryAnswer) {
        replyText = memoryAnswer;
      }

      // 3. Try calling the backend /api/bono/chat endpoint if not already answered
      if (!replyText) {
        try {
          const apiRes = await fetch('/api/bono/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              currentUser,
              isEffectiveGerencia,
              userTasks,
              currentPeriod: getCurrentPeriodString(),
              contextMemoryPrompt: getPersonalizedSystemPromptContext(currentUser, isEffectiveGerencia),
            }),
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.replyText && data.replyText.trim()) {
              replyText = data.replyText.trim();
            }
          }
        } catch (e) {
          // Fallback to local intelligent analysis
        }
      }

      // 4. If backend did not provide a response or no key was present, use local external/internal AI engine
      if (!replyText) {
        replyText = generateFallbackBonoResponse(text, currentUser, userTasks, urgentUserTasks, isEffectiveGerencia);
      }

      // Check if task navigation should be suggested
      if (
        textLower.includes('tarea') ||
        textLower.includes('vencer') ||
        textLower.includes('urgente') ||
        textLower.includes('pendiente')
      ) {
        suggestedAction = {
          label: 'Abrir Matriz de Tareas',
          onClickTab: 'tasks',
        };
      }

      const bonoMsg: BonoMessage = {
        id: `bono-${Date.now()}`,
        sender: 'bono',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        sourceGrounding: groundingSources.length > 0 ? groundingSources : undefined,
        suggestedAction,
      };

      setMessages(prev => [...prev, bonoMsg]);
    } catch (err: any) {
      console.warn('Bono query resolution error:', err);
      const isEffectiveGerencia = currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE';
      const fallbackReply = generateFallbackBonoResponse(text, currentUser, userTasks, urgentUserTasks, isEffectiveGerencia);
      const bonoMsg: BonoMessage = {
        id: `bono-${Date.now()}`,
        sender: 'bono',
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        suggestedAction: text.toLowerCase().includes('tarea') ? { label: 'Abrir Matriz de Tareas', onClickTab: 'tasks' } : undefined,
      };
      setMessages(prev => [...prev, bonoMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem(`bono_chat_${currentUser.id}`);
    setMessages([
      {
        id: 'msg-cleared',
        sender: 'bono',
        text: `Historial reiniciado. ¡Hola ${currentUser.name.split(' ')[0]}! ¿Qué consulta operativa o investigación deseas realizar hoy?`,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const departmentMemory = loadDepartmentMemory(
    currentUser.department,
    currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE'
  );
  const currentUserContext = departmentMemory.knownUsers[currentUser.id];

  return (
    <>
      {/* Floating Action Button at Bottom Right */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Reminder toast if there are urgent tasks - Clicking redirects directly to tasks panel */}
          {hasUnreadAlert && urgentUserTasks.length > 0 && (
            <div
              onClick={() => {
                setHasUnreadAlert(false);
                if (onNavigateTab) {
                  onNavigateTab('tasks');
                }
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#141824]/95 border-2 border-[#BE2629] text-slate-100 shadow-2xl cursor-pointer hover:bg-[#1a2132] hover:scale-105 active:scale-95 transition-all animate-bounce"
              title="Haz clic para ir directamente a tu panel de tareas pendientes y urgentes"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#BE2629] animate-ping" />
              <div className="text-xs">
                <span className="font-bold text-white">Bono:</span> Tienes{' '}
                <span className="font-bold text-red-400">{urgentUserTasks.length}</span> tareas con atención urgente
                <span className="ml-2 text-[10px] text-amber-300 font-bold underline">Ver mis tareas →</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setHasUnreadAlert(false);
            }}
            className="group relative flex items-center gap-2 px-3.5 py-3 rounded-full bg-gradient-to-r from-[#BE2629] to-[#d62828] text-white shadow-2xl shadow-red-950/60 hover:shadow-red-800/80 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-red-500/40"
            title="Abrir BONO"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center font-black text-sm tracking-wider border border-white/20">
                B
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black" />
            </div>
            <div className="text-left pr-1.5 hidden sm:block">
              <span className="text-sm font-black tracking-wider leading-none">
                BONO
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Expanded Chat Drawer / Modal */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[420px] bg-[#0e121a] border border-[#263248] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized ? 'h-16' : 'h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-[#141824] via-[#1a2030] to-[#141824] border-b border-[#242f44] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#BE2629] to-[#7f1316] flex items-center justify-center text-white font-black text-sm shadow-md border border-white/20">
                  B
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#141824]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight">BONO</h3>
                  <button
                    type="button"
                    onClick={() => setShowMemoryModal(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-[10px] font-mono text-cyan-300 transition-colors cursor-pointer"
                    title="Ver memoria de contexto activa para este departamento"
                  >
                    <Brain className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Memoria activa</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  {currentUser.name} ({currentUser.department})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleClearHistory}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Reiniciar conversación"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body when expanded */}
          {!isMinimized && (
            <>
              {/* Quick Prompt Chips */}
              <div className="p-2.5 bg-[#090c12] border-b border-[#1b2232] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage('¿Qué recuerdas de mí en tu memoria de contexto?')}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#161c28] hover:bg-[#1e2638] text-cyan-300 hover:text-white border border-cyan-800/60 shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Brain className="w-3 h-3 text-cyan-400" />
                  <span>¿Qué recuerdas de mí?</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('¿Cuáles son mis tareas próximas a vencer y qué me aconsejas?')}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#161c28] hover:bg-[#1e2638] text-slate-300 hover:text-white border border-[#253046] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Tareas por vencer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('¿Cómo agrego una observación en una tarea y uso el @ para mencionar a otros puestos o Gerencia?')}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#161c28] hover:bg-[#1e2638] text-slate-300 hover:text-white border border-[#253046] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3 text-blue-400" />
                  <span>Menciones con @</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('¿De qué manera puedo dejar esta aplicación instalada en las computadoras de los diferentes puestos de trabajo?')}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#161c28] hover:bg-[#1e2638] text-slate-300 hover:text-white border border-[#253046] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Laptop className="w-3 h-3 text-emerald-400" />
                  <span>Instalar en PC (PWA)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('¿Dónde encuentro el informe ejecutivo con gráfico de barras comparativo de carga de trabajo y cuellos de botella?')}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#161c28] hover:bg-[#1e2638] text-slate-300 hover:text-white border border-[#253046] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Flame className="w-3 h-3 text-red-400" />
                  <span>Informe de carga</span>
                </button>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#0b0e14]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'bono' && (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#BE2629] to-[#7f1316] flex items-center justify-center text-white text-xs font-black shrink-0 mt-0.5 shadow">
                        B
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-[#BE2629] text-white rounded-br-xs'
                          : 'bg-[#141926] text-slate-200 border border-[#222a3d] rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">
                        {renderFormattedMarkdown(msg.text)}
                      </div>

                      {msg.suggestedAction && (
                        <div className="mt-2.5 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.suggestedAction?.onClickTab && onNavigateTab) {
                                onNavigateTab(msg.suggestedAction.onClickTab);
                                setIsMinimized(true);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#BE2629]/30 hover:bg-[#BE2629]/50 text-red-200 border border-[#BE2629]/60 text-[11px] font-bold cursor-pointer transition-colors shadow-sm"
                          >
                            <span>{msg.suggestedAction.label}</span>
                            <span>→</span>
                          </button>
                        </div>
                      )}

                      {msg.sourceGrounding && msg.sourceGrounding.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                          <span className="font-semibold block text-slate-300 mb-1 flex items-center gap-1">
                            <Search className="w-3 h-3 text-emerald-400" />
                            Fuentes de investigación externa:
                          </span>
                          <ul className="space-y-0.5 list-disc pl-3">
                            {msg.sourceGrounding.map((src, i) => (
                              <li key={i} className="truncate">
                                {src}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-1 text-[9px] text-right opacity-60 font-mono">
                        {msg.timestamp}
                      </div>
                    </div>
                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-xl bg-[#232d42] flex items-center justify-center text-slate-200 text-xs font-bold shrink-0 mt-0.5">
                        {currentUser.name.charAt(0)}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-400 p-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#BE2629] to-[#7f1316] flex items-center justify-center text-white text-xs font-black shrink-0 animate-pulse">
                      B
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#141926] border border-[#222a3d]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BE2629] animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BE2629] animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BE2629] animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] text-slate-400 ml-1">Bono está pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-[#111520] border-t border-[#20293b] flex items-center gap-2 shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Escribe tu consulta o pide un consejo a Bono..."
                  className="flex-1 bg-[#161c28] border border-[#263146] focus:border-[#BE2629] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 rounded-xl bg-[#BE2629] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow transition-all cursor-pointer shrink-0"
                  title="Enviar mensaje"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Context Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg bg-[#111520] border border-[#27334a] rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#232d42] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Memoria de Contexto de BONO</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Aislamiento y reglas de visibilidad departamental
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#1a2130] border border-[#263148] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto pr-1">
              {/* User Identity Card */}
              <div className="p-3.5 rounded-2xl bg-[#161c28] border border-[#253147] space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Colaborador Reconocido en Sesión
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{currentUser.name}</h4>
                    <span className="text-slate-400">{currentUser.role} ({currentUser.department})</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                    currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE'
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                      : 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                  }`}>
                    {currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE'
                      ? '👑 Acceso Gerencial'
                      : `🏢 Puesto ${currentUser.department}`}
                  </span>
                </div>
              </div>

              {/* Memory Stats */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#141924] border border-[#232b3d]">
                  <span className="text-[10px] text-slate-400 block">Consultas Registradas</span>
                  <span className="text-base font-black font-mono text-cyan-400">
                    {currentUserContext?.interactionCount || 1}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141924] border border-[#232b3d]">
                  <span className="text-[10px] text-slate-400 block">Última Interacción</span>
                  <span className="text-[10px] font-mono text-slate-300 block truncate">
                    {currentUserContext?.lastInteraction || 'Sesión actual'}
                  </span>
                </div>
              </div>

              {/* Topics Remembered */}
              <div className="p-3.5 rounded-2xl bg-[#161c28] border border-[#253147] space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Temas Guardados en Memoria para este Sector
                </span>
                {currentUserContext?.recentTopics && currentUserContext.recentTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentUserContext.recentTopics.map((top, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-blue-950/60 text-blue-300 border border-blue-800/50 text-[11px]"
                      >
                        {top}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">
                    Consultas operativas habituales, registro de tareas y seguimiento de oficina.
                  </p>
                )}
              </div>

              {/* Departmental Security Compartmentalization Notice */}
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Reglas de Visibilidad y Aislamiento Departamental</span>
                </div>
                <p className="leading-relaxed opacity-90">
                  {currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE'
                    ? 'Como Gerencia General, cuentas con visión integral de los registros societarios, estados contables y rendiciones de todos los sectores de INVICT.'
                    : 'Tu memoria de contexto está estrictamente confinada al sector operativo. Los datos confidenciales de Gerencia (sueldos, rentabilidad por cliente y retiros societarios) están completamente aislados y bloqueados para proteger el secreto comercial de la empresa.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#232d42]">
              <button
                type="button"
                onClick={() => setShowMemoryModal(false)}
                className="px-4 py-2 rounded-xl bg-[#BE2629] text-white font-bold text-xs hover:bg-[#a62b2e] cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function renderFormattedMarkdown(text: string): React.ReactNode {
  // Simple markdown renderer for bold, lists, and line breaks
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, idx) => {
        // Bullet list
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 my-0.5">
              <span className="text-[#BE2629] shrink-0 mt-0.5 font-bold">•</span>
              <span>{formatBoldText(line.slice(2))}</span>
            </div>
          );
        }
        return (
          <p key={idx} className={line.trim() === '' ? 'h-2' : 'my-0.5'}>
            {formatBoldText(line)}
          </p>
        );
      })}
    </>
  );
}

function formatBoldText(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function generateFallbackBonoResponse(
  query: string,
  user: UserPersona,
  userTasks: Task[],
  urgentTasks: Task[],
  isGerencia: boolean = false
): string {
  const q = query.toLowerCase().trim();

  // =========================================================================
  // 1. SECURITY RULES FOR [Rol: demás administrativos (No Gerencia)]
  // =========================================================================
  if (!isGerencia) {
    const sensitiveTerms = [
      'sueldo',
      'sueldos',
      'salario',
      'salarios',
      'anticipo',
      'anticipos',
      'retiro',
      'retiros',
      'directorio',
      'descuento banco',
      'descuentos banco',
      'comision banco',
      'cliente',
      'clientes',
      'facturacion',
      'facturación',
      'rentabilidad',
      'margen',
      'ganancia',
      'resumen gral',
      'resumen general',
      'planillas gerenciales',
    ];

    if (sensitiveTerms.some(t => q.includes(t))) {
      return `Estimado/a ${user.name.split(' ')[0]}: La información sobre **Sueldos Personales, Retiros Directorio, Descuento Bancos, Clientes, Rentabilidad o Resumen General** es de uso exclusivo y confidencial de la Gerencia General de INVICT Security Solutions S.A.\n\nComo parte del sector administrativo, tienes habilitada la consulta, registro y edición de **"Gastos Comunes"** (insumos, viáticos de supervisores, librería, reparaciones menores). Para coordinar cualquier consulta vinculada a datos societarios, contratos de clientes o retribuciones, por favor contactar directamente con Yamila, Laura o Domingo.`;
    }

    if (q.includes('gasto') || q.includes('comun') || q.includes('caja')) {
      return `Como parte del sector administrativo, tienes habilitada la consulta, registro y edición de **"Gastos Comunes"** (insumos, viáticos de supervisores, librería, reparaciones menores):\n\n1. Ve a la pestaña **"Gastos de Oficina"** en el menú lateral.\n2. Haz clic en el botón rojo **"+ Registrar Gasto"**.\n3. Selecciona la categoría correspondiente (Insumos, Viáticos, Servicios de Oficina, Mantenimiento/Ploteo, Indumentaria o Movilidad).\n4. Ingresa el monto en ARS, fecha, proveedor y puedes adjuntar una factura/ticket en PDF o Word para que el sistema complete automáticamente los datos en la caja chica de la oficina central.`;
    }
  }

  // =========================================================================
  // 2. EXTERNAL AI QUERIES & WORLD KNOWLEDGE (Holidays, Labor Law, Calculations)
  // =========================================================================

  // A. Feriados Noviembre 2026 (Argentina) & Efemérides
  if (
    (q.includes('feriado') || q.includes('feriados') || q.includes('efemeride') || q.includes('efemérides') || q.includes('conmemora') || q.includes('puente')) &&
    (q.includes('noviembre') || q.includes('2026') || q.includes('proximo') || q.includes('mes'))
  ) {
    return `📅 **Feriados Oficiales de Noviembre 2026 en la República Argentina**\n\n` +
      `En **noviembre de 2026** hay **2 días feriados oficiales** en el calendario nacional, que dan lugar a un **fin de semana largo XXL de 4 días** consecutivos (del viernes 20 al lunes 23 de noviembre inclusive):\n\n` +
      `1. **Viernes 20 de Noviembre de 2026: Día de la Soberanía Nacional** (Feriado Nacional Inamovible / Trasladable según Ley 27.399)\n` +
      `   • **¿Qué se conmemora?:** Rinde homenaje a la heroica **Batalla de la Vuelta de Obligado**, librada el 20 de noviembre de 1845 sobre el río Paraná (partido de San Pedro, Bs. As.). Las fuerzas criollas de la Confederación Argentina, bajo el liderazgo de Juan Manuel de Rosas y el mando en el campo del brigadier general Lucio Norberto Mansilla, resistieron con baterías de artillería y gruesas cadenas tendidas de costa a costa el paso de la poderosa escuadra invasora anglo-francesa, sentando un hito imborrable en la defensa de la soberanía fluvial y territorial de la Patria.\n\n` +
      `2. **Lunes 23 de Noviembre de 2026: Feriado con fines turísticos (Feriado Puente)**\n` +
      `   • **¿Qué se conmemora / Función?:** Establecido por el Poder Ejecutivo Nacional en ejercicio de las facultades de la Ley N° 27.399 para promover el turismo interno, la gastronomía y las economías regionales de todas las provincias argentinas al conformar un receso continuo de 4 jornadas (viernes 20, sábado 21, domingo 22 y lunes 23).\n\n` +
      `🛡️ **Impacto para el Servicio Operativo de INVICT Security Solutions:**\n` +
      `• **Remuneración de Guardias:** Conforme al **Art. 166 de la Ley de Contrato de Trabajo (LCT N° 20.744)** y el **Convenio Colectivo de Trabajo CCT 507/07 (UPSRA)**, los vigiladores y custodios que cumplan servicio efectivo en objetivo durante los días feriados tienen derecho a percibir el jornal diario con un **recargo del 100% adicional (jornal doble)**, o el otorgamiento de su correspondiente franco compensatorio.\n` +
      `• **Diagramación preventiva:** Operaciones y Supervisión deben coordinar las cuadrículas de relevos para asegurar presencia continua 24/7 en los puestos de Fuesmen, Parques Industriales y Bodegas durante el fin de semana largo.`;
  }

  // B. Feriados generales en Argentina
  if (q.includes('feriado') || q.includes('feriados') || q.includes('calendario 2026')) {
    return `📅 **Calendario y Régimen de Feriados Nacionales en Argentina:**\n\n` +
      `En Argentina, el régimen de feriados se rige por la **Ley N° 27.399**. Se clasifican en:\n` +
      `• **Inamovibles:** 1 de Enero (Año Nuevo), Carnaval, 24 de Marzo (Memoria), 2 de Abril (Malvinas), Viernes Santo, 1 de Mayo (Trabajador), 25 de Mayo (Revolución), 9 de Julio (Independencia), 8 de Diciembre (Inmaculada Concepción) y 25 de Diciembre (Navidad).\n` +
      `• **Trasladables / Conmemorativos:** 17 de Junio (Güemes), 20 de Junio (Belgrano), 17 de Agosto (San Martín), 12 de Octubre (Diversidad Cultural), **20 de Noviembre (Soberanía Nacional)**.\n` +
      `• **Feriados con fines turísticos:** Hasta 3 días al año destinados a crear fines de semana largos.\n\n` +
      `En servicios de seguridad privada (CCT 507/07 UPSRA), prestar tareas en día feriado implica el pago del **100% de recargo sobre la jornada ordinaria**. ¿Deseas consultar sobre algún mes en particular?`;
  }

  // C. Distinción entre Puesto SUPERVISIÓN y PUESTO OPERACIONES
  if (
    (q.includes('supervis') || q.includes('supervision') || q.includes('operacion') || q.includes('operaciones')) &&
    (q.includes('diferencia') || q.includes('clave') || q.includes('puesto') || q.includes('distinto') || q.includes('separad'))
  ) {
    return `🏢 **Diferenciación Operativa: Puesto Operaciones vs. Puesto Supervisión**\n\n` +
      `En INVICT Security Solutions, las responsabilidades y accesos están estrictamente diferenciados:\n\n` +
      `1. **Puesto OPERACIONES (Oficina Central):**\n` +
      `   • **Ubicación:** Trabaja de forma fija en la oficina central.\n` +
      `   • **Funciones:** Coordinación logística general, armado de cuadrantes de turnos, gestión de ausentismo, comunicación telefónica con clientes y asignación de puestos.\n` +
      `   • **Credencial de acceso:** Clave exclusiva \`Operaciones2026!\`.\n\n` +
      `2. **Puesto SUPERVISIÓN (En Terreno y Móviles):**\n` +
      `   • **Ubicación:** Se desplaza en patrullas móviles e inspecciones presenciales en los objetivos.\n` +
      `   • **Funciones:** Auditoría presencial de puestos, control del porte de uniformes y credenciales REPRIV, inspección de libros de guardia y verificación de rondines nocturnos.\n` +
      `   • **Credencial de acceso:** Clave móvil \`Supervision2026!\`.\n\n` +
      `Sus métricas y tareas se visualizan de forma independiente para no superponer los indicadores de la oficina con los del terreno.`;
  }

  // D. Bancos y Diferenciación por Colores
  if (q.includes('banco') || q.includes('bancos') || q.includes('color') || q.includes('colores') || q.includes('galicia') || q.includes('macro')) {
    return `🏦 **Diferenciación Cromática de Entidades Bancarias en INVICT:**\n\n` +
      `Para una identificación visual inmediata en la planilla de **Gastos Bancarios**, cada banco cuenta con su código de color oficial:\n\n` +
      `• 🟠 **Banco Galicia:** Naranja (\`#f97316\`)\n` +
      `• 🔵 **Banco Macro:** Azul (\`#2563eb\`)\n` +
      `• 🌐 **Banco Nación:** Celeste (\`#0ea5e9\`)\n` +
      `• 🔴 **Banco Santander:** Rojo (\`#dc2626\`)\n` +
      `• 🟣 **Banco BBVA:** Violeta / Púrpura (\`#7c3aed\`)\n` +
      `• 🟢 **Banco Credicoop / Otros:** Verde (\`#10b981\`)\n\n` +
      `Desde el módulo de Gerencia puedes cargar los extractos bancarios en CSV o Excel para cada banco. El sistema retiene los datos cargados permitiendo consolidar múltiples cuentas en el mismo mes.`;
  }

  // E. Legislación Laboral y CCT UPSRA N° 507/07
  if (q.includes('cct') || q.includes('upsra') || q.includes('convenio') || q.includes('nocturn') || q.includes('franco') || q.includes('jornada')) {
    return `⚖️ **Normativa Laboral Aplicable a Seguridad Privada (CCT 507/07 UPSRA & LCT):**\n\n` +
      `• **Jornada de Trabajo:** La jornada ordinaria es de 8 horas diarias y 48 horas semanales. Toda hora que exceda dicho límite debe liquidarse como hora suplementaria (al 50% en días comunes y al 100% después de las 13:00 del sábado o domingos/feriados).\n` +
      `• **Horas Nocturnas (Art. 200 LCT):** La hora nocturna (cumplida entre las 21:00 y las 06:00 hs) equivale a **1 hora y 8 minutos** (8 minutos de reducción por cada hora trabajada), o bien debe abonarse con el 13.33% de recargo sobre el valor hora normal.\n` +
      `• **Descanso entre jornadas:** Debe existir una pausa mínima de **12 horas continuas** entre la finalización de un turno y el inicio del siguiente.\n` +
      `• **Francos compensatorios:** Obligatorios e intransferibles ante guardias cumplidas en feriados nacionales o domingos diagramados.`;
  }

  // F. Cálculos Matemáticos e IVA
  if (q.includes('calcula') || q.includes('cuanto es') || q.includes('iva de') || q.includes('% de')) {
    const mathMatch = q.match(/(\d+[\d.,]*)\s*(%|\*|\+|\-|\/)\s*(\d+[\d.,]*)/);
    if (mathMatch) {
      const n1 = parseFloat(mathMatch[1].replace(/\./g, '').replace(',', '.'));
      const op = mathMatch[2];
      const n2 = parseFloat(mathMatch[3].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(n1) && !isNaN(n2)) {
        let result = 0;
        if (op === '%') result = (n1 * n2) / 100;
        else if (op === '+') result = n1 + n2;
        else if (op === '-') result = n1 - n2;
        else if (op === '*') result = n1 * n2;
        else if (op === '/') result = n2 !== 0 ? n1 / n2 : 0;
        return `🧮 **Cálculo Solicitado:**\n\n• Operación: ${n1.toLocaleString('es-AR')} ${op} ${n2.toLocaleString('es-AR')}\n• **Resultado:** **$ ${result.toLocaleString('es-AR', { maximumFractionDigits: 2 })}**\n\nSi necesitas integrar este cálculo a alguna factura o costo directo de vigilancia, dime y te asesoro.`;
      }
    }
  }

  // =========================================================================
  // 3. MANAGERIAL MODULE COMMANDS FOR [Rol: Gerencia]
  // =========================================================================
  if (isGerencia) {
    // Dynamic Salary Advance Loading: e.g. "Cargar a Luciano Aguero 50.000 de anticipo"
    if (q.includes('anticipo') && (q.includes('cargar') || q.includes('asignar') || q.includes('registrar') || q.includes('agrega'))) {
      let employeeName = 'Luciano Aguero';
      let amount = 50000;

      const numMatch = q.match(/(\d+[\d.,]*)/);
      if (numMatch) {
        const rawNum = numMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(rawNum);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        }
      }

      if (q.includes('morales') || q.includes('cristian')) employeeName = 'Morales, Cristian';
      else if (q.includes('gomez') || q.includes('roberto')) employeeName = 'Gomez, Roberto';
      else if (q.includes('fernandez') || q.includes('claudio')) employeeName = 'Fernandez, Claudio';
      else if (q.includes('benitez') || q.includes('marcos')) employeeName = 'Benitez, Marcos';
      else if (q.includes('rodriguez') || q.includes('walter')) employeeName = 'Rodriguez, Walter';
      else if (q.includes('perez') || q.includes('marcelo')) employeeName = 'Perez, Marcelo';
      else if (q.includes('aguero') || q.includes('luciano')) employeeName = 'Aguero, Luciano';

      const updateRes = updateSalaryAdvance(employeeName, amount, getCurrentPeriodString());
      const updatedSueldosTable = generatePlainTextTable('sueldos', getCurrentPeriodString());

      return `¡Anticipo registrado exitosamente en el sistema de Gerencia!\n\n` +
        `• **Colaborador:** ${employeeName}\n` +
        `• **Monto Asignado:** $ ${amount.toLocaleString('es-AR')}\n` +
        `• **Detalle:** ${updateRes.message}\n\n` +
        `A continuación se entrega la planilla de **SUELDOS PERSONAL** actualizada y lista para ser copiada a Excel:\n\n` +
        updatedSueldosTable;
    }

    // Iniciar nuevo mes
    if (q.includes('iniciar nuevo mes') || q.includes('cerrar mes') || q.includes('nuevo mes')) {
      const curP = getCurrentPeriodString(); const nextP = getNextPeriodString(curP); startNewMonth(curP, nextP);
      return `¡Nuevo mes iniciado exitosamente!\n\nSe cerró el período **${curP}** y se habilitó la nueva planilla en blanco para **${nextP}**, conservando las estructuras de Gastos Fijos y la nómina de colaboradores activa para Dirección General.`;
    }

    // Mostrar tablas específicas o todas
    if (q.includes('mostrar todas las planillas') || q.includes('ver planillas') || q.includes('planillas de octubre') || q.includes('todas las planillas')) {
      const allTables = generatePlainTextTable('todas', getCurrentPeriodString());
      return `Estimada Gerencia: Aquí tiene todas las planillas mensuales de octubre organizadas y estructuradas en texto plano, listas para ser copiadas y pegadas directamente en Excel:\n\n${allTables}`;
    }

    if (q.includes('mostrar sueldo') || q.includes('ver sueldo') || q.includes('sueldos personal') || q.includes('planilla de sueldos')) {
      const table = generatePlainTextTable('sueldos', getCurrentPeriodString());
      return `Estimada Gerencia: A continuación se entrega la planilla de **SUELDOS PERSONAL** en texto plano directamente lista para copiar:\n\n${table}`;
    }

    if (q.includes('mostrar gastos fijos') || q.includes('ver gastos fijos') || q.includes('gastos fijos')) {
      const table = generatePlainTextTable('gastos_fijos', getCurrentPeriodString());
      return `Estimada Gerencia: A continuación se entrega la planilla de **GASTOS FIJOS** en texto plano:\n\n${table}`;
    }

    if (q.includes('mostrar cliente') || q.includes('ver cliente') || q.includes('clientes facturacion') || q.includes('facturacion')) {
      const table = generatePlainTextTable('clientes', getCurrentPeriodString());
      return `Estimada Gerencia: A continuación se entrega la planilla de **CLIENTES (FACTURACIÓN)** en texto plano:\n\n${table}`;
    }

    if (q.includes('mostrar rentabilidad') || q.includes('rentabilidad por cliente') || q.includes('margen neto')) {
      const table = generatePlainTextTable('rentabilidad', getCurrentPeriodString());
      return `Estimada Gerencia: A continuación se entrega la planilla de **RENTABILIDAD POR CLIENTE** (Facturación Neta vs. Costo Directo y Margen Neto):\n\n${table}`;
    }

    if (q.includes('mostrar resumen') || q.includes('resumen general') || q.includes('resumen global')) {
      const table = generatePlainTextTable('resumen', getCurrentPeriodString());
      return `Estimada Gerencia: A continuación se entrega el **RESUMEN GENERAL** financiero en texto plano:\n\n${table}`;
    }

    // Alertas de cobranza
    if (q.includes('alerta') || q.includes('cobranza') || q.includes('impago') || q.includes('deuda')) {
      const metrics = calculateManagerialMetrics(getCurrentPeriodString());
      const list = metrics.unpaidInvoices.map(inv => {
        return `• **${inv.clientName}**: Total adeudado $ ${inv.totalNet.toLocaleString('es-AR')} (Comprobante: ${inv.invoiceNumber || 'FAC-0001'}, Vto: ${inv.dueDate || 'Vencido'})`;
      }).join('\n');

      return `⚠️ **Alertas de Cobranza Gerenciales (Facturas IMPAGO):**\n\n` +
        `Actualmente registramos **${metrics.unpaidInvoices.length} facturas pendientes de cobro**, con un monto total adeudado de **$ ${metrics.totalUnpaidAmount.toLocaleString('es-AR')}**:\n\n` +
        `${list}\n\n` +
        `💡 **Recomendación C-Level**: Se sugiere que Administración (Giuliana) intime formalmente la regularización de pagos a Fuesmen Maipú y Parque Industrial Godoy Cruz para salvaguardar el flujo de caja del corriente mes.`;
    }

    // Dashboard gerencial general
    if (q.includes('dashboard') || q.includes('metrica') || q.includes('rentabilidad') || q.includes('costo') || q.includes('gerencial')) {
      const metrics = calculateManagerialMetrics(getCurrentPeriodString());
      return `📊 **Panel Analítico del Dashboard Gerencial (${formatPeriodName(getCurrentPeriodString())}):**\n\n` +
        `1. **Rentabilidad por Cliente:**\n` +
        `   • Facturación Neta Total: $ ${metrics.totalIncome.toLocaleString('es-AR')}\n` +
        `   • Costos Directos Guardias: $ ${metrics.totalDirectCosts.toLocaleString('es-AR')}\n` +
        `   • Margen Neto Consolidado: **$ ${metrics.globalNetMargin.toLocaleString('es-AR')} (${metrics.globalNetMarginPercent}%)**\n\n` +
        `2. **Alertas de Cobranza:**\n` +
        `   • ${metrics.unpaidInvoices.length} facturas en estado **IMPAGO** por un total de **$ ${metrics.totalUnpaidAmount.toLocaleString('es-AR')}**.\n\n` +
        `3. **Resumen Global:**\n` +
        `   • Ingresos: $ ${metrics.totalIncome.toLocaleString('es-AR')}\n` +
        `   • Costos Directos: $ ${metrics.totalDirectCosts.toLocaleString('es-AR')}\n` +
        `   • Gastos Fijos: $ ${metrics.totalFixedExpenses.toLocaleString('es-AR')}\n` +
        `   • Margen Neto: $ ${metrics.globalNetMargin.toLocaleString('es-AR')}\n\n` +
        `4. **Distribución de Costos:**\n` +
        `   • Sueldos & Cargas Directas de Vigilancia representan el rubro principal (~62%), seguido por Retiros Directorio ($ 800.000) y Alquiler de Sede ($ 450.000).\n\n` +
        `Puedes pedirme *"Mostrar todas las planillas de octubre"* o *"Cargar anticipo"* en cualquier momento para obtener el texto formateado para Excel.`;
    }
  }

  // =========================================================================
  // 4. OPERATIONAL INTERNAL PROCEDURES (Tasks, Notices, PWA, Mentions)
  // =========================================================================
  if (q.includes('vencer') || q.includes('recordatorio') || q.includes('plazo') || q.includes('urgente')) {
    if (urgentTasks.length === 0) {
      return `¡Buenas noticias, ${user.name.split(' ')[0]}! Actualmente no tienes tareas vencidas ni con plazo crítico de 24 horas.\n\n• Tienes un total de ${userTasks.length} tareas activas en tu matriz de ${user.department}.\n• Mi consejo: aprovecha para revisar los libros de novedades y adelantar las verificaciones de fin de semana. ¡Vamos al día!`;
    }
    const list = urgentTasks.map(t => {
      const { label, status } = calculateDaysRemaining(t.dueDate);
      return `• **${t.title}** (Vence: ${t.dueDate} - Estado: ${status.toUpperCase()} / ${label}) - Área: ${t.area}`;
    }).join('\n');

    return `¡Atención, ${user.name.split(' ')[0]}! Tienes ${urgentTasks.length} tarea(s) que requieren tu acción prioritaria:\n\n${list}\n\n💡 **Mi consejo de amigo**: Puedes tocar el botón que aparece debajo para ir directamente a tu panel de tareas y gestionarlas de inmediato.`;
  }

  if (q.includes('mencion') || q.includes('@') || q.includes('observacion')) {
    return `Para agregar observaciones con mención a otros puestos en INVICT:\n\n1. Ve a la pestaña **"Matriz de Tareas"**.\n2. Haz clic sobre la tarea que deseas comentar.\n3. En el sector inferior del modal, en el campo de **"Observaciones y Novedades"**, escribe el símbolo **"@"**.\n4. Se abrirá la lista rápida con todos los puestos: **@Gerencia**, **@Operaciones**, **@Supervisión**, **@RRHH**, **@Administración**, etc.\n5. Al enviar el comentario, el sistema despacha una notificación en tiempo real y registra la alerta para que el puesto mencionado esté al tanto de inmediato.`;
  }

  if (q.includes('instalar') || q.includes('computadora') || q.includes('pc') || q.includes('pwa') || q.includes('escritorio')) {
    return `Para dejar instalada esta aplicación en cada computadora de puesto (PWA):\n\n1. Abre la aplicación en Google Chrome o Microsoft Edge en la computadora del puesto.\n2. En la barra de direcciones (arriba a la derecha), haz clic en el icono de **"Instalar aplicación"** (pantalla con flecha) o en el botón **"Instalar en Computadora"** en la cabecera del sistema.\n3. Haz clic en **"Instalar"**.\n4. La app se creará como programa nativo en el **Escritorio de Windows/Mac** y la barra de tareas.\n5. Al abrirla, correrá en su propia ventana sin barra de navegador, garantizando que el operador permanezca enfocado en el sistema operativo con caché sin conexión Stale-While-Revalidate.`;
  }

  if (q.includes('informe') || q.includes('cuello') || q.includes('botella') || q.includes('barra') || q.includes('carga')) {
    return `Para consultar la comparativa de carga de trabajo y cuellos de botella:\n\n1. Haz clic en la pestaña **"Informes Ejecutivos"** en el menú lateral izquierdo o en el botón **"Informes C-Level"** de la cabecera.\n2. Encontrarás el gráfico de barras comparativo de **"Carga de Trabajo: Tareas Totales vs. Completadas por Colaborador"**.\n3. Allí se identifican automáticamente los cuellos de botella (colaboradores con alta carga y baja tasa de resolución o tareas vencidas).\n4. Puedes filtrar por colaboradores en riesgo y exportar el informe completo en **PDF oficial con membrete** o planilla CSV de auditoría.`;
  }

  if (q.includes('repriv') || q.includes('vigilador') || q.includes('habilitacion')) {
    return `Sobre la habilitación técnica y registro REPRIV:\n\n• **REPRIV (Mendoza):** Exige certificado de antecedentes judiciales limpio expedido por el Ministerio de Seguridad, apto psicofísico anual y credencial habilitante vigente para cada vigilador en servicio.\n• Operaciones y Supervisión deben verificar que ningún vigilador asuma puesto sin credencial al día.`;
  }

  // Redacción de notas o memorándums
  if (q.includes('redactar') || q.includes('nota') || q.includes('comunicado') || q.includes('memorandum')) {
    return `📝 **Plantilla de Memorándum Operativo - INVICT Security Solutions**\n\n` +
      `**MEMORÁNDUM INTERNO N° 0${Math.floor(Math.random() * 90 + 10)}/2026**\n` +
      `**DE:** ${user.name} (${user.role})\n` +
      `**PARA:** Personal de Guardia y Supervisión\n` +
      `**FECHA:** ${new Date().toLocaleDateString('es-AR')}\n` +
      `**ASUNTO:** ${query.replace(/redactar|nota|comunicado|memorandum/gi, '').trim() || 'Instrucción de Servicio Operativo'}\n\n` +
      `Por medio de la presente, se notifica a todo el personal involucrado las directivas vigentes respecto al cumplimiento estricto de las consignas de seguridad, puntualidad en los relevos y registro riguroso de novedades en el libro de guardia.\n\n` +
      `Atentamente,\n**INVICT Security Solutions S.A.**`;
  }

  // Default intelligent contextual response
  return `¡Hola ${user.name.split(' ')[0]}! He analizado tu consulta sobre **"${query}"**:\n\n` +
    `• Como compañero de equipo e IA de INVICT, puedo responder tanto a **dudas internas de la oficina** (matriz de tareas, gastos de oficina, procesos de los puestos) como a **consultas externas** (efemérides, feriados, cálculos, redacción o normativas laborales como CCT UPSRA y Ley de Contrato de Trabajo).\n` +
    `• Si buscas algo específico de tu matriz de **${user.department}**, tus tareas activas están al día y registradas en el sistema.\n\n` +
    `¿Deseas que profundice en algún aspecto operativo o normativo en particular?`;
}


