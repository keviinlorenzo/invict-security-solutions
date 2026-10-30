import React from 'react';
import { UserPersona } from '../types';
import { X, Check, Crown, Shield, Users, ArrowRight } from 'lucide-react';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: UserPersona[];
  currentPersona: UserPersona;
  onSelectPersona: (persona: UserPersona) => void;
  onOpenPersonnelModal?: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  isOpen,
  onClose,
  personas,
  currentPersona,
  onSelectPersona,
  onOpenPersonnelModal,
}) => {
  if (!isOpen) return null;

  const isCurrentUserGerencia = currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-[#121620] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Roles y Áreas de Oficina Central
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCurrentUserGerencia
                  ? 'Exclusivo Dirección General: selecciona con qué puesto deseas operar en la plataforma.'
                  : 'Puesto Fijo Asignado. Tu cuenta no posee permisos para conmutar entre puestos.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if not Gerencia */}
        {!isCurrentUserGerencia && (
          <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-amber-950/50 border border-amber-700/60 text-amber-200 text-xs flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Puesto Fijo Asignado:</strong> Estás conectado como <strong>{currentPersona.name}</strong> ({currentPersona.role}). Por normativa de seguridad, solo la Dirección General puede alternar entre puestos.
            </span>
          </div>
        )}

        {/* List of personas */}
        <div className="p-5 overflow-y-auto space-y-2.5">
          {personas.map((persona) => {
            const isSelected = persona.id === currentPersona.id;
            const isGerencia = persona.department === 'GERENCIA';
            return (
              <div
                key={persona.id}
                onClick={() => {
                  if (!isCurrentUserGerencia) return;
                  onSelectPersona(persona);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  !isCurrentUserGerencia && !isSelected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-[#1a2130] border-[#BE2629] shadow-md ring-1 ring-[#BE2629]/50'
                    : 'bg-[#141822] border-[#222b3d] hover:border-[#2e3b52] hover:bg-[#181e2b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0 ${persona.avatarBg}`}>
                    {persona.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {persona.name}
                      </span>
                      {isGerencia && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Crown className="w-3 h-3 text-amber-400" />
                          Acceso C-Level Total
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {persona.role} · <span className="font-mono text-slate-400">{persona.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
                      <Check className="w-3.5 h-3.5" />
                      Activo
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <span>Seleccionar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141926] border-t border-[#202737] flex items-center justify-between text-xs">
          {onOpenPersonnelModal ? (
            <button
              onClick={() => {
                onClose();
                onOpenPersonnelModal();
              }}
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>¿Necesitas cambiar o rotar quién ocupa un puesto? Click aquí</span>
            </button>
          ) : (
            <span className="text-slate-400">ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A</span>
          )}
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
