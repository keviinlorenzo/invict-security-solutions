import React, { useState } from 'react';
import {
  CheckSquare,
  FileText,
  Receipt,
  MessageSquare,
  Menu,
  X,
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Smartphone,
  LogOut,
  Users,
  Shield,
  Crown,
  ChevronRight,
  Lock,
  ArrowRightLeft,
  Compass
} from 'lucide-react';
import { AreaType, UserPersona } from '../types';
import { ActiveTab } from './Sidebar';

interface MobileNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  selectedArea: AreaType;
  onAreaChange: (area: AreaType) => void;
  urgentTasksCount: number;
  unreadMentionsCount: number;
  currentPersona: UserPersona;
  onOpenProfileModal?: () => void;
  onOpenPersonnelModal?: () => void;
  onOpenPwaModal?: () => void;
  onLogout?: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isGerencia = currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE';

  const areasList: { id: AreaType; label: string; icon: string }[] = [
    ...(isGerencia ? [{ id: 'GERENCIA' as AreaType, label: 'Gerencia (Privado)', icon: '👑' }] : []),
    { id: 'OPERACIONES', label: 'Operaciones', icon: '🛡️' },
    { id: 'SUPERVISIÓN', label: 'Supervisión Móvil', icon: '⭐' },
    { id: 'RRHH', label: 'Recursos Humanos', icon: '👥' },
    { id: 'ADM', label: 'Administración', icon: '💼' },
    { id: 'AUX_ADM', label: 'Auxiliar Adm.', icon: '📁' },
    { id: 'SELECCION', label: 'Selección', icon: '🎧' },
    { id: 'TODOS', label: isGerencia ? 'Consolidado (Auditoría)' : 'Consolidado (Oficina)', icon: '🌐' },
  ];

  return (
    <>
      {/* Bottom Floating/Fixed Bar for Mobile Phones */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1017]/95 backdrop-blur-xl border-t border-[#1f2738] px-2 py-1.5 flex items-center justify-around shadow-2xl select-none">
        {/* Tab 1: Tareas */}
        <button
          type="button"
          onClick={() => {
            onTabChange('tasks');
            setIsDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'tasks'
              ? 'text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <CheckSquare className={`w-5 h-5 ${activeTab === 'tasks' ? 'text-[#BE2629]' : 'text-slate-400'}`} />
            {urgentTasksCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#BE2629] text-[9px] font-bold text-white shadow animate-pulse">
                {urgentTasksCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Tareas</span>
        </button>

        {/* Tab 2: Planillas Informativas */}
        <button
          type="button"
          onClick={() => {
            onTabChange('admin_sheets');
            setIsDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'admin_sheets'
              ? 'text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className={`w-5 h-5 ${activeTab === 'admin_sheets' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Planillas</span>
        </button>

        {/* Tab 3: Gastos */}
        <button
          type="button"
          onClick={() => {
            onTabChange('expenses');
            setIsDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'expenses'
              ? 'text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className={`w-5 h-5 ${activeTab === 'expenses' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Gastos</span>
        </button>

        {/* Tab 4: Feed & Novedades */}
        <button
          type="button"
          onClick={() => {
            onTabChange('feed');
            setIsDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'feed'
              ? 'text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${activeTab === 'feed' ? 'text-cyan-400' : 'text-slate-400'}`} />
            {unreadMentionsCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow">
                {unreadMentionsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Feed</span>
        </button>

        {/* Tab 5: Menú / Más */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            isDrawerOpen
              ? 'text-white font-bold bg-[#1b2334]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] mt-0.5 tracking-tight">Menú</span>
        </button>
      </nav>

      {/* Mobile Drawer (Bottom Sheet) */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="relative bg-[#10141e] border-t border-[#263148] rounded-t-3xl max-h-[85vh] overflow-y-auto p-4 space-y-4 shadow-2xl z-10 animate-in slide-in-from-bottom-6">
            {/* Drawer Handle & Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#1f283c]">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${currentPersona.avatarBg}`}>
                  {currentPersona.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{currentPersona.name}</span>
                    {isGerencia && <Crown className="w-3 h-3 text-amber-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {currentPersona.role} ({currentPersona.department})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-[#182030] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector Rápido de Puesto / Área para el Celular */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                Filtrar por Puesto de Trabajo:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {areasList.map((area) => {
                  const isSelected = selectedArea === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => {
                        onAreaChange(area.id);
                        if (activeTab !== 'tasks') onTabChange('tasks');
                        setIsDrawerOpen(false);
                      }}
                      className={`p-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#BE2629] text-white shadow'
                          : 'bg-[#151b27] text-slate-300 hover:bg-[#1b2334] border border-[#232c3f]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{area.icon}</span>
                        <span className="truncate">{area.label}</span>
                      </span>
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Módulos Adicionales */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Otros Módulos:
              </span>

              {isGerencia && (
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('dashboard');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-[#BE2629] text-white'
                      : 'bg-[#161c28] text-amber-300 hover:bg-[#1f2738] border border-amber-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-amber-400" />
                    <span>Dashboard & Planillas Gerenciales</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onTabChange('reports');
                  setIsDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-[#BE2629] text-white font-bold'
                    : 'bg-[#151a26] text-slate-200 hover:bg-[#1c2333] border border-[#222a3d]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Informes Ejecutivos C-Level</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onTabChange('calendar');
                  setIsDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-[#BE2629] text-white font-bold'
                    : 'bg-[#151a26] text-slate-200 hover:bg-[#1c2333] border border-[#222a3d]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Calendario de Tareas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {isGerencia && onOpenPersonnelModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenPersonnelModal();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium bg-[#151a26] text-slate-200 hover:bg-[#1c2333] border border-[#222a3d] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>Personal, Rotación & Contraseñas</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {isGerencia && onOpenProfileModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenProfileModal();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium bg-[#151a26] text-slate-200 hover:bg-[#1c2333] border border-[#222a3d] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-[#BE2629]" />
                    <span>Cambiar de Puesto (Exclusivo Gerencia)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>

            {/* Botón de Instalación en Celular */}
            {onOpenPwaModal && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenPwaModal();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>📱 Instalar App en este Celular</span>
                </button>
              </div>
            )}

            {/* Cerrar Sesión */}
            {onLogout && (
              <div className="pt-1 border-t border-[#1f283c]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-red-950/40 text-red-300 border border-red-800/40 text-xs font-semibold hover:bg-red-900/60 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
