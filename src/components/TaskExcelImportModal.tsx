import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Plus,
  Download,
  X,
  Sparkles,
  HelpCircle,
  Calendar,
  User,
  Shield,
  Layers,
} from 'lucide-react';
import { AreaType, Task, TaskPriority, TaskStatus, TaskNature, Persona } from '../types';
import { getTodayDateString } from '../utils/dateUtils';

interface ParsedTaskRow {
  tempId: string;
  selected: boolean;
  area: AreaType | '';
  title: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  nature: TaskNature;
  notes?: string;
  objectiveLocation?: string;
  // Validation flags
  missingFields: string[];
}

interface TaskExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTasks: (tasks: Omit<Task, 'id'>[]) => void;
  defaultArea?: AreaType;
  currentPeriod?: string;
  allPersonas?: Persona[];
  onNotify?: (msg: string) => void;
}

const VALID_AREAS: { id: AreaType; label: string }[] = [
  { id: 'GERENCIA', label: 'Gerencia General' },
  { id: 'SUB_GERENCIA', label: 'Sub Gerencia' },
  { id: 'OPERACIONES', label: 'Operaciones & Logística' },
  { id: 'RRHH', label: 'Recursos Humanos' },
  { id: 'ADM', label: 'Administración' },
  { id: 'AUX_ADM', label: 'Auxiliar Administrativo' },
  { id: 'SELECCION', label: 'Selección de Personal' },
  { id: 'SUPERVISIÓN', label: 'Supervisión Operativa' },
];

const VALID_PRIORITIES: TaskPriority[] = ['Baja', 'Normal', 'Media', 'Alta', 'Urgente'];
const VALID_STATUSES: TaskStatus[] = ['No iniciada', 'En curso', 'Completada', 'Urgente/Prioritaria'];
const VALID_NATURES: TaskNature[] = ['Fija Mensual', 'Fija Semanal', 'Variable', 'Imprevisto'];

export const TaskExcelImportModal: React.FC<TaskExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportTasks,
  defaultArea = 'OPERACIONES',
  currentPeriod,
  allPersonas = [],
  onNotify,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<ParsedTaskRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to parse dates from various formats (YYYY-MM-DD, DD/MM/YYYY, or Excel date numbers)
  const parseDateString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel epoch starts at 1899-12-30
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const parts = str.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const parts = str.split('-');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    // Try native Date parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  };

  // Helper to match area from text
  const matchArea = (val: string): AreaType | '' => {
    if (!val) return '';
    const norm = val.toUpperCase().trim();
    if (norm === 'GERENCIA' || norm.includes('GEREN')) return 'GERENCIA';
    if (norm === 'SUB_GERENCIA' || norm.includes('SUB')) return 'SUB_GERENCIA';
    if (norm === 'OPERACIONES' || norm.includes('OPERAC') || norm.includes('LOGIST')) return 'OPERACIONES';
    if (norm === 'RRHH' || norm.includes('RECURSOS') || norm.includes('HUMANOS')) return 'RRHH';
    if (norm === 'AUX_ADM' || norm.includes('AUXILIAR') || norm.includes('AUX')) return 'AUX_ADM';
    if (norm === 'ADM' || norm.includes('ADMIN')) return 'ADM';
    if (norm === 'SELECCION' || norm.includes('SELECC') || norm.includes('RECLUT')) return 'SELECCION';
    if (norm === 'SUPERVISIÓN' || norm === 'SUPERVISION' || norm.includes('SUPERV')) return 'SUPERVISIÓN';
    return '';
  };

  // Helper to match priority
  const matchPriority = (val: string): TaskPriority => {
    const norm = (val || '').toLowerCase().trim();
    if (norm.includes('urg')) return 'Urgente';
    if (norm.includes('alt')) return 'Alta';
    if (norm.includes('baj')) return 'Baja';
    if (norm.includes('norm')) return 'Normal';
    return 'Media';
  };

  // Helper to match status
  const matchStatus = (val: string): TaskStatus => {
    const norm = (val || '').toLowerCase().trim();
    if (norm.includes('comple') || norm.includes('finaliz') || norm.includes('termin')) return 'Completada';
    if (norm.includes('curso') || norm.includes('proceso') || norm.includes('haciendo')) return 'En curso';
    if (norm.includes('urg') || norm.includes('priorit')) return 'Urgente/Prioritaria';
    return 'No iniciada';
  };

  // Helper to match nature
  const matchNature = (val: string): TaskNature => {
    const norm = (val || '').toLowerCase().trim();
    if (norm.includes('seman')) return 'Fija Semanal';
    if (norm.includes('imprev') || norm.includes('urgente')) return 'Imprevisto';
    if (norm.includes('variab')) return 'Variable';
    return 'Fija Mensual';
  };

  const validateRow = (r: Omit<ParsedTaskRow, 'missingFields'>): string[] => {
    const missing: string[] = [];
    if (!r.title.trim()) missing.push('Título');
    if (!r.area) missing.push('Área / Puesto');
    if (!r.dueDate.trim()) missing.push('Fecha Límite');
    if (!r.assignee.trim()) missing.push('Responsable');
    return missing;
  };

  const handleProcessFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setFile(selectedFile);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas o está vacío.');
        setIsProcessing(false);
        return;
      }

      const parsed: ParsedTaskRow[] = rawRows.map((row, idx) => {
        const getFieldVal = (...keys: string[]): any => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.toLowerCase().trim() === k.toLowerCase().trim()) {
                return row[rowKey];
              }
            }
          }
          // Also try partial includes
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.toLowerCase().trim().includes(k.toLowerCase().trim())) {
                return row[rowKey];
              }
            }
          }
          return '';
        };

        const rawTitle = getFieldVal('titulo', 'título', 'tarea', 'procedimiento', 'descripcion', 'descripción', 'nombre', 'task', 'name') || '';
        const rawArea = getFieldVal('puesto', 'area', 'área', 'sector', 'departamento', 'sección', 'rol') || '';
        const rawAssignee = getFieldVal('responsable', 'asignado', 'persona', 'encargado', 'colaborador', 'asignada a', 'assignee') || '';
        const rawDueDate = getFieldVal('fecha limite', 'fecha límite', 'fecha', 'vencimiento', 'plazo', 'limite', 'límite', 'due date', 'deadline') || '';
        const rawPriority = getFieldVal('prioridad', 'priority', 'gravedad') || '';
        const rawStatus = getFieldVal('estado', 'status', 'situacion', 'situación') || '';
        const rawNature = getFieldVal('naturaleza', 'tipo', 'frecuencia', 'repetición', 'nature') || '';
        const rawNotes = getFieldVal('observaciones', 'notas', 'nota', 'comentario', 'detalle', 'notes') || '';
        const rawLocation = getFieldVal('objetivo', 'ubicacion', 'ubicación', 'destino', 'cliente', 'lugar') || '';

        const area = matchArea(String(rawArea)) || (defaultArea !== 'TODOS' ? defaultArea : '');
        let assignee = String(rawAssignee).trim();
        if (!assignee && area) {
          const matchPersona = allPersonas.find(p => p.department === area);
          if (matchPersona) assignee = matchPersona.name;
        }

        const dueDate = parseDateString(rawDueDate) || (currentPeriod ? `${currentPeriod}-15` : getTodayDateString());
        const title = String(rawTitle).trim();

        const baseRow = {
          tempId: `import-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          selected: true,
          area,
          title,
          assignee,
          dueDate,
          priority: matchPriority(String(rawPriority)),
          status: matchStatus(String(rawStatus)),
          nature: matchNature(String(rawNature)),
          notes: String(rawNotes).trim(),
          objectiveLocation: String(rawLocation).trim(),
        };

        return {
          ...baseRow,
          missingFields: validateRow(baseRow),
        };
      });

      setRows(parsed);
      const withMissing = parsed.filter(r => r.missingFields.length > 0).length;
      if (onNotify) {
        onNotify(
          `¡Archivo cargado! Se detectaron ${parsed.length} tareas. (${withMissing > 0 ? `${withMissing} requieren completar campos faltantes` : 'Todas listas para importar'})`
        );
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer archivo Excel: ${err.message || 'Formato no soportado'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRowChange = (tempId: string, field: keyof ParsedTaskRow, value: any) => {
    setRows(prev =>
      prev.map(r => {
        if (r.tempId !== tempId) return r;
        const updated = { ...r, [field]: value };
        // Auto-assign default officer if area changes and assignee is empty
        if (field === 'area' && value && !updated.assignee) {
          const match = allPersonas.find(p => p.department === value);
          if (match) updated.assignee = match.name;
        }
        updated.missingFields = validateRow(updated);
        return updated;
      })
    );
  };

  const handleRemoveRow = (tempId: string) => {
    setRows(prev => prev.filter(r => r.tempId !== tempId));
  };

  const handleAddNewRow = () => {
    const today = getTodayDateString();
    const newR: ParsedTaskRow = {
      tempId: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      selected: true,
      area: defaultArea !== 'TODOS' ? defaultArea : 'OPERACIONES',
      title: '',
      assignee: allPersonas.find(p => p.department === defaultArea)?.name || 'Marianela Sosa',
      dueDate: today,
      priority: 'Media',
      status: 'No iniciada',
      nature: 'Fija Mensual',
      notes: '',
      objectiveLocation: '',
      missingFields: ['Título'],
    };
    setRows(prev => [newR, ...prev]);
  };

  const handleApplyDefaultsToIncomplete = () => {
    const today = getTodayDateString();
    setRows(prev =>
      prev.map(r => {
        if (r.missingFields.length === 0) return r;
        const fallbackArea = r.area || (defaultArea !== 'TODOS' ? defaultArea : 'OPERACIONES');
        const fallbackAssignee = r.assignee || allPersonas.find(p => p.department === fallbackArea)?.name || 'Marianela Sosa';
        const fallbackDueDate = r.dueDate || today;
        const fallbackTitle = r.title.trim() || 'Tarea Importada Sin Título';

        const updated = {
          ...r,
          area: fallbackArea,
          assignee: fallbackAssignee,
          dueDate: fallbackDueDate,
          title: fallbackTitle,
        };
        updated.missingFields = validateRow(updated);
        return updated;
      })
    );
    if (onNotify) onNotify('¡Valores por defecto aplicados a las filas incompletas!');
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Puesto / Área': 'OPERACIONES',
        'Título de la Tarea / Procedimiento': 'Control de Libro de Novedades y Rondas',
        'Responsable': 'Marianela Sosa',
        'Fecha Límite (AAAA-MM-DD o DD/MM/AAAA)': '2026-11-20',
        'Prioridad (Baja / Normal / Media / Alta / Urgente)': 'Alta',
        'Estado (No iniciada / En curso / Completada)': 'No iniciada',
        'Naturaleza (Fija Mensual / Fija Semanal / Imprevisto)': 'Fija Mensual',
        'Objetivo / Ubicación': 'Kraft San Martín',
        'Observaciones': 'Verificar firmas y sellos reglamentarios',
      },
      {
        'Puesto / Área': 'RRHH',
        'Título de la Tarea / Procedimiento': 'Cálculo de Sueldos y Liquidación Mensual',
        'Responsable': 'Yamila',
        'Fecha Límite (AAAA-MM-DD o DD/MM/AAAA)': '2026-11-25',
        'Prioridad (Baja / Normal / Media / Alta / Urgente)': 'Urgente',
        'Estado (No iniciada / En curso / Completada)': 'En curso',
        'Naturaleza (Fija Mensual / Fija Semanal / Imprevisto)': 'Fija Mensual',
        'Objetivo / Ubicación': 'Base Central',
        'Observaciones': 'Contemplar horas extras y adicionales nocturnos',
      },
      {
        'Puesto / Área': 'ADM',
        'Título de la Tarea / Procedimiento': 'Emisión de Facturación a Clientes y Cobranzas',
        'Responsable': 'Marianela',
        'Fecha Límite (AAAA-MM-DD o DD/MM/AAAA)': '2026-11-18',
        'Prioridad (Baja / Normal / Media / Alta / Urgente)': 'Alta',
        'Estado (No iniciada / En curso / Completada)': 'No iniciada',
        'Naturaleza (Fija Mensual / Fija Semanal / Imprevisto)': 'Fija Mensual',
        'Objetivo / Ubicación': 'Administración Central',
        'Observaciones': 'Enviar comprobantes AFIP antes del vencimiento',
      },
      {
        'Puesto / Área': 'SUPERVISIÓN',
        'Título de la Tarea / Procedimiento': 'Inspección de Puestos Operativos en Objetivo',
        'Responsable': 'Supervisores',
        'Fecha Límite (AAAA-MM-DD o DD/MM/AAAA)': '2026-11-15',
        'Prioridad (Baja / Normal / Media / Alta / Urgente)': 'Media',
        'Estado (No iniciada / En curso / Completada)': 'No iniciada',
        'Naturaleza (Fija Mensual / Fija Semanal / Imprevisto)': 'Fija Semanal',
        'Objetivo / Ubicación': 'Fuesmen Maipú',
        'Observaciones': 'Revisar indumentaria y linternas reglamentarias',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Tareas Invict');
    XLSX.writeFile(workbook, 'Plantilla_Importar_Tareas_Invict.xlsx');
    if (onNotify) onNotify('¡Plantilla Excel descargada! Complétala y cárgala directamente aquí.');
  };

  const handleConfirmImport = () => {
    const selectedRows = rows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      if (onNotify) onNotify('No has seleccionado ninguna tarea para importar.');
      return;
    }

    // Check if any selected row is still missing required fields
    const invalidRows = selectedRows.filter(r => r.missingFields.length > 0);
    if (invalidRows.length > 0) {
      if (onNotify) {
        onNotify(
          `Hay ${invalidRows.length} tareas seleccionadas con campos incompletos (${invalidRows[0].missingFields.join(', ')}). Por favor complétalos antes de importar o usa "Completar por defecto".`
        );
      }
      setFilterMissingOnly(true);
      return;
    }

    const tasksToImport: Omit<Task, 'id'>[] = selectedRows.map(r => ({
      area: (r.area || defaultArea || 'OPERACIONES') as AreaType,
      title: r.title.trim(),
      assignee: r.assignee.trim() || 'Marianela Sosa',
      dueDate: r.dueDate,
      priority: r.priority,
      status: r.status,
      nature: r.nature,
      notes: r.notes || '',
      objectiveLocation: r.objectiveLocation || '',
      monthPeriod: currentPeriod || r.dueDate.substring(0, 7),
      completedDate: r.status === 'Completada' ? getTodayDateString() : undefined,
    }));

    onImportTasks(tasksToImport);
    if (onNotify) {
      onNotify(`¡${tasksToImport.length} tareas importadas y anotadas exitosamente en el sistema!`);
    }
    onClose();
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const missingCount = rows.filter(r => r.missingFields.length > 0).length;

  const displayedRows = rows.filter(r => {
    if (filterMissingOnly && r.missingFields.length === 0) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchT = r.title.toLowerCase().includes(q);
      const matchA = r.assignee.toLowerCase().includes(q);
      const matchAreaName = r.area.toLowerCase().includes(q);
      const matchLoc = (r.objectiveLocation || '').toLowerCase().includes(q);
      return matchT || matchA || matchAreaName || matchLoc;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-fadeIn">
      <div className="bg-[#0f141f] border border-[#232d42] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1f283d] flex items-center justify-between bg-gradient-to-r from-[#141b2b] via-[#101726] to-[#141b2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Importador Masivo de Tareas desde Excel / CSV
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                  .xlsx · .xls · .csv
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Carga tareas históricas o múltiples de cualquier sector. El sistema interpreta cada fila por separado y te permite revisar o completar campos antes de confirmar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#192233] hover:bg-[#222e44] text-xs font-medium text-slate-200 border border-[#2a3854] transition shadow-sm"
              title="Descargar plantilla Excel de ejemplo"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Descargar Plantilla Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Upload Zone (if no rows yet or to replace) */}
        {rows.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) handleProcessFile(droppedFile);
              }}
              className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition cursor-pointer ${
                dragOver
                  ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                  : 'border-[#26354d] bg-[#121927]/60 hover:border-cyan-500/50 hover:bg-[#121927]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProcessFile(f);
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Arrastra tu archivo Excel aquí o haz clic para seleccionarlo
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                Compatible con libros Excel (.xlsx, .xls) y valores separados por comas (.csv). Detecta automáticamente columnas de Tarea, Puesto, Responsable, Fecha Límite, Prioridad y Estado.
              </p>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-md shadow-cyan-950/50">
                  Seleccionar Archivo
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTemplate();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#1a2336] hover:bg-[#25324d] text-xs font-medium text-slate-300 border border-[#2b3a56] transition"
                >
                  Descargar Plantilla Oficial
                </button>
              </div>
            </div>

            <div className="mt-6 max-w-2xl text-left bg-[#131a29]/80 border border-[#202b3f] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>¿Cómo funciona el importador inteligente?</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Lee múltiples tareas del archivo e interpreta cada renglón como una tarea independiente.</li>
                <li>Si falta algún dato o no se reconoce el sector o la fecha, podrás completarlo manualmente en pantalla.</li>
                <li>Puedes asignar masivamente valores por defecto con un solo clic antes de ingresar las tareas.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* Review and Edit Table Mode */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-[#1f283d] bg-[#111724] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium">
                  Total detectadas: <strong className="text-white">{rows.length}</strong>
                </span>
                <span className="text-xs text-cyan-400 font-medium">
                  Seleccionadas: <strong>{selectedCount}</strong>
                </span>
                {missingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700/80 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{missingCount} requieren completar campos</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/80">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Todas las filas listas</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Buscar en tareas importadas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[#161d2d] border border-[#27354d] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48"
                />

                {missingCount > 0 && (
                  <>
                    <button
                      onClick={() => setFilterMissingOnly(prev => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        filterMissingOnly
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#1b2538] hover:bg-[#233047] text-amber-300 border-amber-700/60'
                      }`}
                    >
                      {filterMissingOnly ? 'Ver todas' : 'Filtrar incompletas'}
                    </button>
                    <button
                      onClick={handleApplyDefaultsToIncomplete}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1e283d] hover:bg-[#283754] text-cyan-300 border border-cyan-800/60 transition"
                      title="Asignar valores por defecto a los campos vacíos"
                    >
                      Completar por defecto
                    </button>
                  </>
                )}

                <button
                  onClick={handleAddNewRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1b2538] hover:bg-[#24334d] text-slate-200 border border-[#2c3d5a] transition"
                >
                  <Plus className="w-3 h-3 text-cyan-400" />
                  <span>Agregar fila</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1a2336] hover:bg-[#24324d] text-slate-300 border border-[#2b3a56] transition"
                  title="Cargar otro archivo Excel"
                >
                  Cambiar archivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleProcessFile(f);
                  }}
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto p-4">
              <div className="border border-[#1f283d] rounded-xl overflow-hidden shadow-inner bg-[#0c101a]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#141b2a] text-slate-300 uppercase tracking-wider text-[11px] font-semibold sticky top-0 z-10 border-b border-[#202a3f]">
                    <tr>
                      <th className="p-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every(r => r.selected)}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded bg-[#182030] border-slate-600 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-2.5 w-12 text-center">N°</th>
                      <th className="p-2.5 min-w-[130px]">Puesto / Área *</th>
                      <th className="p-2.5 min-w-[240px]">Tarea & Procedimiento *</th>
                      <th className="p-2.5 min-w-[140px]">Responsable *</th>
                      <th className="p-2.5 min-w-[120px]">Fecha Límite *</th>
                      <th className="p-2.5 min-w-[100px]">Prioridad</th>
                      <th className="p-2.5 min-w-[110px]">Estado</th>
                      <th className="p-2.5 min-w-[120px]">Naturaleza</th>
                      <th className="p-2.5 min-w-[140px]">Objetivo</th>
                      <th className="p-2.5 min-w-[160px]">Observaciones</th>
                      <th className="p-2.5 w-12 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#172033] text-slate-200">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-slate-400">
                          No se encontraron tareas con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((r, idx) => {
                        const hasErrors = r.missingFields.length > 0;
                        return (
                          <tr
                            key={r.tempId}
                            className={`transition hover:bg-[#131b2b] ${
                              !r.selected ? 'opacity-40 bg-[#0a0e17]' : hasErrors ? 'bg-amber-950/15' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={r.selected}
                                onChange={(e) => handleRowChange(r.tempId, 'selected', e.target.checked)}
                                className="rounded bg-[#182030] border-slate-600 text-cyan-500 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Row Index & Error indicator */}
                            <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">
                              <div className="flex items-center justify-center gap-1">
                                <span>{idx + 1}</span>
                                {hasErrors && (
                                  <span
                                    title={`Faltan campos: ${r.missingFields.join(', ')}`}
                                    className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block"
                                  />
                                )}
                              </div>
                            </td>

                            {/* Area */}
                            <td className="p-2">
                              <select
                                value={r.area}
                                onChange={(e) => handleRowChange(r.tempId, 'area', e.target.value as AreaType)}
                                className={`w-full px-2 py-1.5 rounded bg-[#161e30] border text-xs text-white focus:outline-none ${
                                  !r.area
                                    ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-950/30'
                                    : 'border-[#26344d]'
                                }`}
                              >
                                <option value="">-- Seleccionar --</option>
                                {VALID_AREAS.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Title */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={r.title}
                                placeholder="Escribe el nombre de la tarea *"
                                onChange={(e) => handleRowChange(r.tempId, 'title', e.target.value)}
                                className={`w-full px-2.5 py-1.5 rounded bg-[#161e30] border text-xs text-white focus:outline-none ${
                                  !r.title.trim()
                                    ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-950/30 placeholder-amber-400/70 font-semibold'
                                    : 'border-[#26344d]'
                                }`}
                              />
                            </td>

                            {/* Assignee */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={r.assignee}
                                placeholder="Responsable *"
                                onChange={(e) => handleRowChange(r.tempId, 'assignee', e.target.value)}
                                className={`w-full px-2 py-1.5 rounded bg-[#161e30] border text-xs text-white focus:outline-none ${
                                  !r.assignee.trim()
                                    ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-950/30'
                                    : 'border-[#26344d]'
                                }`}
                              />
                            </td>

                            {/* Due Date */}
                            <td className="p-2">
                              <input
                                type="date"
                                value={r.dueDate}
                                onChange={(e) => handleRowChange(r.tempId, 'dueDate', e.target.value)}
                                className={`w-full px-2 py-1.5 rounded bg-[#161e30] border text-xs text-white focus:outline-none ${
                                  !r.dueDate
                                    ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-950/30'
                                    : 'border-[#26344d]'
                                }`}
                              />
                            </td>

                            {/* Priority */}
                            <td className="p-2">
                              <select
                                value={r.priority}
                                onChange={(e) => handleRowChange(r.tempId, 'priority', e.target.value as TaskPriority)}
                                className="w-full px-2 py-1.5 rounded bg-[#161e30] border border-[#26344d] text-xs text-white focus:outline-none"
                              >
                                {VALID_PRIORITIES.map(p => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Status */}
                            <td className="p-2">
                              <select
                                value={r.status}
                                onChange={(e) => handleRowChange(r.tempId, 'status', e.target.value as TaskStatus)}
                                className="w-full px-2 py-1.5 rounded bg-[#161e30] border border-[#26344d] text-xs text-white focus:outline-none"
                              >
                                {VALID_STATUSES.map(s => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Nature */}
                            <td className="p-2">
                              <select
                                value={r.nature}
                                onChange={(e) => handleRowChange(r.tempId, 'nature', e.target.value as TaskNature)}
                                className="w-full px-2 py-1.5 rounded bg-[#161e30] border border-[#26344d] text-xs text-white focus:outline-none"
                              >
                                {VALID_NATURES.map(n => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Objective Location */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={r.objectiveLocation || ''}
                                placeholder="Ej: Kraft San Martín"
                                onChange={(e) => handleRowChange(r.tempId, 'objectiveLocation', e.target.value)}
                                className="w-full px-2 py-1.5 rounded bg-[#161e30] border border-[#26344d] text-xs text-white focus:outline-none"
                              />
                            </td>

                            {/* Notes */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={r.notes || ''}
                                placeholder="Notas opcionales..."
                                onChange={(e) => handleRowChange(r.tempId, 'notes', e.target.value)}
                                className="w-full px-2 py-1.5 rounded bg-[#161e30] border border-[#26344d] text-xs text-white focus:outline-none"
                              />
                            </td>

                            {/* Action: Delete Row */}
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveRow(r.tempId)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                title="Eliminar fila de la importación"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions Footer */}
            <div className="px-6 py-4 border-t border-[#1f283d] bg-gradient-to-r from-[#121927] via-[#101624] to-[#121927] flex items-center justify-between gap-4">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>
                  Los campos resaltados con borde amarillo deben ser completados manualmente antes de confirmar la importación.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-[#28354c] transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                    selectedCount === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Importar {selectedCount} Tareas al Software</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
