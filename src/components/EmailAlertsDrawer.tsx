import React, { useState } from 'react';
import { EmailNotificationLog } from '../types';
import {
  X,
  Mail,
  CheckCheck,
  RotateCw,
  ShieldCheck,
  Inbox
} from 'lucide-react';
import { resendEmailAlert } from '../utils/emailAlertService';

interface EmailAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  emailLogs: EmailNotificationLog[];
  onRefreshLogs: () => void;
  onNotify: (msg: string) => void;
}

export const EmailAlertsDrawer: React.FC<EmailAlertsDrawerProps> = ({
  isOpen,
  onClose,
  emailLogs,
  onRefreshLogs,
  onNotify,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailNotificationLog | null>(
    emailLogs.length > 0 ? emailLogs[0] : null
  );
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const handleResend = (id: string) => {
    const updated = resendEmailAlert(id);
    if (updated) {
      onRefreshLogs();
      onNotify(`Alerta por correo reenviada a ${updated.recipientEmail}`);
      if (selectedEmail && selectedEmail.id === id) {
        setSelectedEmail(updated);
      }
    }
  };

  const filteredLogs = emailLogs.filter((log) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.recipientEmail.toLowerCase().includes(q) ||
      log.recipientName.toLowerCase().includes(q) ||
      log.senderName.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl h-full bg-[#10141e] border-l border-[#252f44] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#141926] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Sistema de Alertas por Correo Electrónico
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  SMTP Activo
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Despacho automático de notificaciones por email para cada mención @ registrada
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

        {/* Filter Bar */}
        <div className="p-3 bg-[#0d1017] border-b border-[#202737] flex items-center justify-between gap-3 text-xs">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Filtrar por destinatario o asunto..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 bg-[#141822] border border-[#263147] rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629]"
            />
          </div>
          <span className="text-[11px] text-slate-400 font-mono shrink-0">
            {filteredLogs.length} alertas emitidas
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* List */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-[#202737] overflow-y-auto divide-y divide-[#1b2232]">
            {filteredLogs.map((log) => {
              const isSelected = selectedEmail?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedEmail(log)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#182030] border-l-2 border-[#BE2629]'
                      : 'hover:bg-[#131722]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-white text-xs truncate">
                      Para: {log.recipientName}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCheck className="w-3 h-3" />
                      {log.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium truncate mb-1">
                    {log.subject}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mb-1.5">
                    "{log.bodySnippet}"
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>De: {log.senderName}</span>
                    <span className="font-mono">{log.timestamp}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="w-full md:w-1/2 bg-[#0c0e14] p-4 overflow-y-auto flex flex-col justify-between">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-[#141926] border border-[#242e42] rounded-2xl space-y-2">
                  <div className="flex items-start justify-between gap-2 border-b border-[#222b3d] pb-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Destinatario:
                      </span>
                      <span className="text-xs font-bold text-white">
                        {selectedEmail.recipientName} ({selectedEmail.recipientEmail})
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                      {selectedEmail.status}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-400 text-[11px]">Asunto: </span>
                    <span className="text-slate-200 font-semibold">{selectedEmail.subject}</span>
                  </div>
                </div>

                {/* Email visual card */}
                <div className="bg-white text-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-300 text-xs">
                  <div className="bg-[#BE2629] text-white p-4">
                    <div className="font-black text-sm tracking-wider uppercase">
                      INVICT SECURITY SOLUTIONS S.A.
                    </div>
                    <div className="text-[10px] text-red-100 uppercase tracking-widest mt-0.5">
                      Sistema de Alertas Operativas en Tiempo Real
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-700">
                      Hola <strong>{selectedEmail.recipientName}</strong>,
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Has sido mencionado por <strong>{selectedEmail.senderName}</strong> en el sistema de gestión de INVICT Security:
                    </p>
                    <div className="p-3 bg-slate-100 border-l-4 border-[#BE2629] rounded text-slate-800 text-xs italic font-medium">
                      "{selectedEmail.bodySnippet}"
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Esta notificación fue emitida automáticamente debido al uso de la etiqueta <strong>@</strong>. Por favor ingresa a la plataforma para responder.
                    </p>
                  </div>
                  <div className="bg-slate-100 border-t border-slate-200 p-3 text-[10px] text-slate-500">
                    INVICT Security Solutions S.A. · Oficina Central
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
                <Inbox className="w-10 h-10 mb-2 opacity-50" />
                <span>Selecciona una alerta para previsualizar</span>
              </div>
            )}

            {selectedEmail && (
              <div className="pt-4 border-t border-[#202737] flex items-center justify-between gap-2 mt-4">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Alerta certificada por SMTP
                </span>
                <button
                  type="button"
                  onClick={() => handleResend(selectedEmail.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c2333] hover:bg-[#253046] text-slate-200 border border-[#2c3852] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reenviar Alerta</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
