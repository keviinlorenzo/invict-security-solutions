import React, { useState } from 'react';
import {
  HubbardConditionFormula,
  HubbardConditionId,
  HUBBARD_CONDITIONS
} from '../../data/hubbardConditionsData';
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Award,
  Zap,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';

interface HubbardConditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConditionId?: HubbardConditionId;
}

export const HubbardConditionModal: React.FC<HubbardConditionModalProps> = ({
  isOpen,
  onClose,
  initialConditionId = 'normal',
}) => {
  const [selectedConditionId, setSelectedConditionId] = useState<HubbardConditionId>(initialConditionId);

  React.useEffect(() => {
    if (initialConditionId) {
      setSelectedConditionId(initialConditionId);
    }
  }, [initialConditionId, isOpen]);

  if (!isOpen) return null;

  const currentFormula = HUBBARD_CONDITIONS[selectedConditionId] || HUBBARD_CONDITIONS.normal;

  const conditionsList: { id: HubbardConditionId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'inexistencia', label: '1. Inexistencia', icon: <Activity className="w-3.5 h-3.5" />, color: '#94a3b8' },
    { id: 'peligro_superior', label: '2. Peligro (Superior)', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: '#ef4444' },
    { id: 'peligro_individuo', label: '3. Peligro (Individuo)', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: '#f87171' },
    { id: 'emergencia', label: '4. Emergencia', icon: <Flame className="w-3.5 h-3.5" />, color: '#f59e0b' },
    { id: 'normal', label: '5. Normal', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: '#3b82f6' },
    { id: 'afluencia', label: '6. Afluencia', icon: <Award className="w-3.5 h-3.5" />, color: '#10b981' },
    { id: 'afluencia_accion', label: '7. Afluencia de Acción', icon: <Award className="w-3.5 h-3.5" />, color: '#059669' },
    { id: 'poder', label: '8. Poder', icon: <Zap className="w-3.5 h-3.5" />, color: '#8b5cf6' },
    { id: 'cambio_poder', label: '9. Cambio de Poder', icon: <ShieldCheck className="w-3.5 h-3.5" />, color: '#a855f7' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-[#10141e] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-slate-700">
                  HUBBARD MANAGEMENT TECHNOLOGY
                </span>
                <span className="text-[10px] text-rose-400 font-bold uppercase font-mono">
                  EXCLUSIVO GERENCIA
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                Las Fórmulas de las Condiciones de Existencia
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar Navigation + Detailed Steps */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden text-xs">
          {/* Left Tabs: List of Conditions */}
          <div className="w-full md:w-64 bg-[#0d1017] border-b md:border-b-0 md:border-r border-[#20293a] p-3 space-y-1 overflow-y-auto shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">
              Seleccionar Fórmula:
            </span>
            {conditionsList.map((cond) => {
              const isSelected = selectedConditionId === cond.id;
              return (
                <button
                  key={cond.id}
                  type="button"
                  onClick={() => setSelectedConditionId(cond.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#1b2334] text-white shadow border border-[#303e5c]'
                      : 'text-slate-400 hover:bg-[#141924] hover:text-slate-200'
                  }`}
                  style={{ borderLeft: isSelected ? `4px solid ${cond.color}` : undefined }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span style={{ color: cond.color }}>{cond.icon}</span>
                    <span className="truncate">{cond.label}</span>
                  </div>
                  {isSelected && <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Right Panel: Detailed Steps & Corporate Application */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto space-y-5">
            {/* Condition Header Banner */}
            <div
              className={`p-4 rounded-2xl border ${currentFormula.borderLight} ${currentFormula.bgDark} space-y-2 shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40"
                  style={{ color: currentFormula.color }}
                >
                  {currentFormula.badgeTitle}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  INVICT Security Solutions S.A.
                </span>
              </div>
              <h3 className="text-xl font-black text-white">{currentFormula.name}</h3>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                <strong>¿Cuándo se aplica según la estadística?</strong> {currentFormula.trendDefinition}
              </p>
            </div>

            {/* Official Steps Sequence */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Pasos Exactos de la Fórmula a Ejecutar:</span>
              </h4>

              <div className="space-y-2.5">
                {currentFormula.steps.map((st) => (
                  <div
                    key={st.number}
                    className="p-3.5 rounded-2xl bg-[#141926] border border-[#232c3f] flex items-start gap-3 hover:border-[#33415c] transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs font-mono shrink-0 shadow"
                      style={{
                        backgroundColor: `${currentFormula.color}25`,
                        color: currentFormula.color,
                        border: `1px solid ${currentFormula.color}60`,
                      }}
                    >
                      {st.number}
                    </div>
                    <div className="space-y-1">
                      {st.title && (
                        <h5 className="font-bold text-white text-xs tracking-tight">
                          {st.title}
                        </h5>
                      )}
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {st.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules / Specific Advice from Document */}
            {currentFormula.rulesOrAdvice && currentFormula.rulesOrAdvice.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#1a1c24] border border-amber-600/50 text-amber-200 text-xs space-y-1.5">
                <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-300 font-mono">
                  Principios Clave del Documento:
                </span>
                {currentFormula.rulesOrAdvice.map((advice, idx) => (
                  <p key={idx} className="text-slate-300 leading-relaxed font-sans">
                    {advice}
                  </p>
                ))}
              </div>
            )}

            {/* Corporate Application for INVICT */}
            <div className="p-4 rounded-2xl bg-[#0e131d] border border-[#1f293d] space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Building className="w-4 h-4" />
                <span>Aplicación Directiva en INVICT Security Solutions:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Cuando una métrica corporativa de la oficina (como la <em>Carga Laboral</em>, la <em>Eficacia del Personal</em> o los <em>Ingresos de Clientes</em>) adopta esta condición, la Dirección General debe verificar paso por paso que se cumplan las acciones en orden cronológico, sin saltear ningún punto, garantizando la estabilización del área antes de promover cambios estructurales.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#141926] border-t border-[#20293a] flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px] font-mono">
            Documento de referencia: Hubbard College of Administration Ecuador
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white font-bold transition-all cursor-pointer active:scale-95 shadow"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
