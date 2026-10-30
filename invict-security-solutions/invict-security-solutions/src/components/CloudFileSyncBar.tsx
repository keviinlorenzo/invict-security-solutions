import React from 'react';
import { UserPersona, UserProfileType, TaskModification } from '../types';
import { PROFILE_METADATA } from '../utils/authService';
import {
  Cloud,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface CloudFileSyncBarProps {
  currentUser: UserPersona;
  allPersonas: UserPersona[];
  lastModification?: TaskModification | null;
  onOpenAuditHistory: () => void;
  onSyncNow?: () => void;
  isSyncing?: boolean;
}

export const CloudFileSyncBar: React.FC<CloudFileSyncBarProps> = ({
  currentUser,
  allPersonas,
  lastModification,
  onOpenAuditHistory,
  onSyncNow,
  isSyncing = false,
}) => {
  const currentMeta = PROFILE_METADATA[currentUser.profileType || 'operaciones'];

  return (
    <div className="w-full bg-gradient-to-r from-[#10141e] via-[#141a27] to-[#10141e] border-y sm:border border-[#222a3d] sm:rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs mb-4">
      {/* Left: Cloud Document Status */}
      <div className="flex items-center gap-3">
        <div className="relative p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/60 text-blue-400 shrink-0">
          <Cloud className="w-5 h-5 animate-pulse" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-[#10141e] animate-ping" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-[#10141e]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-white text-xs sm:text-sm flex items-center gap-1.5">
              Archivo Corporativo Compartido: <span className="text-blue-300 font-mono">Plan_Operativo_INVICT.cloud</span>
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Sincronizado en Tiempo Real
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-1 flex-wrap">
            <span>Sesión activa como:</span>
            <span className="font-bold text-white">{currentUser.name}</span>
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${currentMeta.badge}`}>
              {currentMeta.label}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300">
              Las modificaciones que realice se reflejan al instante con su nombre, fecha y horario.
            </span>
          </div>
        </div>
      </div>

      {/* Right: Last Modification Pill */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
        {lastModification ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0c1018] border border-[#232c40] text-slate-300 max-w-xs sm:max-w-sm truncate">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="text-[11px] truncate">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">
                Última modificación en la nube:
              </span>
              <span className="text-white font-semibold">
                {lastModification.userName} ({PROFILE_METADATA[lastModification.userProfile]?.label || lastModification.userProfile})
              </span>
              <span className="text-slate-400 ml-1 text-[10px] font-mono">
                el {lastModification.formattedDate}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl bg-[#0c1018] border border-[#232c40]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Todos los puestos sincronizados en tiempo real</span>
          </div>
        )}
      </div>
    </div>
  );
};
