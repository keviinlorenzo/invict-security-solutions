import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellRing,
  CheckCircle,
  Send,
  ShieldCheck
} from 'lucide-react';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  triggerPersistentNotification,
  isServiceWorkerAvailable
} from '../utils/notificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swActive, setSwActive] = useState<boolean>(false);
  const [testSent, setTestSent] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermissionState());
      setSwActive(isServiceWorkerAvailable());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      onNotify('Permiso de notificaciones concedido con éxito.');
    } else {
      onNotify('Permiso denegado o no concedido por el navegador.');
    }
  };

  const handleSendTestNotification = () => {
    const success = triggerPersistentNotification(
      'INVICT Security - Alerta de Prueba',
      'El sistema de notificaciones web y alertas de vencimiento está 100% operativo.',
      'test-tag'
    );
    if (success) {
      setTestSent(true);
      onNotify('Notificación emitida en el escritorio/dispositivo.');
      setTimeout(() => setTestSent(false), 5000);
    } else {
      onNotify('No se pudo enviar la notificación. Verifica los permisos del navegador.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg bg-[#121620] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Notificaciones Web Persistentes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Alertas directas de vencimientos menores a 24hs y menciones en tiempo real.
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

        <div className="p-5 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#151a25] border border-[#242f44] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Permiso del Navegador:</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                permission === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : permission === 'denied'
                  ? 'bg-red-950 text-red-300 border border-red-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {permission === 'granted' ? 'Habilitado' : permission === 'denied' ? 'Bloqueado' : 'Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Service Worker (Segundo Plano):</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                swActive ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {swActive ? 'Activo (sw.js)' : 'Modo Estándar'}
              </span>
            </div>
          </div>

          {permission !== 'granted' && (
            <button
              onClick={handleRequestPermission}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#BE2629] hover:bg-[#a62b2e] text-white rounded-xl font-bold shadow transition-colors active:scale-95 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>Permitir Notificaciones en este Navegador</span>
            </button>
          )}

          <button
            onClick={handleSendTestNotification}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1b2333] hover:bg-[#253046] text-slate-200 border border-[#2d3a52] rounded-xl font-semibold transition-colors active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4 text-amber-400" />
            <span>Emitir Notificación de Prueba</span>
          </button>

          {testSent && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Notificación disparada. Revisa el centro de notificaciones de tu sistema.</span>
            </div>
          )}

          <div className="p-3.5 bg-[#0d1017] rounded-2xl border border-[#1f2638] space-y-1.5 text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#BE2629]" />
              <span>Eventos que disparan alertas automáticas:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Tareas operativas con vencimiento a menos de 24 horas.</li>
              <li>Menciones directas con <strong>@puesto</strong> en el feed o tareas.</li>
              <li>Cartas documento con plazo legal perentorio de 48 horas.</li>
            </ul>
          </div>
        </div>

        <div className="p-4 bg-[#141926] border-t border-[#202737] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1b2232] hover:bg-[#252f44] text-white font-semibold rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
