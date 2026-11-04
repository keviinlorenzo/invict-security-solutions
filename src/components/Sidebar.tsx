import React from 'react';
import { AreaType, UserPersona } from '../types';
import {
  LayoutDashboard,
  CheckSquare,
  Receipt,
  FileText,
  MessageSquare,
  Users,
  Briefcase,
  ShieldAlert,
  Headphones,
  Compass,
  FileCheck,
  Crown,
  Lock,
  ArrowRightLeft,
  Calendar,
  LogOut,
  BarChart3,
  TrendingUp,
  Award,
  Laptop
} from 'lucide-react';
import { InvictLogo } from './InvictLogo';

export type ActiveTab = 'dashboard' | 'tasks' | 'admin_sheets' | 'reports' | 'calendar' | 'expenses' | 'feed';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  selectedArea: AreaType;
  onAreaChange: (area: AreaType) => void;
  urgentTasksCount: number;
  unreadMentionsCount: number;
  currentPersona?: UserPersona;
  onOpenProfileModal?: () => void;
  onOpenPersonnelModal?: () => void;
  onOpenPwaModal?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  selectedArea,
  onAreaChange,
  urgentTasksCount,
  unreadMentionsCount,
  currentPersona,
  onOpenProfileModal,
  onOpenPersonnelModal,
  onOpenPwaModal,
  onLogout,
}) => {
  const isGerencia = Boolean(
    currentPersona && (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE')
  );
  const isSubGerencia = Boolean(
    currentPersona && (currentPersona.department === 'SUB_GERENCIA' || currentPersona.profileType === 'SUB_GERENTE')
  );
  const isExecutive = isGerencia || isSubGerencia;

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
    restrictedToGerencia?: boolean;
    roleRequiredLabel?: string;
  }[] = [
    {
      id: 'dashboard',
      label: isSubGerencia ? 'Dashboard Gerencial (Solo Vista)' : 'Dashboard Gerencial',
      icon: <LayoutDashboard className="w-4 h-4" />,
      restrictedToGerencia: true,
      roleRequiredLabel: 'C-Level',
    },
    {
      id: 'tasks',
      label: 'Matriz Operativa',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: urgentTasksCount > 0 ? urgentTasksCount : undefined,
      badgeColor: 'bg-[#BE2629]',
    },
    {
      id: 'admin_sheets',
      label: 'Planillas Informativas & Informes',
      icon: <FileText className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'reports',
      label: 'Informes Ejecutivos',
      icon: <TrendingUp className="w-4 h-4" />,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'calendar',
      label: 'Calendario de Tareas',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'expenses',
      label: 'Gastos de Oficina',
      icon: <Receipt className="w-4 h-4" />,
    },
    {
      id: 'feed',
      label: 'Invict Feed & Colaboración',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: unreadMentionsCount > 0 ? unreadMentionsCount : undefined,
      badgeColor: 'bg-blue-600',
    },
  ];

  // Gerencia General and Sub Gerencia have access to Dashboard Gerencial
  const visibleNavItems = navItems.filter((item) => !item.restrictedToGerencia || isExecutive);

  const departmentFilters: { id: AreaType; label: string; icon: React.ReactNode }[] = [
    ...(isGerencia
      ? [{ id: 'GERENCIA' as AreaType, label: 'Gerencia General (Privado)', icon: <Crown className="w-3.5 h-3.5 text-amber-400" /> }]
      : []),
    { id: 'SUB_GERENCIA' as AreaType, label: 'Sub Gerencia / Vicepresidencia', icon: <Crown className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'OPERACIONES', label: 'Operaciones (Puestos & Rondas)', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'SUPERVISIÓN', label: 'Supervisión en Terreno', icon: <Award className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'RRHH', label: 'Recursos Humanos (RR.HH.)', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'ADM', label: 'Administración (ADM)', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'AUX_ADM', label: 'Auxiliar Administrativo', icon: <FileCheck className="w-3.5 h-3.5" /> },
    { id: 'SELECCION', label: 'Selección & Reclutamiento', icon: <Headphones className="w-3.5 h-3.5" /> },
    { id: 'TODOS', label: isGerencia ? 'Consolidado (Auditoría Global)' : isSubGerencia ? 'Consolidado (Sub Gerencia)' : 'Consolidado (Oficina)', icon: <Compass className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="w-64 bg-[#0d0f14] border-r border-[#222734] flex flex-col justify-between shrink-0 select-none hidden md:flex min-h-[calc(100vh-57px)]">
      <div className="p-4 space-y-5">
        {/* Active Profile Card */}
        {currentPersona && (
          <div className="p-3 bg-[#131822] border border-[#222b3d] rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Puesto Activo
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                isGerencia
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : isSubGerencia
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                {isGerencia ? 'GERENCIA GENERAL' : isSubGerencia ? 'SUB GERENCIA' : currentPersona.department}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${currentPersona.avatarBg}`}>
                {currentPersona.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                  {currentPersona.name}
                  {isGerencia && <Crown className="w-3 h-3 text-amber-400 inline shrink-0" />}
                  {isSubGerencia && <Crown className="w-3 h-3 text-rose-400 inline shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {currentPersona.role}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#1c2436] flex flex-col gap-1.5">
              {isGerencia && onOpenPersonnelModal && (
                <button
                  onClick={onOpenPersonnelModal}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 rounded-lg text-[11px] text-amber-300 transition-colors cursor-pointer"
                >
                  <Users className="w-3 h-3 text-amber-400" />
                  <span>Rotación de Personal</span>
                </button>
              )}
              {(isGerencia || isSubGerencia) && onOpenProfileModal ? (
                <button
                  onClick={onOpenProfileModal}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-[#1a2130] hover:bg-[#232d42] border border-[#273248] rounded-lg text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3 text-[#BE2629]" />
                  <span>{isGerencia ? 'Cambiar de Puesto' : 'Inspeccionar Puestos'}</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-[#121620] border border-[#202738] rounded-lg text-[10px] text-slate-400">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Puesto Fijo Asignado</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Module Navigation */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Módulos de Gestión
          </div>
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const isRestricted = item.restrictedToGerencia && !isGerencia;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isRestricted) return;
                    onTabChange(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#BE2629] text-white shadow-md font-semibold'
                      : isRestricted
                      ? 'text-slate-500 hover:bg-[#141822] opacity-80'
                      : 'text-slate-300 hover:bg-[#161a23] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : isRestricted ? 'text-slate-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isRestricted && (
                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Gerencia</span>
                      </span>
                    )}
                    {item.badge !== undefined && !isRestricted && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white ${
                          isActive ? 'bg-black/30' : item.badgeColor || 'bg-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Area / Department Filter */}
        <div className="pt-2 border-t border-[#1e2330]">
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Puestos de Trabajo</span>
          </div>
          <div className="space-y-0.5">
            {departmentFilters.map((dept) => {
              const isSelected = selectedArea === dept.id;
              const isUserDepartment = currentPersona?.department === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    onAreaChange(dept.id);
                    if (activeTab !== 'tasks' && activeTab !== 'reports') {
                      onTabChange('tasks');
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1a2130] text-[#BE2629] font-semibold border-l-2 border-[#BE2629]'
                      : 'text-slate-400 hover:bg-[#141822] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={isSelected ? 'text-[#BE2629]' : 'text-slate-500'}>
                      {dept.icon}
                    </span>
                    <span className="truncate">{dept.label}</span>
                  </div>
                  {isUserDepartment && (
                    <span className="text-[9px] px-1 rounded bg-blue-950 text-blue-300 shrink-0 font-mono">
                      Mi Puesto
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Branding and Logout */}
      <div className="p-3.5 border-t border-[#1e2330] bg-[#0b0c10] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <InvictLogo size="xs" variant="isotype" />
            <span className="font-bold text-white text-xs">INVICT S.A.</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
            Nube v3.0
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          Oficina Central · Archivo compartido
        </p>
        <p className="text-[9px] text-slate-400">
          Este sitio fue creado por <strong className="text-slate-300">Kevin Lorenzo</strong>
        </p>
        {onOpenPwaModal && (
          <button
            onClick={onOpenPwaModal}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Instalar como app nativa en esta computadora"
          >
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instalar App en este Puesto</span>
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-[#141824] hover:bg-red-950/40 border border-[#232b3d] hover:border-red-800/50 text-slate-400 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        )}
      </div>
    </aside>
  );
};
