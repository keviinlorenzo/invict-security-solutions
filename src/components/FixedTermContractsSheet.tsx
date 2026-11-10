import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Plus, Trash2, Download, FileText, Search, AlertTriangle, CalendarClock, Lock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { UserPersona } from '../types';
import { subscribeToCloudSync } from '../utils/cloudSyncService';
import { getTodayDateString } from '../utils/dateUtils';
import {
  FixedTermContractItem,
  FIXED_TERM_CONTRACTS_EVENT,
  getFixedTermContracts,
  saveFixedTermContracts,
  canEditFixedTermContracts,
  getContractDaysRemaining,
  describeContractDays,
  formatContractDate,
  CONTRACT_ALERT_DAYS,
} from '../data/fixedTermContractsData';

type SortField = 'order' | 'fullName' | 'assignedObjective' | 'startDate' | 'endDate';
type SortDirection = 'asc' | 'desc';

interface Props {
  currentPersona: UserPersona;
  onNotify?: (msg: string) => void;
  searchTerm: string;
}

export const FixedTermContractsSheet: React.FC<Props> = ({ currentPersona, onNotify, searchTerm }) => {
  const [contracts, setContracts] = useState<FixedTermContractItem[]>(() => getFixedTermContracts());
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const canEdit = canEditFixedTermContracts(currentPersona);

  useEffect(() => {
    const refresh = () => setContracts(getFixedTermContracts());
    window.addEventListener(FIXED_TERM_CONTRACTS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    const unsub = subscribeToCloudSync((payload) => {
      if (payload.type === 'SHEET_MUTATION' || payload.type === 'FULL_STATE_SYNC' || payload.stateSnapshot) {
        refresh();
      }
    });
    return () => {
      window.removeEventListener(FIXED_TERM_CONTRACTS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      unsub();
    };
  }, []);

  const persist = (next: FixedTermContractItem[], summary: string) => {
    setContracts(next);
    saveFixedTermContracts(next, currentPersona, summary);
  };

  const stamp = () => ({ updatedAt: new Date().toLocaleDateString('es-AR'), updatedBy: currentPersona.name });

  const handleAdd = () => {
    if (!canEdit) return;
    const today = getTodayDateString();
    const row: FixedTermContractItem = {
      id: `ctr-${Date.now()}`,
      fullName: '',
      assignedObjective: '',
      startDate: today,
      endDate: '',
      observations: '',
      ...stamp(),
    };
    persist([...contracts, row], `${currentPersona.name} agregó un contrato a plazo fijo`);
    onNotify?.('Fila agregada en Planilla: Contratos a Plazo Fijo');
  };

  const handleChange = (id: string, field: keyof FixedTermContractItem, value: string) => {
    if (!canEdit) return;
    const next = contracts.map((c) => (c.id === id ? { ...c, [field]: value, ...stamp() } : c));
    persist(next, `${currentPersona.name} actualizó Contratos a Plazo Fijo`);
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    persist(
      contracts.filter((c) => c.id !== id),
      `${currentPersona.name} eliminó un contrato a plazo fijo`
    );
    onNotify?.('Contrato eliminado de la planilla.');
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const q = searchTerm.toLowerCase().trim();
  const filtered = useMemo(() => {
    const list = contracts.map((c, idx) => ({ ...c, order: idx + 1 }));
    let result = list;
    if (q) {
      result = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.assignedObjective.toLowerCase().includes(q) ||
          (c.observations || '').toLowerCase().includes(q)
      );
    }

    if (sortField === 'order') {
      return sortDirection === 'asc'
        ? [...result].sort((a, b) => a.order - b.order)
        : [...result].sort((a, b) => b.order - a.order);
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'fullName') {
        cmp = (a.fullName || '').localeCompare(b.fullName || '', 'es', { sensitivity: 'base' });
      } else if (sortField === 'assignedObjective') {
        cmp = (a.assignedObjective || '').localeCompare(b.assignedObjective || '', 'es', { sensitivity: 'base' });
      } else if (sortField === 'startDate') {
        const da = a.startDate || '';
        const db = b.startDate || '';
        if (!da && !db) cmp = 0;
        else if (!da) cmp = 1;
        else if (!db) cmp = -1;
        else cmp = da.localeCompare(db);
      } else if (sortField === 'endDate') {
        const da = a.endDate || '';
        const db = b.endDate || '';
        if (!da && !db) cmp = 0;
        else if (!da) cmp = 1;
        else if (!db) cmp = -1;
        else cmp = da.localeCompare(db);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [contracts, q, sortField, sortDirection]);

  const expiringCount = contracts.filter((c) => {
    const d = getContractDaysRemaining(c.endDate);
    return d !== null && d >= 0 && d <= CONTRACT_ALERT_DAYS;
  }).length;

  const exportCSV = () => {
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const headers = ['N°', 'Colaborador', 'Objetivo Asignado', 'Inicio de Contrato', 'Fin de Contrato', 'Observaciones'];
    const rows = filtered.map((c) =>
      [
        String(c.order),
        esc(c.fullName),
        esc(c.assignedObjective),
        esc(formatContractDate(c.startDate)),
        esc(formatContractDate(c.endDate)),
        esc(c.observations || '-'),
      ].join(';')
    );
    const csv =
      '\uFEFF# INVICT SECURITY SOLUTIONS S.A. - PLANILLA INFORMATIVA: CONTRATOS A PLAZO FIJO\n' +
      headers.join(';') +
      '\n' +
      rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INVICT_Contratos_Plazo_Fijo_${getTodayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.('Planilla de Contratos a Plazo Fijo exportada a CSV.');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(190, 38, 41);
    doc.rect(0, 0, w, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVICT SECURITY SOLUTIONS S.A.', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('PLANILLAS INFORMATIVAS - CONTRATOS A PLAZO FIJO', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, w - 14, 12, { align: 'right' });
    autoTable(doc, {
      startY: 24,
      head: [['N°', 'Colaborador', 'Objetivo Asignado', 'Inicio', 'Fin de Contrato', 'Observaciones']],
      body: filtered.map((c) => [
        String(c.order),
        c.fullName,
        c.assignedObjective,
        formatContractDate(c.startDate),
        formatContractDate(c.endDate),
        c.observations || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 12, right: 12 },
    });
    doc.save(`INVICT_Contratos_Plazo_Fijo_${getTodayDateString()}.pdf`);
    onNotify?.('Planilla de Contratos a Plazo Fijo exportada a PDF.');
  };

  const inputCls =
    'w-full bg-[#161c28] border border-transparent focus:border-violet-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none transition-colors disabled:opacity-90 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-violet-950/70 text-violet-300 border border-violet-700/60 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" />
            {contracts.length} contratos ingresados
          </span>
          {expiringCount > 0 && (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-700/60 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              {expiringCount} vencen en 7 días o menos
            </span>
          )}
          {!canEdit && (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-700/60 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Solo lectura (edita Recursos Humanos y Gerencia)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar (CSV)</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] cursor-pointer"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Exportar (PDF)</span>
          </button>
          {canEdit && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Contrato</span>
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-[#121620] border border-[#22293b] overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[900px]">
          <thead>
            <tr className="bg-[#171c28] text-slate-400 uppercase text-[10px] tracking-wider">
              <th
                onClick={() => handleToggleSort('order')}
                className="py-2.5 px-3 w-14 text-center select-none cursor-pointer hover:text-white transition-colors group"
                title={`Ordenar por N° (${sortField === 'order' && sortDirection === 'asc' ? 'descendente' : 'ascendente'})`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>N°</span>
                  <span className={`transition-opacity ${sortField === 'order' ? 'text-violet-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'order' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('fullName')}
                className="py-2.5 px-3 min-w-[200px] select-none cursor-pointer hover:text-white transition-colors group"
                title={`Ordenar por Colaborador (${sortField === 'fullName' && sortDirection === 'asc' ? 'descendente' : 'ascendente'})`}
              >
                <div className="flex items-center gap-1.5">
                  <span>Colaborador</span>
                  <span className={`transition-opacity ${sortField === 'fullName' ? 'text-violet-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'fullName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('assignedObjective')}
                className="py-2.5 px-3 min-w-[180px] select-none cursor-pointer hover:text-white transition-colors group"
                title={`Ordenar por Objetivo Asignado (${sortField === 'assignedObjective' && sortDirection === 'asc' ? 'descendente' : 'ascendente'})`}
              >
                <div className="flex items-center gap-1.5">
                  <span>Objetivo Asignado</span>
                  <span className={`transition-opacity ${sortField === 'assignedObjective' ? 'text-violet-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'assignedObjective' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('startDate')}
                className="py-2.5 px-3 min-w-[140px] select-none cursor-pointer hover:text-white transition-colors group"
                title={`Ordenar por Fecha de Inicio (${sortField === 'startDate' && sortDirection === 'asc' ? 'descendente' : 'ascendente'})`}
              >
                <div className="flex items-center gap-1.5">
                  <span>Inicio de Contrato</span>
                  <span className={`transition-opacity ${sortField === 'startDate' ? 'text-violet-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'startDate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('endDate')}
                className="py-2.5 px-3 min-w-[170px] select-none cursor-pointer hover:text-white transition-colors group"
                title={`Ordenar por Fecha de Fin (${sortField === 'endDate' && sortDirection === 'asc' ? 'descendente' : 'ascendente'})`}
              >
                <div className="flex items-center gap-1.5">
                  <span>Fin de Contrato</span>
                  <span className={`transition-opacity ${sortField === 'endDate' ? 'text-violet-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'endDate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[220px]">Observaciones (opcional)</th>
              {canEdit && <th className="py-2.5 px-2 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2433]">
            {filtered.map((c) => {
              const days = getContractDaysRemaining(c.endDate);
              const soon = days !== null && days >= 0 && days <= CONTRACT_ALERT_DAYS;
              const expired = days !== null && days < 0;
              return (
                <tr key={c.id} className={soon ? 'bg-amber-950/20' : 'hover:bg-[#161b26]/70'}>
                  <td className="py-2 px-3 text-center font-mono font-bold text-violet-300">{c.order}</td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={c.fullName}
                      onChange={(e) => handleChange(c.id, 'fullName', e.target.value)}
                      placeholder="Apellido y Nombre"
                      className={`${inputCls} font-bold`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={c.assignedObjective}
                      onChange={(e) => handleChange(c.id, 'assignedObjective', e.target.value)}
                      placeholder="Objetivo"
                      className={inputCls}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={c.startDate}
                      onChange={(e) => handleChange(c.id, 'startDate', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={c.endDate}
                      onChange={(e) => handleChange(c.id, 'endDate', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                    {days !== null && (
                      <span
                        className={`block text-[10px] mt-0.5 font-semibold ${
                          soon ? 'text-amber-300' : expired ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        {expired ? `Finalizó hace ${Math.abs(days)} días` : describeContractDays(days)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={c.observations || ''}
                      onChange={(e) => handleChange(c.id, 'observations', e.target.value)}
                      placeholder="Opcional"
                      className={inputCls}
                    />
                  </td>
                  {canEdit && (
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                        title="Eliminar contrato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="py-10 text-center text-slate-500 text-xs">
                  <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No hay contratos a plazo fijo registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        La fecha de fin de contrato se refleja en el Calendario y, una semana antes, el usuario de Recursos Humanos recibe
        una alerta (campana, notificación y BONO).
      </p>
    </div>
  );
};
