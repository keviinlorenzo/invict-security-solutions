import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Search,
  Download,
  FileText,
  MessageSquare,
  Send,
  Lock,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building,
  User,
  Filter,
  X,
  Edit2
} from 'lucide-react';
import { UserPersona } from '../types';
import { subscribeToCloudSync } from '../utils/cloudSyncService';
import { getTodayDateString } from '../utils/dateUtils';
import {
  RelevamientoItem,
  RelevamientoCategoria,
  RelevamientoEstado,
  RelevamientoComentario,
  RELEVAMIENTO_CATEGORIAS,
  canEditRelevamientos,
  getRelevamientos,
  saveRelevamientos,
  RELEVAMIENTOS_EVENT
} from '../data/relevamientosData';

interface Props {
  currentPersona: UserPersona;
  onNotify?: (msg: string) => void;
  searchTerm?: string;
}

type SortField = 'orderNumber' | 'clientName' | 'category' | 'status' | 'conLicHigieneSeguridad' | 'comments';
type SortDirection = 'asc' | 'desc';

export const RelevamientosSheet: React.FC<Props> = ({ currentPersona, onNotify, searchTerm = '' }) => {
  const [relevamientos, setRelevamientos] = useState<RelevamientoItem[]>(() => getRelevamientos());
  const [localSearch, setLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'TODAS' | RelevamientoCategoria>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<'TODOS' | RelevamientoEstado>('TODOS');
  const [sortField, setSortField] = useState<SortField>('orderNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal para agregar / editar relevamiento (Operaciones / Marianela Sosa)
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formClientName, setFormClientName] = useState('');
  const [formCategory, setFormCategory] = useState<RelevamientoCategoria>('edificio');
  const [formObservations, setFormObservations] = useState('');
  const [formStatus, setFormStatus] = useState<RelevamientoEstado>('no iniciada');
  const [formConLic, setFormConLic] = useState(false);

  // Modal para hilo de conversación / comentarios (Cualquier usuario puede comentar)
  const [activeCommentItem, setActiveCommentItem] = useState<RelevamientoItem | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const canEdit = canEditRelevamientos(currentPersona);

  useEffect(() => {
    const refresh = () => setRelevamientos(getRelevamientos());
    window.addEventListener(RELEVAMIENTOS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    const unsub = subscribeToCloudSync((payload) => {
      if (payload.type === 'SHEET_MUTATION' || payload.type === 'FULL_STATE_SYNC' || payload.stateSnapshot) {
        refresh();
      }
    });
    return () => {
      window.removeEventListener(RELEVAMIENTOS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      unsub();
    };
  }, []);

  const persist = (next: RelevamientoItem[], summary: string) => {
    setRelevamientos(next);
    saveRelevamientos(next, currentPersona, summary);
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const effectiveSearch = (searchTerm || localSearch).toLowerCase().trim();

  const filtered = useMemo(() => {
    let result = relevamientos;

    if (selectedCategory !== 'TODAS') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    if (selectedStatus !== 'TODOS') {
      result = result.filter((r) => r.status === selectedStatus);
    }

    if (effectiveSearch) {
      result = result.filter(
        (r) =>
          r.clientName.toLowerCase().includes(effectiveSearch) ||
          (r.observations || '').toLowerCase().includes(effectiveSearch) ||
          r.category.toLowerCase().includes(effectiveSearch) ||
          r.status.toLowerCase().includes(effectiveSearch)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'orderNumber') {
        cmp = a.orderNumber - b.orderNumber;
      } else if (sortField === 'clientName') {
        cmp = a.clientName.localeCompare(b.clientName, 'es', { sensitivity: 'base' });
      } else if (sortField === 'category') {
        cmp = a.category.localeCompare(b.category, 'es', { sensitivity: 'base' });
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status, 'es', { sensitivity: 'base' });
      } else if (sortField === 'conLicHigieneSeguridad') {
        cmp = (a.conLicHigieneSeguridad === b.conLicHigieneSeguridad) ? 0 : a.conLicHigieneSeguridad ? -1 : 1;
      } else if (sortField === 'comments') {
        cmp = (a.comments?.length || 0) - (b.comments?.length || 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [relevamientos, selectedCategory, selectedStatus, effectiveSearch, sortField, sortDirection]);

  // Abrir modal de nuevo relevamiento
  const handleOpenAddModal = () => {
    if (!canEdit) return;
    setEditingId(null);
    setFormClientName('');
    setFormCategory('edificio');
    setFormObservations('');
    setFormStatus('no iniciada');
    setFormConLic(false);
    setIsAddEditModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (item: RelevamientoItem) => {
    if (!canEdit) return;
    setEditingId(item.id);
    setFormClientName(item.clientName);
    setFormCategory(item.category);
    setFormObservations(item.observations || '');
    setFormStatus(item.status);
    setFormConLic(item.conLicHigieneSeguridad);
    setIsAddEditModalOpen(true);
  };

  // Guardar formulario de relevamiento
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!formClientName.trim()) {
      alert('Por favor, ingresá el nombre del cliente.');
      return;
    }

    const today = getTodayDateString();
    const actorStamp = {
      updatedAt: today,
      updatedBy: `${currentPersona.name} (${currentPersona.department || 'Operaciones'})`,
    };

    if (editingId) {
      const next = relevamientos.map((r) =>
        r.id === editingId
          ? {
              ...r,
              clientName: formClientName.trim(),
              category: formCategory,
              observations: formObservations.trim(),
              status: formStatus,
              conLicHigieneSeguridad: formConLic,
              ...actorStamp,
            }
          : r
      );
      persist(next, `${currentPersona.name} actualizó el relevamiento de "${formClientName}"`);
      onNotify?.(`Relevamiento de "${formClientName}" actualizado.`);
    } else {
      const maxOrder = relevamientos.reduce((max, r) => Math.max(max, r.orderNumber || 0), 0);
      const newRow: RelevamientoItem = {
        id: `rel-${Date.now()}`,
        orderNumber: maxOrder + 1,
        clientName: formClientName.trim(),
        category: formCategory,
        observations: formObservations.trim(),
        status: formStatus,
        conLicHigieneSeguridad: formConLic,
        createdAt: today,
        ...actorStamp,
        comments: [],
      };
      persist([...relevamientos, newRow], `${currentPersona.name} registró un nuevo relevamiento para "${formClientName}"`);
      onNotify?.(`¡Relevamiento N° ${newRow.orderNumber} creado exitosamente!`);
    }

    setIsAddEditModalOpen(false);
  };

  // Eliminar relevamiento
  const handleDeleteItem = (id: string) => {
    if (!canEdit) return;
    const target = relevamientos.find((r) => r.id === id);
    if (!confirm(`¿Confirmas la eliminación del relevamiento de "${target?.clientName}"?`)) return;
    const next = relevamientos
      .filter((r) => r.id !== id)
      .map((r, idx) => ({ ...r, orderNumber: idx + 1 }));
    persist(next, `${currentPersona.name} eliminó el relevamiento de "${target?.clientName}"`);
    onNotify?.('Relevamiento eliminado.');
  };

  // Alternar estado rápido (no iniciada -> en curso -> completada)
  const handleToggleStatus = (id: string) => {
    if (!canEdit) return;
    const cycleMap: Record<RelevamientoEstado, RelevamientoEstado> = {
      'no iniciada': 'en curso',
      'en curso': 'completada',
      'completada': 'no iniciada',
    };
    const next = relevamientos.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          status: cycleMap[r.status],
          updatedAt: getTodayDateString(),
          updatedBy: currentPersona.name,
        };
      }
      return r;
    });
    persist(next, `${currentPersona.name} cambió el estado de relevamiento`);
  };

  // Agregar comentario en la conversación (Cualquier usuario)
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentItem || !newCommentText.trim()) return;

    const newComment: RelevamientoComentario = {
      id: `rc-${Date.now()}`,
      authorName: currentPersona.name,
      authorProfile: currentPersona.profileType || currentPersona.department,
      authorEmail: currentPersona.email,
      timestamp: `${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`,
      text: newCommentText.trim(),
    };

    const next = relevamientos.map((r) => {
      if (r.id === activeCommentItem.id) {
        const comments = [...(r.comments || []), newComment];
        return { ...r, comments };
      }
      return r;
    });

    persist(next, `${currentPersona.name} comentó en el relevamiento de "${activeCommentItem.clientName}"`);
    setActiveCommentItem((prev) => (prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null));
    setNewCommentText('');
    onNotify?.('Comentario agregado a la conversación.');
  };

  // Exportar a CSV
  const exportCSV = () => {
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const headers = ['N°', 'Cliente', 'Categoría', 'Lic. HyS', 'Estado', 'Observaciones', 'Comentarios', 'Última Modif.'];
    const rows = filtered.map((r) => [
      String(r.orderNumber),
      esc(r.clientName),
      esc(r.category.toUpperCase()),
      esc(r.conLicHigieneSeguridad ? 'Con Lic. HyS' : 'Sin Lic. HyS'),
      esc(r.status.toUpperCase()),
      esc(r.observations || '-'),
      esc(`${r.comments?.length || 0} comentarios`),
      esc(`${r.updatedAt || r.createdAt} (${r.updatedBy || '-'})`),
    ]);
    const csv =
      '\uFEFF# INVICT SECURITY SOLUTIONS S.A. - PLANILLA INFORMATIVA: RELEVAMIENTOS OPERATIVOS\n' +
      headers.join(';') +
      '\n' +
      rows.map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INVICT_Relevamientos_Operativos_${getTodayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.('Planilla de Relevamientos exportada a CSV.');
  };

  // Exportar a PDF
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
    doc.text('PLANILLA INFORMATIVA: RELEVAMIENTOS OPERATIVOS (OPERACIONES)', 14, 15);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, w - 14, 12, { align: 'right' });

    autoTable(doc, {
      startY: 24,
      head: [['N°', 'Cliente', 'Categoría', 'Lic. HyS', 'Estado', 'Observaciones', 'Comentarios']],
      body: filtered.map((r) => [
        String(r.orderNumber),
        r.clientName,
        r.category.toUpperCase(),
        r.conLicHigieneSeguridad ? 'Sí' : 'No',
        r.status.toUpperCase(),
        r.observations || '-',
        `${r.comments?.length || 0} msgs`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [190, 38, 41], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 12, right: 12 },
    });
    doc.save(`INVICT_Relevamientos_${getTodayDateString()}.pdf`);
    onNotify?.('Planilla de Relevamientos exportada a PDF.');
  };

  const getCategoryBadge = (catId: RelevamientoCategoria) => {
    const found = RELEVAMIENTO_CATEGORIAS.find((c) => c.id === catId);
    if (!found) return null;
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5 shadow-sm ${found.badgeClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: found.dotColor }} />
        <span>{found.shortLabel}</span>
      </span>
    );
  };

  const getStatusBadge = (status: RelevamientoEstado) => {
    switch (status) {
      case 'completada':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/70 inline-flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Completada</span>
          </span>
        );
      case 'en curso':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700/70 inline-flex items-center gap-1 shadow-sm">
            <Clock className="w-3 h-3 text-blue-400 animate-pulse" />
            <span>En Curso</span>
          </span>
        );
      case 'no iniciada':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-slate-300 border border-slate-700 inline-flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3 h-3 text-slate-400" />
            <span>No Iniciada</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Permissions notice, counts and Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-700/60 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
            {relevamientos.length} relevamientos registrados
          </span>

          {canEdit ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Edición Habilitada (Operaciones - Marianela Sosa)</span>
            </span>
          ) : (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1"
              title="Solo Operaciones puede editar. Todos pueden ver y realizar comentarios."
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Solo Lectura (Comentarios Habilitados)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
            title="Exportar planilla a formato CSV para Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#242f45] text-slate-200 font-bold text-xs border border-[#2e3b54] shadow transition-all cursor-pointer active:scale-95"
            title="Exportar a PDF oficial"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>PDF</span>
          </button>

          {canEdit && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Relevamiento</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar: Category pills, Status selector, Search input */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-[#121620] border border-[#22293b] rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('TODAS')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              selectedCategory === 'TODAS'
                ? 'bg-white text-black border-white shadow'
                : 'bg-[#182030] text-slate-400 border-[#253047] hover:text-white'
            }`}
          >
            Todas ({relevamientos.length})
          </button>
          {RELEVAMIENTO_CATEGORIAS.map((cat) => {
            const count = relevamientos.filter((r) => r.category === cat.id).length;
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1.5 ${
                  isSel ? `${cat.badgeClass} ring-1 ring-current` : 'bg-[#182030] text-slate-400 border-[#253047] hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.dotColor }} />
                <span>{cat.shortLabel}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="bg-[#182030] text-slate-300 border border-[#253047] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="no iniciada">No iniciadas</option>
            <option value="en curso">En curso</option>
            <option value="completada">Completadas</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="bg-[#182030] text-slate-200 pl-8 pr-3 py-1 rounded-xl text-xs border border-[#253047] focus:outline-none focus:border-indigo-500 w-36 sm:w-48 placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Main Interactive Table */}
      <div className="rounded-2xl bg-[#121620] border border-[#22293b] overflow-x-auto shadow-xl">
        <table className="w-full text-left text-xs min-w-[950px]">
          <thead>
            <tr className="bg-[#171c28] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#22293b]">
              {/* N° */}
              <th
                onClick={() => handleToggleSort('orderNumber')}
                className="py-3 px-3 w-14 text-center select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por N°"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>N°</span>
                  <span className={`transition-opacity ${sortField === 'orderNumber' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'orderNumber' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* CLIENTE */}
              <th
                onClick={() => handleToggleSort('clientName')}
                className="py-3 px-3 min-w-[200px] select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por Cliente"
              >
                <div className="flex items-center gap-1.5">
                  <span>Cliente / Objetivo</span>
                  <span className={`transition-opacity ${sortField === 'clientName' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'clientName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* CATEGORÍA */}
              <th
                onClick={() => handleToggleSort('category')}
                className="py-3 px-3 min-w-[150px] select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por Categoría"
              >
                <div className="flex items-center gap-1.5">
                  <span>Categoría</span>
                  <span className={`transition-opacity ${sortField === 'category' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* LIC. EN HIGIENE Y SEGURIDAD */}
              <th
                onClick={() => handleToggleSort('conLicHigieneSeguridad')}
                className="py-3 px-3 min-w-[160px] text-center select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por presencia de Lic. en Higiene y Seguridad"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Lic. Higiene y Seg.</span>
                  <span className={`transition-opacity ${sortField === 'conLicHigieneSeguridad' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'conLicHigieneSeguridad' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* ESTADO */}
              <th
                onClick={() => handleToggleSort('status')}
                className="py-3 px-3 min-w-[130px] text-center select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por Estado"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Estado</span>
                  <span className={`transition-opacity ${sortField === 'status' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* OBSERVACIONES */}
              <th className="py-3 px-3 min-w-[240px]">Observaciones</th>

              {/* CONVERSACIÓN / COMENTARIOS */}
              <th
                onClick={() => handleToggleSort('comments')}
                className="py-3 px-3 min-w-[140px] text-center select-none cursor-pointer hover:text-white transition-colors group"
                title="Ordenar por cantidad de comentarios"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Conversación</span>
                  <span className={`transition-opacity ${sortField === 'comments' ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-70'}`}>
                    {sortField === 'comments' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </span>
                </div>
              </th>

              {/* ACCIONES (Operaciones) */}
              {canEdit && <th className="py-3 px-3 w-16 text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2433]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-slate-500 text-xs">
                  <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">No se encontraron relevamientos con los filtros aplicados.</p>
                  {canEdit && (
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Primer Relevamiento</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const commentsCount = item.comments?.length || 0;
                return (
                  <tr key={item.id} className="hover:bg-[#161b26]/70 transition-colors group">
                    {/* N° */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-300">
                      #{item.orderNumber}
                    </td>

                    {/* Cliente */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">{item.clientName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Registrado el {item.createdAt} {item.updatedBy ? `· ${item.updatedBy}` : ''}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(item.category)}
                    </td>

                    {/* Lic. en Higiene y Seguridad */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.conLicHigieneSeguridad ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/70 inline-flex items-center gap-1 shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                          <span>Con Lic. HyS</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                          <span>Sin Lic. HyS</span>
                        </span>
                      )}
                    </td>

                    {/* Estado (Clic para alternar si es Operaciones) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {canEdit ? (
                        <button
                          onClick={() => handleToggleStatus(item.id)}
                          className="cursor-pointer transition-transform active:scale-95 hover:brightness-110"
                          title="Clic para cambiar estado"
                        >
                          {getStatusBadge(item.status)}
                        </button>
                      ) : (
                        getStatusBadge(item.status)
                      )}
                    </td>

                    {/* Observaciones */}
                    <td className="py-3 px-3 text-slate-300 text-xs max-w-[280px]">
                      <p className="line-clamp-2 leading-relaxed" title={item.observations}>
                        {item.observations || <span className="text-slate-600 italic">Sin observaciones</span>}
                      </p>
                    </td>

                    {/* Conversación / Comentarios */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => setActiveCommentItem(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          commentsCount > 0
                            ? 'bg-indigo-950/90 text-indigo-300 border border-indigo-700/80 hover:bg-indigo-900 shadow-sm'
                            : 'bg-[#182030] text-slate-400 border border-[#253047] hover:text-white hover:border-slate-500'
                        }`}
                        title="Ver y participar en la conversación"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{commentsCount} {commentsCount === 1 ? 'comentario' : 'comentarios'}</span>
                      </button>
                    </td>

                    {/* Acciones (Operaciones) */}
                    {canEdit && (
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Editar relevamiento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Eliminar relevamiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: AGREGAR / EDITAR RELEVAMIENTO (Solo Operaciones - Marianela Sosa) */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#151a26] border border-[#263148] rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#222a3d] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingId ? 'Editar Relevamiento' : 'Nuevo Relevamiento'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Puesto: Operaciones & Logística (Marianela Sosa)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#20283c] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Cliente / Objetivo *</label>
                <input
                  type="text"
                  required
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="Ej: Bodegas Luján de Cuyo / Torre Da Vinci"
                  className="w-full bg-[#10141e] border border-[#263148] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoría del Relevamiento</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RELEVAMIENTO_CATEGORIAS.map((cat) => {
                    const isSelected = formCategory === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id)}
                        className={`p-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? `${cat.badgeClass} ring-2 ring-current`
                            : 'bg-[#10141e] border-[#263148] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.dotColor }} />
                        <span className="truncate">{cat.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lic. en Higiene y Seguridad Switch */}
              <div className="p-3 rounded-2xl bg-[#10141e] border border-[#263148] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>¿Se realiza con el Lic. en Higiene y Seguridad?</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Indica si requiere inspección técnica conjunta</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConLic}
                    onChange={(e) => setFormConLic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-[#10141e] border border-[#263148] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="no iniciada">No iniciada</option>
                  <option value="en curso">En curso</option>
                  <option value="completada">Completada</option>
                </select>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  placeholder="Puntos a inspeccionar, medidas de seguridad detectadas, novedades..."
                  className="w-full bg-[#10141e] border border-[#263148] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222a3d]">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1d2538] hover:bg-[#253047] text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:brightness-110 text-white text-xs font-bold shadow-lg cursor-pointer"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Relevamiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HILO DE CONVERSACIÓN / COMENTARIOS (Abierto a TODOS los usuarios) */}
      {activeCommentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#151a26] border border-[#263148] rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#222a3d] mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Conversación: {activeCommentItem.clientName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getCategoryBadge(activeCommentItem.category)}
                    {getStatusBadge(activeCommentItem.status)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveCommentItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#20283c] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 my-2">
              {(!activeCommentItem.comments || activeCommentItem.comments.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">Aún no hay comentarios en este relevamiento.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cualquier puesto de la oficina puede dejar un mensaje o consulta a continuación.
                  </p>
                </div>
              ) : (
                activeCommentItem.comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-[#10141e] border border-[#222b3e] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        {c.authorName}
                        {c.authorProfile && (
                          <span className="text-[10px] font-normal text-slate-400 bg-slate-800/60 px-1.5 py-0.2 rounded border border-slate-700/60">
                            {c.authorProfile}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{c.timestamp}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-[#222a3d] shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={`Escribir un comentario como ${currentPersona.name}...`}
                  className="flex-1 bg-[#10141e] border border-[#263148] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
