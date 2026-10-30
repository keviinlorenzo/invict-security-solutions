import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  Download,
  Monitor,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  HelpCircle,
  Cpu,
  Power
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
  const [activeOsTab, setActiveOsTab] = useState<'windows_chrome' | 'windows_edge' | 'macos'>('windows_chrome');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsStandalone(isPWAInstalled());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    setIsInstalling(true);
    setInstallStatus(null);
    try {
      const outcome = await promptInstallPWA();
      if (outcome === 'accepted') {
        setInstallStatus('¡Excelente! La aplicación se ha instalado correctamente en tu sistema operativo.');
        onNotify?.('Aplicación instalada como App de escritorio nativa');
        setIsStandalone(true);
      } else if (outcome === 'dismissed') {
        setInstallStatus('Se canceló la instalación. Puedes volver a intentarlo cuando desees.');
      } else {
        setInstallStatus(
          'El navegador no mostró el diálogo automático (puede que ya esté instalada o estés en modo incógnito). Sigue los sencillos pasos manuales que figuran abajo según tu navegador.'
        );
      }
    } catch (e) {
      setInstallStatus('Sigue la guía visual paso a paso indicada a continuación.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-3xl bg-[#0f131c] border border-[#263248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#141824] via-[#1a2030] to-[#141824] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Instalación de la App en Computadoras de Puesto (PWA)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  App Nativa de Escritorio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Guía oficial para implementar la plataforma en cada puesto de trabajo (Guardias, Operaciones, RRHH, Administración y Gerencia).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Install Banner */}
        <div className="p-5 bg-[#141926] border-b border-[#222a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <InvictLogo size="sm" variant="isotype" />
            <div>
              <h4 className="text-sm font-bold text-white">
                {isStandalone ? 'Aplicación ya instalada en este equipo' : 'Instalación Rápida Automática'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Crea un acceso directo en el Escritorio de Windows y ancla a la barra de tareas.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerInstall}
            disabled={isInstalling}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BE2629] to-[#d62828] hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isInstalling ? 'Instalando...' : 'Instalar en esta Computadora'}</span>
          </button>
        </div>

        {installStatus && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#182133] border border-[#2b3a56] text-xs text-slate-200 flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{installStatus}</span>
          </div>
        )}

        {/* Navigation Tabs by Browser/OS */}
        <div className="px-5 pt-4 bg-[#0d1017] border-b border-[#1c2434] flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveOsTab('windows_chrome')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-2 ${
              activeOsTab === 'windows_chrome'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-400" />
            <span>Windows (Google Chrome)</span>
          </button>
          <button
            onClick={() => setActiveOsTab('windows_edge')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-2 ${
              activeOsTab === 'windows_edge'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span>Windows (Microsoft Edge)</span>
          </button>
          <button
            onClick={() => setActiveOsTab('macos')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-2 ${
              activeOsTab === 'macos'
                ? 'text-white border-[#BE2629] bg-[#141926]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Laptop className="w-4 h-4 text-purple-400" />
            <span>macOS (Chrome / Safari)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeOsTab === 'windows_chrome' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-3">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block text-[#BE2629]">
                  Paso a paso en Google Chrome para cada PC:
                </span>
                <ol className="space-y-2.5 text-slate-300 list-decimal pl-4">
                  <li>
                    Abre la dirección web del sistema en <strong>Google Chrome</strong> en la computadora del puesto operativo.
                  </li>
                  <li>
                    En la barra de direcciones de Chrome (arriba a la derecha), busca el ícono de instalación que tiene forma de <strong>pantalla con una flecha hacia abajo</strong> (o presiona los tres puntos verticales ⋮ &gt; <em>"Instalar INVICT Security..."</em>).
                  </li>
                  <li>
                    Haz clic en <strong>"Instalar"</strong> en el cuadro emergente de confirmación.
                  </li>
                  <li>
                    <strong>¡Listo!</strong> La aplicación se abrirá inmediatamente en una ventana dedicada e independiente sin la barra de direcciones web ni pestañas.
                  </li>
                  <li>
                    Aparecerá un ícono con el escudo de INVICT en el <strong>Escritorio de Windows</strong> y podrás hacer clic derecho sobre él en la barra de tareas y elegir <em>"Anclar a la barra de tareas"</em>.
                  </li>
                </ol>
              </div>

              {/* Guard Station Recommendation */}
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                  <Power className="w-4 h-4 text-amber-400" />
                  <span>Recomendación para puestos de guardia (Kraft / Bodegas / Fuesmen)</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Para que la app se abra automáticamente al encender la computadora del puesto: presiona <kbd className="px-1 py-0.5 rounded bg-black/40 font-mono text-[10px]">Win + R</kbd>, escribe <kbd className="px-1 py-0.5 rounded bg-black/40 font-mono text-[10px]">shell:startup</kbd> y arrastra el acceso directo de INVICT a esa carpeta. Así el vigilador siempre tendrá la matriz en pantalla.
                </p>
              </div>
            </div>
          )}

          {activeOsTab === 'windows_edge' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-3">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block text-emerald-400">
                  Paso a paso en Microsoft Edge:
                </span>
                <ol className="space-y-2.5 text-slate-300 list-decimal pl-4">
                  <li>
                    Abre la aplicación en <strong>Microsoft Edge</strong>.
                  </li>
                  <li>
                    Haz clic en el ícono de tres puntos horizontales (<strong>...</strong>) en la esquina superior derecha.
                  </li>
                  <li>
                    Pasa el cursor por <strong>"Aplicaciones"</strong> y selecciona <strong>"Instalar este sitio como una aplicación"</strong> (o <em>"Instalar INVICT Security"</em>).
                  </li>
                  <li>
                    En la ventana emergente, marca las casillas:
                    <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                      <li>✓ Crear acceso directo en el escritorio</li>
                      <li>✓ Anclar a la barra de tareas</li>
                      <li>✓ Iniciar automáticamente al iniciar sesión en el dispositivo</li>
                    </ul>
                  </li>
                  <li>
                    Haz clic en <strong>"Permitir"</strong>. La aplicación ahora se comporta 100% como un software de escritorio nativo.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeOsTab === 'macos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#141926] border border-[#242e42] space-y-3">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block text-purple-400">
                  Instalación en computadoras Mac (Dirección / Gerencia):
                </span>
                <ol className="space-y-2.5 text-slate-300 list-decimal pl-4">
                  <li>
                    <strong>En Google Chrome para Mac:</strong> haz clic en el ícono de instalación en la barra de URL o ve a Menú ⋮ &gt; <em>"Instalar INVICT Security"</em>.
                  </li>
                  <li>
                    <strong>En Safari (macOS Sonoma o posterior):</strong> haz clic en el menú <em>Archivo &gt; "Agregar al Dock"</em>.
                  </li>
                  <li>
                    Se creará la app con el logo oficial en el Launchpad y en la barra Dock de macOS, abriéndose en modo ventana aislada sin interfaz de navegador.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Advantages of PWA Desktop Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#121622] border border-[#1e2738] space-y-1">
              <span className="font-bold text-white block">Ventana Limpia</span>
              <p className="text-[11px] text-slate-400">Sin distracciones, pestañas ajenas ni barras de navegación web.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#121622] border border-[#1e2738] space-y-1">
              <span className="font-bold text-white block">Operatividad Offline</span>
              <p className="text-[11px] text-slate-400">Service worker almacena en caché la matriz para seguir operando ante cortes de red.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#121622] border border-[#1e2738] space-y-1">
              <span className="font-bold text-white block">Acceso en 1 Clic</span>
              <p className="text-[11px] text-slate-400">Icono corporativo en el Escritorio para acceso veloz en cada cambio de guardia.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141824] border-t border-[#222a3d] flex items-center justify-between text-xs">
          <span className="text-slate-400">
            INVICT Security Solutions · Sistema PWA v1.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#202737] hover:bg-[#283246] text-white font-bold transition-colors cursor-pointer"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
