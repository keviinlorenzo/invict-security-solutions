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
  startDate?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  nature: TaskNature;
  category?: string;
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

const DEFAULT_ASSIGNEE_BY_AREA: Record<AreaType, string> = {
  GERENCIA: 'Yamila González',
  SUB_GERENCIA: 'Laura González',
  OPERACIONES: 'Marianela Sosa',
  RRHH: 'Tamara',
  ADM: 'Giuliana',
  AUX_ADM: 'Kevin',
  SELECCION: 'Mariana',
  'SUPERVISIÓN': 'Bilbao',
  TODOS: 'Marianela Sosa',
};

const KNOWN_OBJECTIVES: { patterns: RegExp[]; label: string }[] = [
  { patterns: [/complejo\s+cepas/i, /\bcepas\b/i], label: 'Complejo Cepas' },
  { patterns: [/torre\s+laureana/i, /\blaureana\b/i], label: 'Edificio Torre Laureana' },
  { patterns: [/barrio\s+el\s+solar/i, /\bel\s+solar\b/i], label: 'Barrio El Solar' },
  { patterns: [/c[aá]mara\s+de\s+la\s+construcci[oó]n/i], label: 'Cámara de la Construcción' },
  { patterns: [/edificio\s+bancario/i, /\bbancario\b/i], label: 'Edificio Bancario' },
  { patterns: [/la\s+consolata/i], label: 'Colegio La Consolata' },
  { patterns: [/obra\s+hco\s+terminal\s+guaymall[eé]n/i, /obra\s+terminal\s+guaymall[eé]n/i], label: 'Obra HCO Terminal Guaymallén' },
  { patterns: [/obra\s+hco\s+san\s+mart[ií]n/i], label: 'Obra HCO San Martín' },
  { patterns: [/obra\s+godoy\s+cruz/i], label: 'Obra Godoy Cruz' },
  { patterns: [/obra\s+paramillos/i, /\bparamillos\b/i], label: 'Obra Paramillos' },
  { patterns: [/hco\s+base/i], label: 'HCO Base' },
  { patterns: [/fuesmen\s+essenza/i], label: 'Fuesmen Essenza' },
  { patterns: [/fuesmen\s+ciudad/i], label: 'Fuesmen Ciudad' },
  { patterns: [/fuesmen\s+maip[uú]/i], label: 'Fuesmen Maipú' },
  { patterns: [/fuesmen\s+san\s+rafael/i], label: 'Fuesmen San Rafael' },
  { patterns: [/udi\s+san\s+mart[ií]n/i, /sede\s+palmira/i], label: 'UDI San Martín - Sede Palmira' },
  { patterns: [/transporte\s+transvial/i, /\btransvial\b/i], label: 'Transporte Transvial' },
  { patterns: [/\bemepa\b/i], label: 'Emepa' },
  { patterns: [/el\s+resguardo/i], label: 'El Resguardo' },
  { patterns: [/\bbuccolini\b/i], label: 'Buccolini' },
  { patterns: [/\bkraft\b/i], label: 'Kraft' },
  { patterns: [/\b[aá]tomos?\b/i], label: 'Supermercados Átomo' },
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
  const initialArea: AreaType = defaultArea && defaultArea !== 'TODOS' ? defaultArea : 'OPERACIONES';
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<ParsedTaskRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [bulkArea, setBulkArea] = useState<AreaType>(initialArea);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getAssigneeForArea = (targetArea: AreaType): string => {
    const matchPersona = allPersonas.find(p => p.department === targetArea);
    if (matchPersona && matchPersona.name) return matchPersona.name;
    return DEFAULT_ASSIGNEE_BY_AREA[targetArea] || 'Marianela Sosa';
  };

  const normalizeText = (val: any): string =>
    String(val ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Helper to parse dates from various formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YY, or Excel serial numbers)
  const parseDateString = (val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number' && val > 20000 && val < 90000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    if (!str) return '';

    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      let year = dmyMatch[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }

    return '';
  };

  // Infer due date from task description when date cell is empty
  const inferDueDateFromTitle = (titleText: string, periodStr?: string): string => {
    const basePeriod = periodStr && /^\d{4}-\d{2}$/.test(periodStr) ? periodStr : getTodayDateString().slice(0, 7);
    const norm = normalizeText(titleText);

    const dayMatch = norm.match(/\b(?:dia|el)\s*(\d{1,2})\s*de\s*cada\s*mes\b/);
    if (dayMatch) {
      const d = Math.min(28, Math.max(1, parseInt(dayMatch[1], 10)));
      return `${basePeriod}-${String(d).padStart(2, '0')}`;
    }
    if (norm.includes('primera semana') || norm.includes('primer semana')) return `${basePeriod}-07`;
    if (norm.includes('segunda semana')) return `${basePeriod}-14`;
    if (norm.includes('tercer semana') || norm.includes('tercera semana')) return `${basePeriod}-21`;
    if (norm.includes('cuarta semana') || norm.includes('fin de mes') || norm.includes('ultimo dia')) return `${basePeriod}-28`;

    return `${basePeriod}-15`;
  };

  // Helper to match area from text
  const matchArea = (val: string): AreaType | '' => {
    if (!val) return '';
    const norm = normalizeText(val).toUpperCase();
    if (norm === 'GERENCIA' || norm.includes('GEREN') || norm.includes('DIRECCION')) return 'GERENCIA';
    if (norm === 'SUB_GERENCIA' || norm.includes('SUB')) return 'SUB_GERENCIA';
    if (norm === 'OPERACIONES' || norm.includes('OPERAC') || norm.includes('LOGIST')) return 'OPERACIONES';
    if (norm === 'RRHH' || norm.includes('RECURSOS') || norm.includes('HUMANOS') || norm.includes('RR.HH')) return 'RRHH';
    if (norm === 'AUX_ADM' || norm.includes('AUXILIAR') || norm.includes('AUX')) return 'AUX_ADM';
    if (norm === 'ADM' || norm.includes('ADMIN')) return 'ADM';
    if (norm === 'SELECCION' || norm.includes('SELECC') || norm.includes('RECLUT')) return 'SELECCION';
    if (norm === 'SUPERVISION' || norm.includes('SUPERV')) return 'SUPERVISIÓN';
    return '';
  };

  // Helper to match priority
  const matchPriority = (val: string, titleText = '', notesText = ''): TaskPriority => {
    const norm = normalizeText(val);
    if (norm.includes('urg') || norm.includes('crit')) return 'Urgente';
    if (norm.includes('alt')) return 'Alta';
    if (norm.includes('baj')) return 'Baja';
    if (norm.includes('norm')) return 'Normal';
    if (norm.includes('med')) return 'Media';

    const combined = normalizeText(`${titleText} ${notesText}`);
    if (
      combined.includes('prohibicion estricta') ||
      combined.includes('robo') ||
      combined.includes('arma') ||
      combined.includes('fuga') ||
      combined.includes('sin luz') ||
      combined.includes('alarma')
    ) {
      return 'Alta';
    }
    if (combined.includes('licencia') || combined.includes('apercibimiento') || combined.includes('licitacion')) {
      return 'Alta';
    }
    return 'Media';
  };

  // Helper to match status
  const matchStatus = (val: string, titleText = ''): TaskStatus => {
    const norm = normalizeText(val);
    if (norm.includes('comple') || norm.includes('finaliz') || norm.includes('termin') || norm.includes('realizad') || norm === 'ok' || norm === 'si' || norm === 'hecho') {
      return 'Completada';
    }
    if (norm.includes('curso') || norm.includes('proceso') || norm.includes('haciendo') || norm.includes('pendiente') || norm.includes('espera')) {
      return 'En curso';
    }
    if (norm.includes('urg') || norm.includes('priorit')) return 'Urgente/Prioritaria';
    if (norm.includes('no iniciad') || norm.includes('sin iniciar')) return 'No iniciada';

    // If status cell was blank, infer from past-tense reporting sentences ("Se entregó...", "Se envió...", "Se conectó...", etc.)
    const normTitle = normalizeText(titleText);
    if (/^se\s+(entreg|conect|envi|solicit|llev|organiz|realiz|complet|cerr|compr|atendi|reun|incorpor)/i.test(normTitle)) {
      return 'Completada';
    }
    return 'No iniciada';
  };

  // Helper to match nature
  const matchNature = (val: string, sectionNature?: TaskNature, titleText = ''): TaskNature => {
    const norm = normalizeText(val);
    if (norm.includes('seman')) return 'Fija Semanal';
    if (norm.includes('imprev') || norm.includes('urgente')) return 'Imprevisto';
    if (norm.includes('variab')) return 'Variable';
    if (norm.includes('mensual') || norm.includes('fija')) return 'Fija Mensual';

    const normTitle = normalizeText(titleText);
    if (normTitle.includes('semanal') || normTitle.includes('semana') || normTitle.includes('fin de semana')) {
      return 'Fija Semanal';
    }
    if (normTitle.includes('cada mes') || normTitle.includes('mensual') || normTitle.includes('fin de mes')) {
      return 'Fija Mensual';
    }
    return sectionNature || 'Fija Mensual';
  };

  // Infer objective location from title/notes when objective column is empty
  const inferObjectiveLocation = (rawObj: string, titleText: string, notesText: string): string => {
    if (rawObj && rawObj.trim()) return rawObj.trim();
    const combined = `${titleText} ${notesText}`;
    for (const item of KNOWN_OBJECTIVES) {
      if (item.patterns.some(rx => rx.test(combined))) {
        return item.label;
      }
    }
    return '';
  };

  // Detect if a single-text-cell row is a Section Divider rather than an individual task
  const isSectionHeaderText = (text: string): { isSection: boolean; cleanCategory: string; nature?: TaskNature } => {
    const clean = text.trim().replace(/:+$/, '').trim();
    const norm = normalizeText(clean);

    if (/^tareas?\s+mensual(es)?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Tareas Mensuales', nature: 'Fija Mensual' };
    }
    if (/^tareas?\s+semanal(es)?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Tareas Semanales', nature: 'Fija Semanal' };
    }
    if (/^tareas?\s+diarias?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Tareas Diarias', nature: 'Fija Mensual' };
    }
    if (/^guardias?\s+pasivas?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Guardias Pasivas', nature: 'Variable' };
    }
    if (/^gestion\s+de\s+licencias/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Gestión de Licencias', nature: 'Variable' };
    }
    if (/^instalaciones?\s+de\s+camaras?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Instalación de Cámara', nature: 'Variable' };
    }
    if (/^capacitaciones?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Capacitaciones', nature: 'Variable' };
    }
    if (/^verificacion\s+de\s+informes/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Verificación de Informes', nature: 'Variable' };
    }
    if (/^reclutamiento$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Reclutamiento', nature: 'Variable' };
    }
    if (/^regimen\s+disciplinario$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Régimen Disciplinario', nature: 'Imprevisto' };
    }
    if (/^acondicionamiento\s+de\s+objetivos?$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Acondicionamiento de Objetivos', nature: 'Variable' };
    }
    if (/^control\s+de\s+gestion/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Control de Gestión y Resolución', nature: 'Fija Mensual' };
    }
    if (/^a\s+los\s+clientes\s+pri(n)?cipalmente$/i.test(norm)) {
      return { isSection: true, cleanCategory: 'Atención a Clientes', nature: 'Fija Mensual' };
    }
    // Also detect generic section headers ending with ":" and <= 40 chars without numbers
    if (text.trim().endsWith(':') && clean.length <= 42 && !/\d/.test(clean)) {
      return { isSection: true, cleanCategory: clean };
    }

    return { isSection: false, cleanCategory: '' };
  };

  // Format task title with section context when the cell only contains a person/client name (e.g. "Diaz Gabriela" under "Gestión de Licencias")
  const enrichTitleWithSection = (rawTitle: string, currentCategory: string): string => {
    const trimmed = rawTitle.trim();
    if (!trimmed) return '';
    if (!currentCategory) return trimmed;

    const normCat = normalizeText(currentCategory);
    const normTitle = normalizeText(trimmed);

    // Do not prefix generic frequency sections
    if (
      normCat === 'tareas mensuales' ||
      normCat === 'tareas semanales' ||
      normCat === 'tareas diarias' ||
      normCat === 'administrativo'
    ) {
      return trimmed;
    }

    // If the title already mentions the category topic, keep it as-is
    if (
      (normCat.includes('licencia') && normTitle.includes('licencia')) ||
      (normCat.includes('camara') && normTitle.includes('camara')) ||
      (normCat.includes('capacitacion') && normTitle.includes('capacitacion')) ||
      (normCat.includes('informe') && normTitle.includes('informe')) ||
      (normCat.includes('reclutamiento') && (normTitle.includes('reclut') || normTitle.includes('busqueda'))) ||
      (normCat.includes('disciplinario') && normTitle.includes('apercibimiento')) ||
      (normCat.includes('guardias pasivas') && normTitle.includes('guardia'))
    ) {
      return trimmed;
    }

    return `${currentCategory}: ${trimmed}`;
  };

  const validateRow = (r: Omit<ParsedTaskRow, 'missingFields'>): string[] => {
    const missing: string[] = [];
    if (!r.title.trim()) missing.push('Título');
    if (!r.area) missing.push('Área / Puesto');
    if (!r.dueDate.trim()) missing.push('Fecha Límite');
    if (!r.assignee.trim()) missing.push('Responsable');
    return missing;
  };

  const handleBulkAreaChange = (newArea: AreaType) => {
    setBulkArea(newArea);
    const newAssignee = getAssigneeForArea(newArea);
    setRows(prev =>
      prev.map(r => {
        const updated = {
          ...r,
          area: newArea,
          assignee: newAssignee,
        };
        return {
          ...updated,
          missingFields: validateRow(updated),
        };
      })
    );
    if (onNotify) {
      const areaLabel = VALID_AREAS.find(a => a.id === newArea)?.label || newArea;
      onNotify(`Se asignó el puesto "${areaLabel}" (${newAssignee}) a las ${rows.length} tareas.`);
    }
  };

  const parseSheetMatrixToTasks = (
    matrix: any[][],
    targetDefaultArea: AreaType,
    sheetIdx: number
  ): ParsedTaskRow[] => {
    if (!matrix || matrix.length === 0) return [];

    // 1. Locate header row within the first 15 rows (even if Column 0 header is blank!)
    let headerRowIndex = -1;
    let bestScore = 0;

    const maxScan = Math.min(matrix.length, 15);
    for (let r = 0; r < maxScan; r++) {
      const row = matrix[r] || [];
      let score = 0;
      for (const cell of row) {
        const norm = normalizeText(cell);
        if (!norm) continue;
        if (
          norm === 'estado' ||
          norm === 'status' ||
          norm === 'situacion' ||
          norm.includes('fecha de inicio') ||
          norm.includes('fecha de entrega') ||
          norm.includes('fecha limite') ||
          norm === 'vencimiento' ||
          norm === 'notas' ||
          norm === 'observaciones' ||
          norm.includes('tarea') ||
          norm.includes('titulo') ||
          norm.includes('procedimiento') ||
          norm.includes('responsable') ||
          norm.includes('puesto') ||
          norm.includes('prioridad')
        ) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = r;
      }
    }

    // Map column indices
    let titleCol = -1;
    let statusCol = -1;
    let startDateCol = -1;
    let dueDateCol = -1;
    let areaCol = -1;
    let assigneeCol = -1;
    let priorityCol = -1;
    let natureCol = -1;
    let objectiveCol = -1;
    const noteCols: number[] = [];

    if (headerRowIndex >= 0 && bestScore >= 1) {
      const headerRow = matrix[headerRowIndex] || [];
      headerRow.forEach((cell, cIdx) => {
        const norm = normalizeText(cell);
        if (!norm) return; // Blank header cell (like Column 0 in user's file)

        if (
          titleCol === -1 &&
          (norm.includes('titulo') ||
            norm.includes('tarea') ||
            norm.includes('procedimiento') ||
            norm.includes('descripcion') ||
            norm.includes('actividad') ||
            norm === 'nombre' ||
            norm === 'asunto' ||
            norm === 'item')
        ) {
          titleCol = cIdx;
        } else if (statusCol === -1 && (norm === 'estado' || norm === 'status' || norm.includes('situacion'))) {
          statusCol = cIdx;
        } else if (
          startDateCol === -1 &&
          (norm.includes('fecha de inicio') || norm.includes('fecha inicio') || norm === 'inicio' || norm === 'desde')
        ) {
          startDateCol = cIdx;
        } else if (
          dueDateCol === -1 &&
          (norm.includes('fecha de entrega') ||
            norm.includes('fecha limite') ||
            norm.includes('vencimiento') ||
            norm.includes('entrega') ||
            norm.includes('plazo') ||
            norm.includes('limite') ||
            norm === 'fecha')
        ) {
          dueDateCol = cIdx;
        } else if (
          areaCol === -1 &&
          (norm.includes('puesto') || norm === 'area' || norm.includes('sector') || norm.includes('departamento') || norm === 'rol')
        ) {
          areaCol = cIdx;
        } else if (
          assigneeCol === -1 &&
          (norm.includes('responsable') || norm.includes('asignado') || norm.includes('encargado') || norm.includes('colaborador') || norm === 'persona')
        ) {
          assigneeCol = cIdx;
        } else if (priorityCol === -1 && (norm.includes('prioridad') || norm.includes('gravedad') || norm.includes('urgencia'))) {
          priorityCol = cIdx;
        } else if (natureCol === -1 && (norm.includes('naturaleza') || norm.includes('frecuencia') || norm === 'tipo')) {
          natureCol = cIdx;
        } else if (
          objectiveCol === -1 &&
          (norm.includes('objetivo') || norm.includes('ubicacion') || norm.includes('cliente') || norm.includes('lugar'))
        ) {
          objectiveCol = cIdx;
        } else if (
          norm.includes('nota') ||
          norm.includes('observacion') ||
          norm.includes('comentario') ||
          norm.includes('detalle') ||
          norm.includes('columna')
        ) {
          noteCols.push(cIdx);
        }
      });

      // Crucial fix: If the title column had a blank header (e.g. `,Estado,Fecha de inicio,Fecha de entrega,Notas`),
      // assign titleCol to the first unassigned column (typically Column 0)!
      const assignedCols = new Set(
        [statusCol, startDateCol, dueDateCol, areaCol, assigneeCol, priorityCol, natureCol, objectiveCol, ...noteCols].filter(
          c => c >= 0
        )
      );
      if (titleCol === -1) {
        const maxCols = Math.max(headerRow.length, ...(matrix.slice(0, 20).map(r => (r ? r.length : 0))));
        for (let c = 0; c < maxCols; c++) {
          if (!assignedCols.has(c)) {
            titleCol = c;
            assignedCols.add(c);
            break;
          }
        }
      }
      // Any remaining unassigned columns are appended to noteCols so 100% of information is captured
      const maxColsAll = Math.max(headerRow.length, ...(matrix.slice(0, 30).map(r => (r ? r.length : 0))));
      for (let c = 0; c < maxColsAll; c++) {
        if (c !== titleCol && !assignedCols.has(c)) {
          noteCols.push(c);
        }
      }
    } else {
      // No explicit header row found: use positional heuristic (Col 0 = Title, detect Status/Date columns from data)
      titleCol = 0;
      statusCol = 1;
      startDateCol = 2;
      dueDateCol = 3;
      noteCols.push(4, 5, 6);
    }

    if (titleCol === -1) titleCol = 0;

    let currentCategory = 'Administrativo';
    let currentSectionNature: TaskNature = 'Fija Mensual';
    const results: ParsedTaskRow[] = [];

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let rIdx = startRow; rIdx < matrix.length; rIdx++) {
      const row = matrix[rIdx];
      if (!row || !Array.isArray(row)) continue;

      // Check if entire row is empty
      const nonEmptyCells = row.filter(c => String(c ?? '').trim() !== '');
      if (nonEmptyCells.length === 0) continue;

      const rawTitleCell = String(row[titleCol] ?? '').trim();
      const otherCellsNonEmpty = row.some((c, i) => i !== titleCol && String(c ?? '').trim() !== '');

      // Check if this row is a Section Divider (e.g., "Tareas Mensual", "Tareas Semanal", "Tareas Diarias", "Gestion de Licencias...", etc.)
      if (rawTitleCell && !otherCellsNonEmpty) {
        const secCheck = isSectionHeaderText(rawTitleCell);
        if (secCheck.isSection) {
          currentCategory = secCheck.cleanCategory;
          if (secCheck.nature) {
            currentSectionNature = secCheck.nature;
          }
          continue;
        }
      }

      // If titleCol is empty on this row, fallback to the first non-empty text cell in the row
      let effectiveRawTitle = rawTitleCell;
      if (!effectiveRawTitle) {
        const fallbackCell = row.find((c, i) => i !== statusCol && i !== startDateCol && i !== dueDateCol && String(c ?? '').trim() !== '');
        if (fallbackCell) effectiveRawTitle = String(fallbackCell).trim();
      }
      if (!effectiveRawTitle) continue;

      const finalTitle = enrichTitleWithSection(effectiveRawTitle, currentCategory);

      const rawStatus = statusCol >= 0 ? String(row[statusCol] ?? '').trim() : '';
      const rawStartVal = startDateCol >= 0 ? row[startDateCol] : '';
      const rawDueVal = dueDateCol >= 0 ? row[dueDateCol] : '';
      const rawAreaVal = areaCol >= 0 ? String(row[areaCol] ?? '').trim() : '';
      const rawAssigneeVal = assigneeCol >= 0 ? String(row[assigneeCol] ?? '').trim() : '';
      const rawPriorityVal = priorityCol >= 0 ? String(row[priorityCol] ?? '').trim() : '';
      const rawNatureVal = natureCol >= 0 ? String(row[natureCol] ?? '').trim() : '';
      const rawObjectiveVal = objectiveCol >= 0 ? String(row[objectiveCol] ?? '').trim() : '';

      const parsedStartDate = parseDateString(rawStartVal);
      const parsedDueDate = parseDateString(rawDueVal);

      // Collect all notes from noteCols + any non-date text written in start/due date columns (e.g. "lo realizo gerencia")
      const collectedNotes: string[] = [];
      if (rawStartVal && !parsedStartDate && String(rawStartVal).trim()) {
        collectedNotes.push(String(rawStartVal).trim());
      }
      if (rawDueVal && !parsedDueDate && String(rawDueVal).trim()) {
        collectedNotes.push(String(rawDueVal).trim());
      }
      for (const nCol of noteCols) {
        const val = row[nCol];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          collectedNotes.push(String(val).trim());
        }
      }
      const finalNotes = collectedNotes.join(' | ');

      // Complete 100% of required fields automatically
      const resolvedArea: AreaType = matchArea(rawAreaVal) || targetDefaultArea || 'OPERACIONES';
      let resolvedAssignee = rawAssigneeVal;
      if (!resolvedAssignee) {
        resolvedAssignee = getAssigneeForArea(resolvedArea);
      }

      const resolvedDueDate =
        parsedDueDate ||
        parsedStartDate ||
        inferDueDateFromTitle(finalTitle, currentPeriod);

      const resolvedStatus = matchStatus(rawStatus, effectiveRawTitle);
      const resolvedNature = matchNature(rawNatureVal, currentSectionNature, effectiveRawTitle);
      const resolvedPriority = matchPriority(rawPriorityVal, finalTitle, finalNotes);
      const resolvedObjective = inferObjectiveLocation(rawObjectiveVal, finalTitle, finalNotes);

      const baseRow: Omit<ParsedTaskRow, 'missingFields'> = {
        tempId: `import-${Date.now()}-${sheetIdx}-${rIdx}-${Math.random().toString(36).substring(2, 6)}`,
        selected: true,
        area: resolvedArea,
        title: finalTitle,
        assignee: resolvedAssignee,
        startDate: parsedStartDate || undefined,
        dueDate: resolvedDueDate,
        priority: resolvedPriority,
        status: resolvedStatus,
        nature: resolvedNature,
        category: currentCategory,
        notes: finalNotes,
        objectiveLocation: resolvedObjective,
      };

      results.push({
        ...baseRow,
        missingFields: validateRow(baseRow),
      });
    }

    return results;
  };

  const handleProcessFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setFile(selectedFile);
    try {
      const buffer = await selectedFile.arrayBuffer();
      let workbook: XLSX.WorkBook;

      if (selectedFile.name.toLowerCase().endsWith('.csv')) {
        let csvText = new TextDecoder('utf-8').decode(buffer);
        if (csvText.includes('\uFFFD')) {
          csvText = new TextDecoder('windows-1252').decode(buffer);
        }
        workbook = XLSX.read(csvText, { type: 'string', raw: false });
      } else {
        workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      }

      let allParsedRows: ParsedTaskRow[] = [];
      workbook.SheetNames.forEach((sheetName, sIdx) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        const sheetRows = parseSheetMatrixToTasks(matrix, bulkArea, sIdx);
        allParsedRows = [...allParsedRows, ...sheetRows];
      });

      if (allParsedRows.length === 0) {
        if (onNotify) onNotify('El archivo no contiene filas de tareas válidas o está vacío.');
        setIsProcessing(false);
        return;
      }

      setRows(allParsedRows);
      const withMissing = allParsedRows.filter(r => r.missingFields.length > 0).length;
      if (onNotify) {
        onNotify(
          `¡Archivo procesado al 100%! Se leyeron ${allParsedRows.length} tareas completas (${withMissing === 0 ? 'todas con 100% de sus datos listos para importar' : `${withMissing} por revisar`}).`
        );
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Error al leer archivo Excel/CSV: ${err.message || 'Formato no soportado'}`);
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
      area: (r.area || bulkArea || 'OPERACIONES') as AreaType,
      title: r.title.trim(),
      assignee: r.assignee.trim() || getAssigneeForArea((r.area || bulkArea || 'OPERACIONES') as AreaType),
      startDate: r.startDate,
      dueDate: r.dueDate,
      priority: r.priority,
      status: r.status,
      nature: r.nature,
      category: r.category || 'Administrativo',
      notes: r.notes || '',
      objectiveLocation: r.objectiveLocation || '',
      monthPeriod: currentPeriod || r.dueDate.substring(0, 7),
      completedDate: r.status === 'Completada' ? (r.dueDate || getTodayDateString()) : undefined,
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
                Lector universal inteligente: detecta automáticamente nombres de tareas (incluso en columnas sin encabezado), estados, fechas de inicio/entrega, objetivos y notas.
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

        {/* Selector de Puesto predeterminado para archivos sin columna de puesto */}
        <div className="px-6 py-2.5 bg-[#121928] border-b border-[#1f293d] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Puesto / Responsable asignado por defecto al archivo:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulkArea}
              onChange={(e) => handleBulkAreaChange(e.target.value as AreaType)}
              className="px-3 py-1.5 rounded-lg bg-[#182236] border border-cyan-500/40 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
            >
              {VALID_AREAS.map(a => (
                <option key={a.id} value={a.id}>
                  {a.label} ({getAssigneeForArea(a.id)})
                </option>
              ))}
            </select>
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
