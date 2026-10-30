import React, { useState, useEffect, useRef } from 'react';
import { InvictLogo } from './InvictLogo';
import { UserPersona, UserProfileType, AreaType } from '../types';
import {
  PROFILE_METADATA,
  determineProfileFromEmail
} from '../utils/authService';
import {
  verifyProfilePassword,
  getProfilePasswords,
  recoverGerenciaPassword,
  DEFAULT_PROFILE_PASSWORDS
} from '../utils/cloudSyncService';
import {
  initiateGerenciaPasswordRecovery,
  verifyGerenciaCode,
  getPendingRecoveryRequest
} from '../utils/emailRecoveryService';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  UserCheck,
  Sparkles,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Users,
  Briefcase,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  RefreshCw,
  X,
  Crown,
  Key,
  ExternalLink,
  Send
} from 'lucide-react';
import { formatCurrentFullDate } from '../utils/dateUtils';

interface LoginScreenProps {
  onLoginSuccess: (user: UserPersona) => void;
  availablePersonas: UserPersona[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  availablePersonas,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<UserPersona | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery Modal state
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify' | 'new_password'>('request');
  const [isDispatchingRecovery, setIsDispatchingRecovery] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [newGerenciaPassword, setNewGerenciaPassword] = useState('');
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
  const [recoveryErrorMessage, setRecoveryErrorMessage] = useState<string | null>(null);
  const [recoveryConnectorUrls, setRecoveryConnectorUrls] = useState<{
    gmailUrl: string;
    outlookUrl: string;
    targetEmail: string;
  } | null>(null);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const detectedProfile = selectedPersona?.profileType || (email.trim() ? determineProfileFromEmail(email) : null);
  const detectedProfileMeta = detectedProfile ? PROFILE_METADATA[detectedProfile] : null;

  const handleSelectQuickProfile = (persona: UserPersona) => {
    setSelectedPersona(persona);
    setEmail(persona.email);
    setPassword('');
    setErrorMessage(null);
    setSuccessNotice(`Puesto seleccionado: ${persona.name} (${persona.role}). Ingrese su contraseña personal.`);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor ingrese su dirección de correo corporativo o seleccione su puesto.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor ingrese su contraseña de acceso.');
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      let targetPersona = availablePersonas.find(p => p.email.toLowerCase() === cleanEmail);
      if (!targetPersona && selectedPersona) {
        targetPersona = selectedPersona;
      }
      const targetProfile: UserProfileType = targetPersona?.profileType || determineProfileFromEmail(cleanEmail);

      const isValid = verifyProfilePassword(targetProfile, password, cleanEmail);
      if (!isValid) {
        setErrorMessage(
          `Contraseña incorrecta para el puesto "${targetProfile.toUpperCase()}". Cada cuenta posee credenciales personales fijas. Si Gerencia requiere restablecer su clave, use el Centro de Recuperación vía Gmail u Outlook.`
        );
        setIsSubmitting(false);
        return;
      }

      const finalPersona: UserPersona = targetPersona || {
        id: `user-${Date.now()}`,
        name: cleanEmail.split('@')[0].toUpperCase(),
        email: cleanEmail,
        role: targetProfile === 'GERENTE' ? 'Gerente General (C-Level)' : `${PROFILE_METADATA[targetProfile].label} Operativa`,
        department: PROFILE_METADATA[targetProfile].department,
        profileType: targetProfile,
        avatarBg: PROFILE_METADATA[targetProfile].border,
      };

      setSuccessNotice(`Acceso autorizado para ${finalPersona.name} (${PROFILE_METADATA[targetProfile].label}). Conectando al sistema en tiempo real...`);
      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(finalPersona);
      }, 500);
    }, 300);
  };

  // --- RECOVERY FLOW WITH GMAIL & OUTLOOK CONNECTOR ---
  const handleOpenRecoveryModal = () => {
    setIsRecoveryModalOpen(true);
    setRecoveryErrorMessage(null);
    setRecoverySuccessMessage(null);
    const pending = getPendingRecoveryRequest();
    if (pending) {
      setRecoveryStep('verify');
      setRecoveryConnectorUrls({
        gmailUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(pending.targetEmail)}`,
        outlookUrl: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(pending.targetEmail)}`,
        targetEmail: pending.targetEmail,
      });
    } else {
      setRecoveryStep('request');
    }
  };

  const handleDispatchRecoveryEmail = async () => {
    setIsDispatchingRecovery(true);
    setRecoveryErrorMessage(null);
    setRecoverySuccessMessage(null);
    try {
      const res = await initiateGerenciaPasswordRecovery('consultasinvictsolutionss.a@gmail.com');
      setRecoveryConnectorUrls({
        gmailUrl: res.gmailComposeUrl,
        outlookUrl: res.outlookComposeUrl,
        targetEmail: 'consultasinvictsolutionss.a@gmail.com',
      });
      setRecoverySuccessMessage(res.message);
      setRecoveryStep('verify');
    } catch (err: any) {
      setRecoveryErrorMessage('Hubo un error al despachar la notificación. Intente nuevamente.');
    } finally {
      setIsDispatchingRecovery(false);
    }
  };

  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryErrorMessage(null);
    const result = verifyGerenciaCode(recoveryCodeInput);
    if (!result.verified) {
      setRecoveryErrorMessage(result.message);
      return;
    }
    setRecoverySuccessMessage(result.message);
    setRecoveryStep('new_password');
  };

  const handleSaveNewPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPass = newGerenciaPassword.trim();
    if (!newPass || newPass.length < 6) {
      setRecoveryErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    recoverGerenciaPassword(newPass);
    setRecoverySuccessMessage('¡Contraseña de Gerencia actualizada con éxito! Ya puedes iniciar sesión.');
    setEmail('consultasinvictsolutionss.a@gmail.com');
    setPassword(newPass);
    setTimeout(() => {
      setIsRecoveryModalOpen(false);
      setSuccessNotice('Contraseña de Gerencia actualizada en vivo. Presione "Ingresar al Sistema".');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between font-sans selection:bg-[#BE2629] selection:text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(190,38,41,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-950/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-blue-950/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Corporate Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-[#182030] bg-[#090d16]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <InvictLogo size="sm" variant="official" />
          <div className="hidden sm:block border-l border-[#242e42] pl-3">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest block">
              Oficina Central
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Seguridad Física & Custodia Integral
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 hidden md:inline-block">
            {formatCurrentFullDate()}
          </span>
          <div className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Nube Activa</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-[#0f1420]/95 border border-[#232d42] rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative">
          {/* Emblem & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#161c28] to-[#0e121a] border border-[#273248] shadow-inner mb-3">
              <InvictLogo size="md" variant="isotype" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Plataforma Corporativa de Control Operativo, Matriz de Tareas Diarias y Gestión Gerencial
            </p>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Correo Electrónico Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="ej: consultasinvictsolutionss.a@gmail.com o puesto@invictsecurity.com.ar"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141926] border border-[#263148] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Contraseña de Acceso
                </label>
                <button
                  type="button"
                  onClick={handleOpenRecoveryModal}
                  className="text-xs text-[#BE2629] hover:underline font-semibold cursor-pointer"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Ingrese su contraseña personal"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141926] border border-[#263148] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] font-mono transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-200 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Profile detection badge */}
            {detectedProfileMeta && (
              <div className="p-2.5 rounded-xl bg-[#141824] border border-[#232b3e] flex items-center justify-between text-xs animate-in fade-in">
                <span className="text-slate-400 text-[11px]">Puesto Reconocido:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] border ${detectedProfileMeta.badge}`}>
                  {detectedProfileMeta.label} ({detectedProfileMeta.department})
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando Credenciales...' : 'Ingresar al Sistema'}</span>
            </button>
          </form>

          {/* Quick Station Selection Chips */}
          <div className="mt-6 pt-5 border-t border-[#1f283c]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Seleccionar Puesto de Trabajo Directo:
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-semibold">
                Operaciones ≠ Supervisión
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availablePersonas.map((persona) => {
                const isSelected = selectedPersona?.id === persona.id || email.toLowerCase() === persona.email.toLowerCase();
                const isSupervision = persona.department === 'SUPERVISIÓN';
                const isOperaciones = persona.department === 'OPERACIONES';
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => handleSelectQuickProfile(persona)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-[#1c2436] border-[#BE2629] shadow-md ring-1 ring-[#BE2629]/50'
                        : isSupervision
                        ? 'bg-amber-950/20 border-amber-800/40 hover:border-amber-500/80 hover:bg-amber-950/40'
                        : isOperaciones
                        ? 'bg-rose-950/20 border-rose-800/40 hover:border-rose-500/80 hover:bg-rose-950/40'
                        : 'bg-[#121622] border-[#20293b] hover:border-[#2d3a52] hover:bg-[#161c2b]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-white text-xs truncate">
                        {persona.name}
                      </span>
                      {isSupervision && (
                        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                          Móvil
                        </span>
                      )}
                      {isOperaciones && (
                        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                          Oficina
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {persona.role}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Claves Corporativas Informativas */}
            <div className="mt-3.5 p-3 rounded-xl bg-[#0c1018] border border-[#1e2538] text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Puestos diferenciados por equipo:</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] flex-wrap">
                <span className="text-rose-300 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/60">
                  Operaciones (Oficina): <strong>Operaciones2026!</strong>
                </span>
                <span className="text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60">
                  Supervisión (Terreno): <strong>Supervision2026!</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#182030] bg-[#090d16]/80 backdrop-blur-md text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="font-bold text-slate-300">ADMINISTRACIÓN INVICT SECURITY SOLUTIONS S.A.</span>
          <span className="hidden sm:inline text-slate-600">·</span>
          <span className="text-slate-400">Este sitio fue creado por <strong className="text-slate-200">Kevin Lorenzo</strong></span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sincronización segura activa</span>
        </div>
      </footer>

      {/* RECOVERY MODAL WITH GMAIL & OUTLOOK DIRECT CONNECTOR */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-xl bg-[#111622] border border-[#26324a] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#151c2c] to-[#111622] border-b border-[#253046] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Recuperación de Contraseña con Conector de Correo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Conector directo con Gmail y Outlook para Gerencia General
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {recoveryErrorMessage && (
                <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2 shadow animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{recoveryErrorMessage}</span>
                </div>
              )}

              {recoverySuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2 shadow animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{recoverySuccessMessage}</span>
                </div>
              )}

              {/* STEP 1: Request Email Token */}
              {recoveryStep === 'request' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#141926] border border-[#242f44] space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>Protocolo de Seguridad para Dirección General</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Por normativa de seguridad de INVICT Security Solutions, <strong>no existen claves universales</strong>. Para restablecer la clave de Gerencia, se despacha un token de seguridad de 6 dígitos a la casilla corporativa registrada:
                    </p>
                    <div className="p-3 rounded-xl bg-[#0d1017] border border-[#1f2638] flex items-center justify-between font-mono text-xs text-white">
                      <span>consultasinvictsolutionss.a@gmail.com</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Verificado
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDispatchRecoveryEmail}
                    disabled={isDispatchingRecovery}
                    className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#BE2629] to-[#d62828] hover:brightness-110 active:scale-95 text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isDispatchingRecovery ? 'Despachando Token...' : 'Enviar Token por Gmail / Outlook a Gerencia'}</span>
                  </button>
                </div>
              )}

              {/* STEP 2: Verify 6-digit Code & Open Connectors */}
              {recoveryStep === 'verify' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Direct Webmail Connectors */}
                  {recoveryConnectorUrls && (
                    <div className="p-4 rounded-2xl bg-[#141926] border border-[#263248] space-y-3">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Conectores Directos a Bandejas de Correo:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <a
                          href={recoveryConnectorUrls.gmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-[#1b2234] hover:bg-[#232d44] border border-[#2b3956] text-white text-xs font-bold flex items-center justify-between transition-colors shadow"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span>Abrir Gmail Web Directo</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>

                        <a
                          href={recoveryConnectorUrls.outlookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-[#1b2234] hover:bg-[#232d44] border border-[#2b3956] text-white text-xs font-bold flex items-center justify-between transition-colors shadow"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span>Abrir Outlook Web Directo</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleVerifyCodeSubmit} className="p-4 rounded-2xl bg-[#0e121a] border border-[#20293b] space-y-3">
                    <label className="block text-xs font-bold text-white">
                      Ingrese el Código de Verificación (6 dígitos) o Token recibido:
                    </label>
                    <input
                      type="text"
                      value={recoveryCodeInput}
                      onChange={(e) => setRecoveryCodeInput(e.target.value)}
                      placeholder="ej: 849201 o SEC-INV-..."
                      className="w-full px-4 py-2.5 bg-[#141926] border border-[#2a364d] rounded-xl text-sm text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#BE2629]"
                      required
                    />
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleDispatchRecoveryEmail}
                        className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Reenviar nuevo token
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#BE2629] hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow cursor-pointer transition-all"
                      >
                        Validar Código
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 3: Set New Password */}
              {recoveryStep === 'new_password' && (
                <form onSubmit={handleSaveNewPasswordSubmit} className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Identidad de Gerencia Verificada</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Configure la nueva contraseña personal para Dirección General:
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nueva Contraseña para Gerencia General:
                    </label>
                    <input
                      type="text"
                      value={newGerenciaPassword}
                      onChange={(e) => setNewGerenciaPassword(e.target.value)}
                      placeholder="Ingrese la nueva contraseña deseada"
                      className="w-full px-4 py-2.5 bg-[#141926] border border-[#2a364d] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-[#BE2629]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    Guardar y Activar Nueva Clave
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
