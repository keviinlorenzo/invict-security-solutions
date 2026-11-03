import React, { useState } from 'react';
import { AreaType, PriorityType, Task, TaskNature, UserPersona, ShiftType } from '../types';
import { X, Plus, Calendar, Tag, User, Layers, Repeat, MapPin, Shield } from 'lucide-react';
import { formatPeriodName, getTodayDateString } from '../utils/dateUtils';
import { getDayOfWeekFromDateString, getDayOfWeekLabel, getWeeklyDatesForMonth } from '../utils/monthRenewalService';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  currentPeriod: string;
  defaultArea?: AreaType;
  personas: UserPersona[];
  currentUser?: UserPersona;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  currentPeriod,
  defaultArea = 'OPERACIONES',
  personas,
  currentUser,
}) => {
  const isGerencia = currentUser ? (currentUser.department === 'GERENCIA' || currentUser.profileType === 'GERENTE') : false;

  const getInitialArea = (): AreaType => {
    if (!isGerencia && defaultArea === 'GERENCIA') return 'OPERACIONES';
    if (defaultArea === 'TODOS') return 'OPERACIONES';
    return defaultArea;
  };

  const [title, setTitle] = useState('');
  const [area, setArea] = useState<AreaType>(getInitialArea);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState(`${currentPeriod}-15`);
  const [nature, setNature] = useState<TaskNature>('Fija Mensual');
  const [priority, setPriority] = useState<PriorityType>('Media');
  const [category, setCategory] = useState('Administrativo');
  const [notes, setNotes] = useState('');
  const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
  const [executionDate, setExecutionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAreaChange = (newArea: AreaType) => {
    if (!isGerencia && newArea === 'GERENCIA') {
      setValidationError('Restricción de seguridad: Solo el personal de Gerencia puede asignar o crear tareas para el área Gerencia.');
      return;
    }
    setValidationError(null);
    setArea(newArea);
    const found = personas.find(p => p.department === newArea);
    if (found) {
      setAssignee(found.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!isGerencia && area === 'GERENCIA') {
      setValidationError('Acceso restringido: No tienes permisos para registrar tareas en Gerencia.');
      return;
    }

    const targetDueDate = isAlreadyCompleted ? executionDate : dueDate;
    const weeklyDay = nature === 'Fija Semanal' ? getDayOfWeekFromDateString(targetDueDate) : undefined;

    onAddTask({
      title: title.trim(),
      area,
      assignee: assignee || (personas.find(p => p.department === area)?.name || 'Kevin'),
      dueDate: targetDueDate,
      startDate: isAlreadyCompleted ? executionDate : undefined,
      status: isAlreadyCompleted ? 'Completada' : 'No iniciada',
      completedDate: isAlreadyCompleted ? executionDate : undefined,
      nature,
      weeklyDayOfWeek: weeklyDay,
      weeklyRecurrenceStopped: false,
      priority,
      category: isAlreadyCompleted ? `${category} (Realizada)` : category,
      notes: notes.trim(),
      monthPeriod: currentPeriod,
      commentsCount: 0,
      comments: [],
    });

    setTitle('');
    setNotes('');
    setIsAlreadyCompleted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg bg-[#121620] border border-[#273248] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Crear Nueva Tarea en Planilla
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Período: <strong className="text-white">{formatPeriodName(currentPeriod)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202737] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs">
          {validationError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-700/80 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <Shield className="w-4 h-4 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Título / Procedimiento de la Tarea: *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cargar rendición quincenal, auditoría de legajos, balance mensual..."
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Puesto / Área:
              </label>
              <select
                value={area}
                onChange={(e) => handleAreaChange(e.target.value as AreaType)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white focus:outline-none focus:border-[#BE2629] cursor-pointer"
              >
                <option value="OPERACIONES">Operaciones (Puestos & Oficina)</option>
                <option value="SUPERVISIÓN">Supervisión en Terreno / Móvil</option>
                <option value="RRHH">Recursos Humanos (RR.HH.)</option>
                <option value="ADM">Administración (ADM)</option>
                <option value="AUX_ADM">Auxiliar Administrativo</option>
                <option value="SELECCION">Selección de Personal</option>
                <option value="SUB_GERENCIA">Sub Gerencia / Vicepresidencia</option>
                {isGerencia && (
                  <option value="GERENCIA">Gerencia General (Privado)</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Responsable Asignado:
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Nombre del responsable"
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white focus:outline-none focus:border-[#BE2629]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {isAlreadyCompleted ? 'Fecha de Realización:' : 'Fecha Límite:'}
              </label>
              <input
                type="date"
                required
                value={isAlreadyCompleted ? executionDate : dueDate}
                onChange={(e) => isAlreadyCompleted ? setExecutionDate(e.target.value) : setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white focus:outline-none focus:border-[#BE2629] font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Naturaleza:
              </label>
              <select
                value={nature}
                onChange={(e) => {
                  const nextNat = e.target.value as TaskNature;
                  setNature(nextNat);
                  if (nextNat === 'Fija Semanal') {
                    const today = getTodayDateString();
                    if (today.startsWith(currentPeriod)) {
                      setDueDate(today);
                    } else {
                      setDueDate(`${currentPeriod}-01`);
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white focus:outline-none focus:border-[#BE2629] cursor-pointer"
              >
                <option value="Fija Mensual">Fija Mensual</option>
                <option value="Fija Semanal">Fija Semanal (Todas las semanas)</option>
                <option value="Variable">Variable</option>
                <option value="Imprevisto">Imprevisto</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Prioridad:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityType)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white focus:outline-none focus:border-[#BE2629] cursor-pointer"
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Panel informativo cuando se elige Fija Semanal */}
          {nature === 'Fija Semanal' && (
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-700/60 text-purple-200 space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-purple-300 text-xs">
                <Repeat className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Repetición Sistemática Semanal · Todos los {getDayOfWeekLabel(getDayOfWeekFromDateString(isAlreadyCompleted ? executionDate : dueDate))}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                A partir de la fecha seleccionada se anotarán automáticamente todas las semanas restantes del mes (
                <strong>
                  {getWeeklyDatesForMonth(
                    currentPeriod,
                    getDayOfWeekFromDateString(isAlreadyCompleted ? executionDate : dueDate),
                    isAlreadyCompleted ? executionDate : dueDate
                  ).length}{' '}
                  semanas en {formatPeriodName(currentPeriod)}
                </strong>
                ) con alerta semanal de vencimiento. Podrás editarlas, borrarlas, detener su repetición o renovarlas para todas las semanas del mes siguiente.
              </p>
            </div>
          )}

          {/* Toggle: Registrar tarea variable ya realizada para control mensual */}
          <div className="p-3 rounded-xl bg-[#141a26] border border-[#28354c] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-200 block text-xs">
                ¿Esta tarea ya fue realizada? (Registro de tarea ejecutada)
              </span>
              <p className="text-[11px] text-slate-400">
                Permite registrar tareas de naturaleza variable o imprevistos ya cumplidos para llevar el cómputo mensual.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isAlreadyCompleted}
                onChange={(e) => setIsAlreadyCompleted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Notas Operativas / Instrucciones:
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre el objetivo, personal de guardia o instrucciones precisas..."
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#BE2629] resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b2232] hover:bg-[#252f44] text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#BE2629] to-[#d32f32] hover:brightness-110 text-white rounded-xl font-bold shadow transition-colors active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Tarea en la Nube</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
