import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Laptop,
  Download,
  Monitor,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Share2,
  PlusSquare,
  Power,
  ChevronRight,
  Apple
} from 'lucide-react';
import { promptInstallPWA, isPWAInstalled } from '../utils/serviceWorkerManager';
import { InvictLogo } from './InvictLogo';

interface DesktopPwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string) => void;
}

export const DesktopPwaInstallModal: React.FC<DesktopPwaInstallModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const detectDefaultTab = (): 'android' | 'ios' | 'desktop' => {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
    return 'desktop';
  };

  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('desktop');
  const [activeDesktopOs, setActiveDesktopOs] = useState<'windows_chrome' | 'windows_edge' | 'macos'>('windows_chrome');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsStandalone(isPWAInstalled());
      setActiveTab(detectDefaultTab());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    setIsInstalling(true);
    setInstallStatus(null);
    try {
      const outcome = await promptInstallPWA();
      if (outcome === 'accepted') {
        setInstallStatus('¡Excelente! La aplicación se ha instalado correctamente en tu dispositivo.');
        onNotify?.('Aplicación instalada como App nativa');
        setIsStandalone(true);
      } else if (outcome === 'dismissed') {
        setInstallStatus('Se canceló la instalación. Puedes volver a intentarlo cuando desees.');
      } else {
        setInstallStatus(
          'Para completar la instalación en tu celular o computadora, sigue la guía paso a paso que figura debajo.'
        );
      }
    } catch (e) {
      setInstallStatus('Sigue la guía visual paso a paso indicada a continuación.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-[#0f131c] border border-[#263248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#141824] via-[#1a2030] to-[#141824] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Instalar INVICT App en tu Celular o PC
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  App Móvil & Escritorio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Accede a toda la plataforma con pantalla completa, sin barras de navegador y con carga ultrarrápida.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Install Banner for Android and Desktop Chrome */}
        <div className="p-4 sm:p-5 bg-[#141926] border-b border-[#222a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <InvictLogo size="sm" variant="isotype" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                {isStandalone ? 'Aplicación ya instalada en este equipo' : 'Instalación Directa en 1 Clic'}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Agrega el icono de INVICT en la pantalla de inicio de tu celular o en el escritorio.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerInstall}
            disabled={isInstalling}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BE2629] to-[#d62828] hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isInstalling ? 'Instalando...' : 'Instalar en este Dispositivo'}</span>
          </button>
        </div>

        {installStatus && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-[#182133] border border-[#2b3a56] text-xs text-slate-200 flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{installStatus}</span>
          </div>
        )}

        {/* Navigation Tabs: Android / iPhone / PC */}
        <div className="px-4 sm:px-5 pt-3 bg-[#0d1017] border-b border-[#1c2434] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('android')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'android'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>📱 Celular Android</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'ios'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Apple className="w-3.5 h-3.5 text-slate-200" />
            <span>🍏 iPhone / iPad (iOS)</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'desktop'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-blue-400" />
            <span>💻 Computadora (PC / Mac)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: CELULAR ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-3">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block text-emerald-400 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  Instalación en Celular Android (Google Chrome o Samsung Internet):
                </span>
                <ol className="space-y-3 text-slate-300 list-decimal pl-4 leading-relaxed">
                  <li>
                    Si el botón superior <strong>"Instalar en este Dispositivo"</strong> no abrió el diálogo directo, abre el menú de tu navegador tocando los <strong>tres puntos verticales (⋮)</strong> en la esquina superior derecha de Chrome.
                  </li>
                  <li>
                    Busca y presiona la opción <strong>"Instalar aplicación"</strong> (o <strong>"Agregar a la pantalla principal"</strong>).
                  </li>
                  <li>
                    Confirma tocando <strong>"Instalar"</strong>.
                  </li>
                  <li>
                    <strong>¡Listo!</strong> La app se agregará a tu cajón de aplicaciones y a la pantalla de inicio de tu celular con el escudo de INVICT, abriendo a pantalla completa como cualquier app descargada de Google Play Store.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 space-y-1">
                <span className="font-bold text-xs text-emerald-300 block">✓ Ventajas en Celular:</span>
                <p className="text-[11px] text-slate-300">
                  • Vista táctil adaptada para operar con una sola mano.<br />
                  • Sin barra de direcciones web que robe espacio en pantalla.<br />
                  • Carga instantánea y acceso directo a tareas, planillas y novedades.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: IPHONE / IPAD */}
          {activeTab === 'ios' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-3">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block text-cyan-400 flex items-center gap-1.5">
                  <Apple className="w-4 h-4" />
                  Instalación en iPhone o iPad (Safari iOS):
                </span>
                <ol className="space-y-3 text-slate-300 list-decimal pl-4 leading-relaxed">
                  <li>
                    Abre este sitio en <strong>Safari</strong> en tu iPhone o iPad.
                  </li>
                  <li>
                    En la barra inferior de Safari, toca el botón de <strong>Compartir</strong> <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-blue-950 border border-blue-700 font-mono text-[11px] text-blue-300">⎋ Compartir</span> (el cuadrado con la flecha hacia arriba).
                  </li>
                  <li>
                    Desliza hacia abajo en la lista de opciones y presiona <strong>"Agregar a inicio"</strong> (o <em>"Añadir a pantalla de inicio"</em> ⊞).
                  </li>
                  <li>
                    En la esquina superior derecha, presiona <strong>"Agregar"</strong>.
                  </li>
                  <li>
                    <strong>¡Listo!</strong> Quedará el icono oficial de <strong>INVICT</strong> en la pantalla de inicio de tu iPhone. Al abrirlo funcionará como una aplicación nativa sin marcos ni barra de Safari.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40 text-blue-200 space-y-1">
                <span className="font-bold text-xs text-blue-300 block">💡 Nota para iPhone:</span>
                <p className="text-[11px] text-slate-300">
                  Apple exige que la instalación de apps web en iOS se realice mediante el botón Compartir de Safari. El proceso toma solo 10 segundos y funciona en cualquier versión de iOS.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: COMPUTADORA (WINDOWS / MAC) */}
          {activeTab === 'desktop' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="flex items-center gap-2 pb-1 border-b border-[#202738]">
                <button
                  onClick={() => setActiveDesktopOs('windows_chrome')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeDesktopOs === 'windows_chrome' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Chrome
                </button>
                <button
                  onClick={() => setActiveDesktopOs('windows_edge')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeDesktopOs === 'windows_edge' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Edge
                </button>
                <button
                  onClick={() => setActiveDesktopOs('macos')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeDesktopOs === 'macos' ? 'bg-[#BE2629] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mac
                </button>
              </div>

              {activeDesktopOs === 'windows_chrome' && (
                <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-2.5">
                  <span className="font-bold text-white text-[11px] block text-[#BE2629]">
                    Paso a paso en Google Chrome para PC:
                  </span>
                  <ol className="space-y-2 text-slate-300 list-decimal pl-4">
                    <li>Haz clic en el icono de instalación en la barra de URL (arriba a la derecha) o menú ⋮ &gt; <em>"Instalar INVICT Security..."</em>.</li>
                    <li>Haz clic en <strong>"Instalar"</strong>.</li>
                    <li>Se creará el acceso directo en el Escritorio de Windows y podrás anclarlo a la barra de tareas.</li>
                  </ol>
                </div>
              )}

              {activeDesktopOs === 'windows_edge' && (
                <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-2.5">
                  <span className="font-bold text-white text-[11px] block text-emerald-400">
                    Paso a paso en Microsoft Edge:
                  </span>
                  <ol className="space-y-2 text-slate-300 list-decimal pl-4">
                    <li>Menú (...) &gt; <strong>"Aplicaciones"</strong> &gt; <strong>"Instalar este sitio como una aplicación"</strong>.</li>
                    <li>Marca "Crear acceso directo en el escritorio" y pulsa "Permitir".</li>
                  </ol>
                </div>
              )}

              {activeDesktopOs === 'macos' && (
                <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-2.5">
                  <span className="font-bold text-white text-[11px] block text-purple-400">
                    macOS (Safari / Chrome):
                  </span>
                  <p className="text-slate-300">
                    En Safari: Menú Archivo &gt; <em>"Agregar al Dock"</em>. En Chrome: Menú ⋮ &gt; <em>"Instalar INVICT Security"</em>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Advantages */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-[#121622] border border-[#1e2738] text-center">
              <span className="font-bold text-white block text-[11px]">📱 Pantalla Completa</span>
              <span className="text-[10px] text-slate-400">Sin barras de navegador</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#121622] border border-[#1e2738] text-center">
              <span className="font-bold text-white block text-[11px]">⚡ Carga Veloz</span>
              <span className="text-[10px] text-slate-400">Caché offline nativa</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#121622] border border-[#1e2738] text-center">
              <span className="font-bold text-white block text-[11px]">🔔 Notificaciones</span>
              <span className="text-[10px] text-slate-400">Alertas de tareas</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-[#141824] border-t border-[#222a3d] flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            INVICT Security Solutions · App PWA Móvil & PC
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#202737] hover:bg-[#283246] text-white font-bold transition-colors cursor-pointer text-xs"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
