import React from 'react';
import { Laptop, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { InvictLogo } from './InvictLogo';

interface FooterWatermarkProps {
  onOpenPwaModal?: () => void;
}

export const FooterWatermark: React.FC<FooterWatermarkProps> = ({ onOpenPwaModal }) => {
  return (
    <footer className="mt-auto border-t border-[#1e2535] bg-[#080a0e] text-slate-400 select-none py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Organization Info with official Emblem */}
        <div className="flex items-center gap-2.5">
          <InvictLogo size="xs" variant="isotype" />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">
              ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A.
            </span>
            <span className="text-[11px] text-slate-400">
              Este sitio fue creado por <strong className="text-slate-200 font-semibold">Kevin Lorenzo</strong>
            </span>
          </div>
        </div>

        {/* Center: Official App Version & PWA Desktop Link */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121622] border border-[#263147] shadow-sm text-xs group hover:border-[#BE2629]/60 transition-colors">
          <Laptop className="w-3.5 h-3.5 text-[#BE2629]" />
          <span className="text-slate-300 font-medium">
            INVICT App <strong className="text-white font-bold">v3.0 C-Level</strong> · Versión Desktop PWA
          </span>
          {onOpenPwaModal && (
            <button
              onClick={onOpenPwaModal}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#BE2629]/20 hover:bg-[#BE2629]/30 text-[#BE2629] text-[11px] font-semibold border border-[#BE2629]/40 cursor-pointer transition-colors"
              title="Instalar como aplicación nativa en este equipo"
            >
              <Download className="w-3 h-3" />
              <span>Instalar App</span>
            </button>
          )}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Aplicación Sincronizada y Activa" />
        </div>

        {/* Right: Technical Version & Security Status */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encriptación SHA-256</span>
          </span>
          <span>·</span>
          <span className="text-emerald-400">Enlace Nube Activo</span>
        </div>
      </div>
    </footer>
  );
};
