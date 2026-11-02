import React, { useState, useEffect, useMemo } from 'react';
import { UserPersona } from '../types';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Search,
  Download,
  ShieldAlert,
  Shirt,
  Lock,
  CheckCircle2,
  Info,
  Calendar,
  MapPin,
  User
} from 'lucide-react';
import { broadcastCloudChange, subscribeToCloudSync } from '../utils/cloudSyncService';

export interface PersonalSinDisepItem {
  id: string;
  fullName: string;
  entryDate: string;
  assignedObjective: string;
  observations: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PersonalDebeUniformeItem {
  id: string;
  fullName: string;
  entryDate: string;
  exitDate: string;
  assignedObjective: string;
  observations: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminInformativeSheetsData {
  sinDisep: PersonalSinDisepItem[];
  debeUniforme: PersonalDebeUniformeItem[];
}

export const STORAGE_KEY_ADMIN_SHEETS = 'invict_admin_informative_sheets';

const INITIAL_ADMIN_SHEETS_DATA: AdminInformativeSheetsData = {
  sinDisep: [
    {
      id: 'disep-1',
      fullName: 'Gómez, Lucas Ezequiel',
      entryDate: '2026-10-05',
      assignedObjective: 'Bodegas Luján de Cuyo',
      observations: 'Turno de huella REPRIV asignado - Certificado antecedentes en trámite',
    },
    {
      id: 'disep-2',
      fullName: 'Sosa, Matías Nicolás',
      entryDate: '2026-10-14',
      assignedObjective: 'Parque Industrial Godoy Cruz',
      observations: 'Falta presentar apto psicofísico actualizado para credencial DISEP',
    },
  ],
  debeUniforme: [
    {
      id: 'unif-1',
      fullName: 'Quiroga, Franco Daniel',
      entryDate: '2026-03-10',
      exitDate: '2026-10-22',
      assignedObjective: 'Kraft San Martín',
      observations: 'Adeuda 1 campera táctica de abrigo y 1 pantalón cargo talle 44 (Retenido en liquidación final)',
    },
    {
      id: 'unif-2',
      fullName: 'Lucero, Darío Hernán',
      entryDate: '2026-06-01',
      exitDate: '2026-10-28',
      assignedObjective: 'Logística Cuyo S.A.',
      observations: 'Se notificó por WhatsApp devolución de camisa corporativa y borcegos antes del viernes',
    },
  ],
};

export function getAdminInformativeSheets(): AdminInformativeSheetsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_SHEETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sinDisep: Array.isArray(parsed.sinDisep) ? parsed.sinDisep : INITIAL_ADMIN_SHEETS_DATA.sinDisep,
        debeUniforme: Array.isArray(parsed.debeUniforme) ? parsed.debeUniforme : INITIAL_ADMIN_SHEETS_DATA.debeUniforme,
      };
    }
  } catch (err) {
    console.error('Error reading admin informative sheets:', err);
  }
  return INITIAL_ADMIN_SHEETS_DATA;
}

export function saveAdminInformativeSheets(
  data: AdminInformativeSheetsData,
  actor: UserPersona,
  summary: string
): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_SHEETS, JSON.stringify(data));
    broadcastCloudChange(
      'SHEET_MUTATION',
      summary,
      { name: actor.name, profile: actor.profileType || actor.department, email: actor.email },
      data
    );
  } catch (err) {
    console.error('Error saving admin informative sheets:', err);
  }
}

interface AdminInformativeSheetsViewProps {
  currentPersona: UserPersona;
  onNotify?: (msg: string) => void;
}

export const AdminInformativeSheetsView: React.FC<AdminInformativeSheetsViewProps> = ({
  currentPersona,
  onNotify,
}) => {
  const [activeSheet, setActiveSheet] = useState<'sin_disep' | 'debe_uniforme'>('sin_disep');
  const [sheetsData, setSheetsData] = useState<AdminInformativeSheetsData>(() => getAdminInformativeSheets());
  const [searchTerm, setSearchTerm] = useState('');

  // Únicamente ADMINISTRACIÓN y GERENCIA pueden modificar estas planillas
  const canEdit = Boolean(
    currentPersona &&
      (currentPersona.department === 'ADM' ||
        currentPersona.profileType === 'administración' ||
        currentPersona.department === 'GERENCIA' ||
        currentPersona.profileType === 'GERENTE')
  );

  useEffect(() => {
    const unsub = subscribeToCloudSync((payload) => {
      if (payload.type === 'SHEET_MUTATION' || payload.type === 'FULL_STATE_SYNC' || payload.stateSnapshot) {
        setSheetsData(getAdminInformativeSheets());
      }
    });
    return () => unsub();
  }, []);

  const updateData = (nextData: AdminInformativeSheetsData, actionSummary: string) => {
    if (!canEdit) return;
    setSheetsData(nextData);
    saveAdminInformativeSheets(nextData, currentPersona, actionSummary);
  };

  // --- Handlers: PERSONAL SIN DISEP ---
  const handleAddSinDisep = () => {
    if (!canEdit) return;
    const today = new Date().toISOString().slice(0, 10);
    const newRow: PersonalSinDisepItem = {
      id: `disep-${Date.now()}`,
      fullName: '',
      entryDate: today,
      assignedObjective: '',
      observations: '',
      updatedAt: new Date().toLocaleDateString('es-AR'),
      updatedBy: currentPersona.name,
    };
    const next = { ...sheetsData, sinDisep: [...sheetsData.sinDisep, newRow] };
    updateData(next, `${currentPersona.name} agregó un registro en Personal Sin DISEP`);
    onNotify?.('Fila agregada en Planilla: Personal Sin DISEP');
  };

  const handleChangeSinDisep = (id: string, field: keyof PersonalSinDisepItem, value: string) => {
    if (!canEdit) return;
    const nextList = sheetsData.sinDisep.map((item) =>
      item.id === id
        ? { ...item, [field]: value, updatedAt: new Date().toLocaleDateString('es-AR'), updatedBy: currentPersona.name }
        : item
    );
    updateData({ ...sheetsData, sinDisep: nextList }, `${currentPersona.name} actualizó Personal Sin DISEP`);
  };

  const handleDeleteSinDisep = (id: string) => {
    if (!canEdit) return;
    const target = sheetsData.sinDisep.find((i) => i.id === id);
    const nextList = sheetsData.sinDisep.filter((i) => i.id !== id);
    updateData({ ...sheetsData, sinDisep: nextList }, `${currentPersona.name} eliminó registro de Personal Sin DISEP`);
    onNotify?.(`Registro "${target?.fullName || 'Sin nombre'}" eliminado de Personal Sin DISEP.`);
  };

  // --- Handlers: PERSONAL QUE DEBE UNIFORME ---
  const handleAddDebeUniforme = () => {
    if (!canEdit) return;
    const today = new Date().toISOString().slice(0, 10);
    const newRow: PersonalDebeUniformeItem = {
      id: `unif-${Date.now()}`,
      fullName: '',
      entryDate: today,
      exitDate: today,
      assignedObjective: '',
      observations: '',
      updatedAt: new Date().toLocaleDateString('es-AR'),
      updatedBy: currentPersona.name,
    };
    const next = { ...sheetsData, debeUniforme: [...sheetsData.debeUniforme, newRow] };
    updateData(next, `${currentPersona.name} agregó un registro en Personal que Debe Uniforme`);
    onNotify?.('Fila agregada en Planilla: Personal que Debe Uniforme');
  };

  const handleChangeDebeUniforme = (id: string, field: keyof PersonalDebeUniformeItem, value: string) => {
    if (!canEdit) return;
    const nextList = sheetsData.debeUniforme.map((item) =>
      item.id === id
        ? { ...item, [field]: value, updatedAt: new Date().toLocaleDateString('es-AR'), updatedBy: currentPersona.name }
        : item
    );
    updateData({ ...sheetsData, debeUniforme: nextList }, `${currentPersona.name} actualizó Personal que Debe Uniforme`);
  };

  const handleDeleteDebeUniforme = (id: string) => {
    if (!canEdit) return;
    const target = sheetsData.debeUniforme.find((i) => i.id === id);
    const nextList = sheetsData.debeUniforme.filter((i) => i.id !== id);
    updateData(
      { ...sheetsData, debeUniforme: nextList },
      `${currentPersona.name} eliminó registro de Personal que Debe Uniforme`
    );
    onNotify?.(`Registro "${target?.fullName || 'Sin nombre'}" eliminado de Personal que Debe Uniforme.`);
  };

  // --- Filtered Lists ---
  const q = searchTerm.toLowerCase().trim();
  const filteredSinDisep = useMemo(() => {
    if (!q) return sheetsData.sinDisep;
    return sheetsData.sinDisep.filter(
      (i) =>
        i.fullName.toLowerCase().includes(q) ||
        i.assignedObjective.toLowerCase().includes(q) ||
        i.observations.toLowerCase().includes(q)
    );
  }, [sheetsData.sinDisep, q]);

  const filteredDebeUniforme = useMemo(() => {
    if (!q) return sheetsData.debeUniforme;
    return sheetsData.debeUniforme.filter(
      (i) =>
        i.fullName.toLowerCase().includes(q) ||
        i.assignedObjective.toLowerCase().includes(q) ||
        i.observations.toLowerCase().includes(q)
    );
  }, [sheetsData.debeUniforme, q]);

  // --- CSV Export ---
  const handleExportCSV = () => {
    const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    if (activeSheet === 'sin_disep') {
      const headers = ['#', 'Nombre y Apellido del Vigilador', 'Fecha de Ingreso', 'Objetivo Asignado', 'Observaciones'];
      const rows = filteredSinDisep.map((r, idx) =>
        [String(idx + 1), escape(r.fullName), escape(r.entryDate), escape(r.assignedObjective), escape(r.observations)].join(';')
      );
      const csv = '\uFEFF# INVICT SECURITY SOLUTIONS S.A. - PLANILLA INFORMATIVA: PERSONAL SIN DISEP\n' + headers.join(';') + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Personal_Sin_DISEP_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Planilla de Personal Sin DISEP exportada a CSV.');
    } else {
      const headers = ['#', 'Nombre y Apellido del Vigilador', 'Fecha de Ingreso', 'Fecha de Baja', 'Objetivo Asignado', 'Observaciones'];
      const rows = filteredDebeUniforme.map((r, idx) =>
        [
          String(idx + 1),
          escape(r.fullName),
          escape(r.entryDate),
          escape(r.exitDate),
          escape(r.assignedObjective),
          escape(r.observations),
        ].join(';')
      );
      const csv = '\uFEFF# INVICT SECURITY SOLUTIONS S.A. - PLANILLA INFORMATIVA: PERSONAL QUE DEBE UNIFORME\n' + headers.join(';') + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INVICT_Personal_Debe_Uniforme_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Planilla de Personal que Debe Uniforme exportada a CSV.');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#131926] via-[#172033] to-[#131926] border border-[#2a3650] rounded-3xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              Planillas Informativas de Administración
            </span>
            {canEdit ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Modo Edición Habilitado ({currentPersona.department === 'GERENCIA' ? 'Gerencia' : 'Administración'})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                Modo Lectura (Solo Administración y Gerencia pueden editar)
              </span>
            )}
            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-[#111622] text-slate-300 border border-[#253047] rounded-full flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-400" />
              Independiente de las métricas de tareas
            </span>
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">
            Control Informativo: Personal Sin DISEP & Devolución de Uniformes
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Registro informativo compartido en tiempo real para todos los puestos de la oficina. Estas planillas son de consulta operativa y no alteran los porcentajes ni métricas de cumplimiento de tareas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar Planilla (CSV)</span>
          </button>

          {canEdit && (
            <button
              onClick={activeSheet === 'sin_disep' ? handleAddSinDisep : handleAddDebeUniforme}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BE2629] hover:bg-[#d32f32] text-white font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeSheet === 'sin_disep' ? '+ Agregar Vigilador Sin DISEP' : '+ Agregar Deuda de Uniforme'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Selector & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSheet('sin_disep')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'sin_disep'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>1. PERSONAL SIN DISEP</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {sheetsData.sinDisep.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSheet('debe_uniforme')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
              activeSheet === 'debe_uniforme'
                ? 'bg-amber-600 text-black border-amber-500 shadow-lg'
                : 'bg-[#121620] text-slate-300 border-[#22293b] hover:bg-[#192030]'
            }`}
          >
            <Shirt className="w-4 h-4" />
            <span>2. PERSONAL QUE DEBE UNIFORME</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30 text-white">
              {sheetsData.debeUniforme.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-[#121620] border border-[#22293b] rounded-xl min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por vigilador, objetivo u observación..."
            className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* SHEET 1: PERSONAL SIN DISEP */}
      {activeSheet === 'sin_disep' && (
        <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
          <div className="flex items-center justify-between border-b border-[#1f2637] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <span>Planilla 1: Personal Sin DISEP</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detalle de vigiladores pendientes de habilitación o credencial DISEP, fecha de alta, objetivo asignado y estado del trámite.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredSinDisep.length} registro(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nombre y Apellido del Vigilador</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha de Ingreso</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>Objetivo Asignado</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[280px]">Observaciones</th>
                  {canEdit && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredSinDisep.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.fullName}
                        onChange={(e) => handleChangeSinDisep(item.id, 'fullName', e.target.value)}
                        placeholder="Apellido y Nombre del vigilador..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEdit}
                        value={item.entryDate}
                        onChange={(e) => handleChangeSinDisep(item.id, 'entryDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.assignedObjective}
                        onChange={(e) => handleChangeSinDisep(item.id, 'assignedObjective', e.target.value)}
                        placeholder="Objetivo o puesto asignado..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-semibold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.observations}
                        onChange={(e) => handleChangeSinDisep(item.id, 'observations', e.target.value)}
                        placeholder="Estado del trámite, turno, documentación pendiente..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none transition-colors"
                      />
                    </td>
                    {canEdit && (
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteSinDisep(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredSinDisep.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400 text-xs">
                      No hay registros cargados en Personal Sin DISEP.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHEET 2: PERSONAL QUE DEBE UNIFORME */}
      {activeSheet === 'debe_uniforme' && (
        <div className="p-4 rounded-2xl bg-[#121620] border border-[#22293b] shadow space-y-3">
          <div className="flex items-center justify-between border-b border-[#1f2637] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shirt className="w-4 h-4 text-amber-400" />
                <span>Planilla 2: Personal que Debe Uniforme</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Control de prendas, equipamiento e indumentaria pendiente de devolución por parte del personal dado de baja o activo.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredDebeUniforme.length} registro(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#161b26] border-b border-[#252c3e] text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nombre y Apellido del Vigilador</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha de Ingreso</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-red-400" />
                      <span>Fecha de Baja</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>Objetivo Asignado</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[260px]">Observaciones (Prendas Adeudadas)</th>
                  {canEdit && <th className="py-2.5 px-2 text-center w-12">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {filteredDebeUniforme.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.fullName}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'fullName', e.target.value)}
                        placeholder="Apellido y Nombre del vigilador..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEdit}
                        value={item.entryDate}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'entryDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        disabled={!canEdit}
                        value={item.exitDate}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'exitDate', e.target.value)}
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-red-300 font-mono focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.assignedObjective}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'assignedObjective', e.target.value)}
                        placeholder="Último objetivo asignado..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-blue-200 font-semibold focus:outline-none transition-colors"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={item.observations}
                        onChange={(e) => handleChangeDebeUniforme(item.id, 'observations', e.target.value)}
                        placeholder="Detalle de prendas adeudadas, estado de devolución..."
                        className="w-full bg-[#161c28] disabled:bg-transparent border border-[#263147] disabled:border-transparent focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none transition-colors"
                      />
                    </td>
                    {canEdit && (
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteDebeUniforme(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredDebeUniforme.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-slate-400 text-xs">
                      No hay registros cargados en Personal que Debe Uniforme.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
