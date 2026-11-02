import React, { useState } from 'react';
import { InvictLogo } from './InvictLogo';
import { UserPersona, Task, InternalMessage } from '../types';
import { HeaderPeriodSelector } from './HeaderPeriodSelector';
import {
  Bell,
  Search,
  Plus,
  ChevronDown,
  AlertTriangle,
  Mail,
  Clock,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  BellRing,
  Crown,
  Users,
  LogOut,
  Cloud,
  FileText,
  TrendingUp,
  Lock,
  Laptop
} from 'lucide-react';
import { calculateDaysRemaining } from '../utils/dateUtils';
import { PROFILE_METADATA } from '../utils/authService';

interface HeaderProps {
  currentPersona: UserPersona;
  allPersonas: UserPersona[];
  onSelectPersona: (persona: UserPersona) => void;
  tasks: Task[];
  messages: InternalMessage[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  currentPeriod: string;
  onPeriodChange: (newPeriod: string) => void;
  onOpenNewTaskModal: () => void;
  onOpenNewExpenseModal: () => void;
  onNavigateToFeed: () => void;
  onNavigateToReports?: () => void;
  onSelectTask?: (task: Task) => void;
  onOpenExportModal?: () => void;
  onOpenProfileModal?: () => void;
  onOpenNotificationModal?: () => void;
  onOpenPersonnelModal?: () => void;
  onOpenEmailAlertsModal?: () => void;
  onOpenAuditHistory?: () => void;
  onOpenPwaModal?: () => void;
  onLogout?: () => void;
  onExportPeriodCSV?: () => void;
  onExportPeriodPDF?: () => void;
  totalEmailAlertsCount?: number;
  onSelectMentionMessage?: (messageId: string, taskId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPersona,
  allPersonas,
  onSelectPersona,
  tasks,
  messages,
  searchTerm,
  onSearchChange,
  currentPeriod,
  onPeriodChange,
  onOpenNewTaskModal,
  onOpenNewExpenseModal,
  onNavigateToFeed,
  onNavigateToReports,
  onSelectTask,
  onOpenExportModal,
  onOpenProfileModal,
  onOpenNotificationModal,
  onOpenPersonnelModal,
  onOpenEmailAlertsModal,
  onOpenAuditHistory,
  onOpenPwaModal,
  onLogout,
  onExportPeriodCSV,
  onExportPeriodPDF,
  totalEmailAlertsCount = 0,
  onSelectMentionMessage,
}) => {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showFixedPostAlert, setShowFixedPostAlert] = useState(false);

  const isGerencia = currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE';

  // Compute urgent and delayed tasks for the notifications center
  const delayedTasks = tasks.filter(t => {
    if (t.status === 'Completada') return false;
    const { status } = calculateDaysRemaining(t.dueDate, t.completedDate);
    return status === 'vencida' || status === 'urgente_48h';
  });

  const normalizeText = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const personalMentions = messages.filter(m => {
    const emailMatch =
      m.mentions.some(e => e.toLowerCase() === currentPersona.email.toLowerCase()) ||
      (isGerencia && m.mentions.includes('consultasinvictsolutionss.a@gmail.com'));
    if (emailMatch) return true;
    const normContent = normalizeText(m.content || '');
    const myFirstName = normalizeText(currentPersona.name.split(' ')[0] || '');
    const myDept = normalizeText(currentPersona.department || '');
    const myProf = normalizeText(currentPersona.profileType || '');
    return (
      (myFirstName && normContent.includes(`@${myFirstName}`)) ||
      (myDept && normContent.includes(`@${myDept}`)) ||
      (myProf && normContent.includes(`@${myProf}`)) ||
      normContent.includes('@todos')
    );
  });

  const totalAlertsCount = delayedTasks.length + personalMentions.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-[#0d0f14] border-b border-[#222734] shadow-sm select-none">
      {/* Zone 1: INVICT Logo & Institutional Tag */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          onClick={onNavigateToFeed}
          className="group cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-95 flex items-center"
          title="INVICT Security Solutions S.A. - Panel Central"
        >
          <InvictLogo size="sm" variant="horizontal" theme="dark" interactive={true} />
        </div>
        <div className="hidden lg:flex flex-col text-xs border-l border-[#222734] pl-3">
          <span className="font-extrabold text-white text-[11px] tracking-wide uppercase">
            ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A
          </span>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Oficina Central
            </span>
            <span>·</span>
            <span className="font-mono text-slate-300">Sistema Conectado</span>
          </div>
        </div>
      </div>

      {/* Zone 2: Period Navigation, Universal Search & Active Persona Switcher */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 max-w-2xl mx-2 sm:mx-4">
        {/* Monthly Period Selector directly in Header */}
        <HeaderPeriodSelector
          currentPeriod={currentPeriod}
          onPeriodChange={onPeriodChange}
          onExportCSV={onExportPeriodCSV}
          onExportPDF={onExportPeriodPDF}
        />

        <div className="relative flex-1 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por tarea, responsable, área..."
            className="w-full pl-8 pr-4 py-1.5 text-xs bg-[#161a23] border border-[#262c3b] rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Persona Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              if (!isGerencia) {
                setShowFixedPostAlert(prev => !prev);
                setTimeout(() => setShowFixedPostAlert(false), 4500);
                return;
              }
              setShowPersonaMenu(!showPersonaMenu);
            }}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors text-left cursor-pointer ${
              !isGerencia
                ? 'bg-[#141822] hover:bg-[#191f2c] border-[#252f44]'
                : 'bg-[#161a23] hover:bg-[#1f2533] border-[#262c3b]'
            }`}
            title={
              isGerencia
                ? 'Conmutar entre puestos de la empresa (Exclusivo Gerencia General)'
                : 'Puesto Fijo Asignado. Solo Dirección General puede alternar puestos.'
            }
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${currentPersona.avatarBg}`}>
              {currentPersona.name.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentPersona.name}
                </span>
                <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded border ${PROFILE_METADATA[currentPersona.profileType || 'operaciones']?.badge || 'bg-red-950 text-red-300'}`}>
                  {PROFILE_METADATA[currentPersona.profileType || 'operaciones']?.label || currentPersona.profileType}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[130px]">
                {currentPersona.role}
              </span>
            </div>
            {isGerencia ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            ) : (
              <Lock className="w-3 h-3 text-slate-500 ml-1" />
            )}
          </button>

          {/* Locked Station Alert for Non-Gerencia */}
          {showFixedPostAlert && (
            <div className="absolute right-0 mt-2 w-72 p-3.5 bg-[#151a26] border border-amber-600/80 rounded-2xl shadow-2xl text-xs text-slate-200 z-50 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Puesto Fijo Asignado</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Has ingresado con la cuenta asignada a <strong>{currentPersona.name}</strong> ({currentPersona.role}). Por normativa de seguridad de INVICT Security Solutions, solo la Dirección General / Gerencia tiene permisos para conmutar entre puestos.
              </p>
            </div>
          )}

          {isGerencia && showPersonaMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPersonaMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-[#121620] border border-[#2a3244] rounded-2xl shadow-2xl py-2 z-50">
                <div className="px-3 py-2 border-b border-[#222837] mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Cambiar Perfil de Usuario
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permite experimentar la visión gerencial o administrativa
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {allPersonas.map((persona) => {
                    const isSelected = persona.id === currentPersona.id;
                    const meta = PROFILE_METADATA[persona.profileType || 'operaciones'];
                    return (
                      <button
                        key={persona.id}
                        onClick={() => {
                          onSelectPersona(persona);
                          setShowPersonaMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-[#1a2130] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#1a2130] border-l-2 border-[#BE2629]' : ''
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${persona.avatarBg}`}>
                          {persona.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium truncate ${isSelected ? 'text-[#BE2629] font-semibold' : 'text-slate-200'}`}>
                              {persona.name}
                            </span>
                            <span className={`text-[8px] font-mono px-1 rounded uppercase ${meta?.badge}`}>
                              {meta?.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {persona.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-[#222837] bg-[#0e121a] space-y-1.5">
                  {onOpenProfileModal && (
                    <button
                      onClick={() => {
                        setShowPersonaMenu(false);
                        onOpenProfileModal();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-[#BE2629] hover:text-white bg-[#BE2629]/10 hover:bg-[#BE2629] rounded-lg border border-[#BE2629]/30 transition-colors cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Ver Todos los Puestos & Permisos</span>
                    </button>
                  )}
                  {onOpenPersonnelModal && (
                    <button
                      onClick={() => {
                        setShowPersonaMenu(false);
                        onOpenPersonnelModal();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 rounded-lg border border-amber-800/40 transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>Gestión de Personal & Rotación</span>
                    </button>
                  )}
                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowPersonaMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-red-300 hover:text-white bg-red-950/50 hover:bg-red-900/80 rounded-lg border border-red-800/50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-400" />
                      <span>Cerrar Sesión Corporativa</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zone 3: Actions & Notifications Center */}
      <div className="flex items-center gap-2">
        {/* Direct Link to Informes Ejecutivos */}
        {onNavigateToReports && (
          <button
            onClick={onNavigateToReports}
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white bg-[#161a23] hover:bg-[#1f2533] border border-[#262c3b] rounded-xl transition-colors cursor-pointer"
            title="Abrir Módulo de Informes Ejecutivos C-Level"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Informes C-Level</span>
          </button>
        )}

        {/* Real-time Cloud Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Nube Sincronizada</span>
        </div>

        {/* Desktop PWA Install Button */}
        {onOpenPwaModal && (
          <button
            onClick={onOpenPwaModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-[#141926] hover:bg-emerald-950/60 border border-emerald-700/60 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Instalar la aplicación en esta computadora de puesto (PWA nativa)"
          >
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Instalar en PC</span>
          </button>
        )}

        {/* Personnel & Rotation Management Button */}
        {onOpenPersonnelModal && (
          <button
            onClick={onOpenPersonnelModal}
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-[#161a23] hover:bg-[#1f2533] border border-[#262c3b] rounded-xl transition-colors active:scale-95 cursor-pointer"
            title="Modificar personal responsable de cada puesto y gestionar rotación"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden 2xl:inline">Personal & Rotación</span>
          </button>
        )}

        {/* Email Alerts System Button */}
        {onOpenEmailAlertsModal && (
          <button
            onClick={onOpenEmailAlertsModal}
            className="relative p-2 rounded-xl bg-[#161a23] hover:bg-[#1f2533] border border-[#262c3b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Alertas por Correo Electrónico emitidas por menciones @"
          >
            <Mail className="w-4 h-4 text-emerald-400" />
            {totalEmailAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow">
                {totalEmailAlertsCount}
              </span>
            )}
          </button>
        )}

        {/* Export Report / Print Button */}
        <button
          onClick={onOpenExportModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-[#161a23] hover:bg-[#1f2533] border border-[#262c3b] rounded-xl transition-colors active:scale-95 cursor-pointer"
          title="Exportar Informes en CSV o PDF"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#BE2629]" />
          <span>Exportar (CSV/PDF)</span>
        </button>

        {/* Notifications Pop-up Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            className="relative p-2 rounded-xl bg-[#161a23] hover:bg-[#1f2533] border border-[#262c3b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Centro de Alertas y Vencimientos"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {totalAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#BE2629] text-[10px] font-bold text-white shadow">
                {totalAlertsCount}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotificationMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#121620] border border-[#2a3244] rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-[#181d2a] border-b border-[#262e40] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#BE2629]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Centro de Alertas Operativas
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {totalAlertsCount} pendientes
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#1f2535]">

                  {/* Tareas Vencidas o en 48hs */}
                  {delayedTasks.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold uppercase mb-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Tareas en Riesgo o Vencidas ({delayedTasks.length})
                      </div>
                      {delayedTasks.slice(0, 4).map(task => {
                        const { label, badgeClass } = calculateDaysRemaining(task.dueDate, task.completedDate);
                        return (
                          <div
                            key={task.id}
                            onClick={() => {
                              onSelectTask?.(task);
                              setShowNotificationMenu(false);
                            }}
                            className="text-xs text-slate-300 mb-2 hover:bg-[#1a2130] p-1.5 rounded cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-200 truncate pr-2">{task.title}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                                {label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Área: {task.area} · Resp: {task.assignee}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Menciones dirigidas a mí */}
                  {personalMentions.length > 0 && (
                    <div className="p-3 bg-[#141a26]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-bold uppercase">
                          <Mail className="w-3.5 h-3.5" />
                          Menciones Dirigidas a Ti ({personalMentions.length})
                        </div>
                        <button
                          onClick={() => {
                            setShowNotificationMenu(false);
                            onNavigateToFeed();
                          }}
                          className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
                        >
                          Ir al Feed →
                        </button>
                      </div>
                      {personalMentions.slice(0, 4).map(msg => (
                        <div
                          key={msg.id}
                          onClick={() => {
                            setShowNotificationMenu(false);
                            if (onSelectMentionMessage) {
                              onSelectMentionMessage(msg.id, msg.taskId);
                            } else {
                              onNavigateToFeed();
                            }
                          }}
                          className="text-xs text-slate-300 mb-1.5 bg-[#10141f] hover:bg-[#192236] p-2.5 rounded-xl border border-[#222838] hover:border-cyan-500/60 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span className="font-semibold text-white group-hover:text-cyan-300">
                              {msg.authorName} te mencionó
                            </span>
                            <span className="font-mono text-[9px]">{msg.timestamp}</span>
                          </div>
                          <p className="line-clamp-2 text-slate-300 text-[11px]">{msg.content}</p>
                          <span className="text-[10px] font-bold text-cyan-400 mt-1 inline-block group-hover:underline">
                            Abrir mensaje directamente →
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalAlertsCount === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No hay alertas críticas en este momento.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop App PWA Install Button */}
        {onOpenPwaModal && (
          <button
            onClick={onOpenPwaModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-[#151a24] hover:bg-[#1d2433] text-slate-200 border border-[#263147] hover:border-[#BE2629]/50 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Instalar INVICT Security Solutions como aplicación nativa de escritorio (PWA)"
          >
            <Laptop className="w-3.5 h-3.5 text-[#BE2629]" />
            <span className="hidden md:inline">App Escritorio</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              PWA
            </span>
          </button>
        )}

        {/* Quick Action Add Button */}
        <div className="relative">
          <button
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 rounded-xl shadow transition-colors active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nueva Acción</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>

          {showActionMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActionMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-[#121620] border border-[#2a3244] rounded-2xl shadow-2xl py-1.5 z-50">
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    onOpenNewTaskModal();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-[#1a2130] hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Nueva Tarea Rápida
                </button>
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    onOpenNewExpenseModal();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-[#1a2130] hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Registrar Gasto de Oficina
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
