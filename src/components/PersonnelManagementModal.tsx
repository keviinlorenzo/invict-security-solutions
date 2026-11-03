import React, { useState } from 'react';
import { AreaType, UserPersona, Task, UserProfileType } from '../types';
import {
  X,
  Users,
  Briefcase,
  ArrowRightLeft,
  Edit3,
  Save,
  Plus,
  Trash2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import {
  setPersonaPassword,
  resetPersonaPassword,
  getInitialPasswordFor,
  getCredentialInfo,
  generateRandomPassword,
  removePersonaCredential,
} from '../utils/userCredentialsService';
import { PROFILE_METADATA } from '../utils/authService';

interface PersonnelManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: UserPersona[];
  currentUser: UserPersona;
  onUpdatePersona: (updated: UserPersona) => void;
  onAddPersona?: (newPersona: UserPersona, initialPassword?: string) => void;
  onDeletePersona?: (personaId: string) => void;
  tasks: Task[];
  onReassignTasksToPersona?: (area: AreaType, newAssigneeName: string) => void;
  onNotify: (msg: string) => void;
}

export const PersonnelManagementModal: React.FC<PersonnelManagementModalProps> = ({
  isOpen,
  onClose,
  personas,
  currentUser,
  onUpdatePersona,
  onAddPersona,
  onDeletePersona,
  tasks,
  onReassignTasksToPersona,
  onNotify,
}) => {
  const isGerencia = currentUser.profileType === 'GERENTE';
  const [activeTab, setActiveTab] = useState<'posts' | 'passwords'>('posts');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    role: string;
    email: string;
    department: AreaType;
    profileType: UserProfileType;
    reassignExistingTasks: boolean;
  }>({
    name: '',
    role: '',
    email: '',
    department: 'OPERACIONES',
    profileType: 'operaciones',
    reassignExistingTasks: true,
  });

  const [isAddingNewPost, setIsAddingNewPost] = useState(false);
  const [newPostData, setNewPostData] = useState<{
    name: string;
    role: string;
    email: string;
    department: AreaType;
    profileType: UserProfileType;
    initialPassword: string;
    phone: string;
    notes: string;
  }>({
    name: '',
    role: '',
    email: '',
    department: 'OPERACIONES',
    profileType: 'operaciones',
    initialPassword: '',
    phone: '',
    notes: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState<UserPersona | null>(null);
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [lastAssigned, setLastAssigned] = useState<Record<string, string>>({});
  const [passwordsVersion, setPasswordsVersion] = useState(0);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleShowPassword = (key: string) => {
    setShowPasswordMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartEdit = (persona: UserPersona) => {
    setEditingId(persona.id);
    setFormData({
      name: persona.name,
      role: persona.role,
      email: persona.email,
      department: persona.department,
      profileType: persona.profileType,
      reassignExistingTasks: true,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (persona: UserPersona) => {
    if (!formData.name.trim() || !formData.email.trim()) {
      onNotify('Por favor completa el nombre y correo del responsable.');
      return;
    }
    const updated: UserPersona = {
      ...persona,
      name: formData.name.trim(),
      role: formData.role.trim() || persona.role,
      email: formData.email.trim(),
      department: formData.department,
      profileType: formData.profileType,
    };
    onUpdatePersona(updated);
    if (formData.reassignExistingTasks && onReassignTasksToPersona) {
      onReassignTasksToPersona(persona.department, updated.name);
      onNotify(`Puesto actualizado para ${persona.department}. Se reasignaron las tareas a ${updated.name}.`);
    } else {
      onNotify(`Puesto de trabajo actualizado en la nube.`);
    }
    setEditingId(null);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGerencia) {
      onNotify('Solo Gerencia tiene permisos para dar de alta nuevos puestos.');
      return;
    }
    if (!newPostData.name.trim() || !newPostData.role.trim() || !newPostData.email.trim()) {
      onNotify('Por favor completa todos los campos requeridos.');
      return;
    }
    const newPersona: UserPersona = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newPostData.name.trim(),
      role: newPostData.role.trim(),
      email: newPostData.email.trim().toLowerCase(),
      department: newPostData.department,
      profileType: newPostData.profileType,
      avatarBg: PROFILE_METADATA[newPostData.profileType]?.border || 'bg-slate-700',
      phone: newPostData.phone.trim() || undefined,
      notes: newPostData.notes.trim() || undefined,
    };
    if (onAddPersona) {
      onAddPersona(newPersona, newPostData.initialPassword);
    }
    onNotify(`Nuevo puesto "${newPersona.role}" creado por Gerencia.`);
    setIsAddingNewPost(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    if (!isGerencia) {
      onNotify('Solo Gerencia puede eliminar puestos de trabajo.');
      return;
    }
    if (onDeletePersona) {
      onDeletePersona(deleteConfirm.id);
    }
    onNotify(`Puesto "${deleteConfirm.role}" (${deleteConfirm.name}) eliminado.`);
    setDeleteConfirm(null);
  };

  const authorInfo = {
    name: currentUser.name,
    profile: currentUser.profileType,
    email: currentUser.email,
  };

  const handleAssignPassword = async (persona: UserPersona, pass: string) => {
    if (!isGerencia) {
      onNotify('Solo Gerencia puede asignar contraseñas.');
      return;
    }
    if (!pass || pass.length < 6) {
      onNotify('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    await setPersonaPassword(persona, pass, authorInfo);
    setLastAssigned(prev => ({ ...prev, [persona.id]: pass }));
    setEditingPasswordUserId(null);
    setNewPasswordInput('');
    setPasswordsVersion(v => v + 1);
    onNotify(`Contraseña asignada a ${persona.name}. Compártasela de forma privada.`);
  };

  const handleResetPassword = (persona: UserPersona) => {
    if (!isGerencia) return;
    resetPersonaPassword(persona, authorInfo);
    setLastAssigned(prev => {
      const next = { ...prev };
      delete next[persona.id];
      return next;
    });
    setPasswordsVersion(v => v + 1);
    onNotify(`Contraseña de ${persona.name} restablecida a su clave inicial (${getInitialPasswordFor(persona)}).`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-[#121620] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-[#161c29] border-b border-[#252f44] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Rotación de Personal & Gestión de Puestos
                </h3>
                {isGerencia && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-950 text-red-300 border border-red-700 uppercase">
                    Control Gerencial Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Administración de personal responsable de cada puesto y contraseñas corporativas.
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

        {/* Tabs */}
        <div className="px-5 pt-3 bg-[#0f131c] border-b border-[#1f2638] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'posts'
                  ? 'text-white border-[#BE2629] bg-[#161c29]'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Puestos de Trabajo ({personas.length})</span>
            </button>
            {isGerencia && (
              <button
                onClick={() => setActiveTab('passwords')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeTab === 'passwords'
                    ? 'text-white border-[#BE2629] bg-[#161c29]'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Usuarios y Contraseñas Individuales</span>
              </button>
            )}
          </div>

          {isGerencia && activeTab === 'posts' && !isAddingNewPost && (
            <button
              onClick={() => setIsAddingNewPost(true)}
              className="mb-2 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#BE2629] hover:brightness-110 text-white flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Puesto</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'posts' && (
            <>
              {isAddingNewPost && (
                <form
                  onSubmit={handleCreatePost}
                  className="p-4 bg-[#141a26] border-2 border-[#BE2629]/60 rounded-2xl shadow-xl space-y-3.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-[#252f44] pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#BE2629]" />
                      Dar de Alta un Nuevo Puesto de Trabajo
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewPost(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Cargo / Puesto *
                      </label>
                      <input
                        type="text"
                        value={newPostData.role}
                        onChange={(e) => setNewPostData({ ...newPostData, role: e.target.value })}
                        placeholder="ej: Supervisor Nocturno San Martín"
                        className="w-full px-3 py-2 bg-[#0b0e14] border border-[#2b364e] rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Responsable Asignado *
                      </label>
                      <input
                        type="text"
                        value={newPostData.name}
                        onChange={(e) => setNewPostData({ ...newPostData, name: e.target.value })}
                        placeholder="ej: Roberto Castro"
                        className="w-full px-3 py-2 bg-[#0b0e14] border border-[#2b364e] rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Correo Corporativo *
                      </label>
                      <input
                        type="email"
                        value={newPostData.email}
                        onChange={(e) => setNewPostData({ ...newPostData, email: e.target.value })}
                        placeholder="rcastro@invictsecurity.com.ar"
                        className="w-full px-3 py-2 bg-[#0b0e14] border border-[#2b364e] rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Área Operativa *
                      </label>
                      <select
                        value={newPostData.department}
                        onChange={(e) => {
                          const dept = e.target.value as AreaType;
                          let prof: UserProfileType = 'operaciones';
                          if (dept === 'RRHH') prof = 'recursos humanos';
                          if (dept === 'ADM') prof = 'administración';
                          if (dept === 'AUX_ADM') prof = 'auxiliar';
                          if (dept === 'SELECCION') prof = 'selección';
                          if (dept === 'GERENCIA') prof = 'GERENTE';
                          setNewPostData({ ...newPostData, department: dept, profileType: prof });
                        }}
                        className="w-full px-3 py-2 bg-[#0b0e14] border border-[#2b364e] rounded-xl text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="OPERACIONES">OPERACIONES</option>
                        <option value="RRHH">RRHH</option>
                        <option value="ADM">ADM</option>
                        <option value="AUX_ADM">AUX_ADM</option>
                        <option value="SELECCION">SELECCION</option>
                        <option value="GERENCIA">GERENCIA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Contraseña personal (opcional)
                      </label>
                      <input
                        type="text"
                        value={newPostData.initialPassword}
                        onChange={(e) => setNewPostData({ ...newPostData, initialPassword: e.target.value })}
                        placeholder="Vacío = clave inicial (Nombre2026!)"
                        className="w-full px-3 py-2 bg-[#0b0e14] border border-[#2b364e] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNewPost(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#202737] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[#BE2629] text-white hover:brightness-110 shadow cursor-pointer"
                    >
                      Guardar Puesto
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {personas.map((persona) => {
                  const isEditing = editingId === persona.id;
                  const meta = PROFILE_METADATA[persona.profileType || 'operaciones'] || PROFILE_METADATA['operaciones'];
                  return (
                    <div
                      key={persona.id}
                      className="p-4 bg-[#141824] border border-[#242e42] rounded-2xl transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${persona.avatarBg || 'bg-slate-700'} border border-white/10 shrink-0`}>
                            {persona.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">{persona.name}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${meta.badge}`}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                [{persona.department}]
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                              <span className="font-medium text-slate-300">{persona.role}</span>
                              <span>·</span>
                              <span className="font-mono text-slate-400">{persona.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isGerencia && !isEditing && (
                            <>
                              <button
                                onClick={() => handleStartEdit(persona)}
                                className="px-3 py-1.5 rounded-xl bg-[#1e273a] hover:bg-[#28354e] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Editar</span>
                              </button>
                              {persona.id !== 'p-master-c-level' && (
                                <button
                                  onClick={() => setDeleteConfirm(persona)}
                                  className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-900/40 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  <span>Eliminar</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-3 p-3.5 bg-[#0c1018] border border-[#2b374e] rounded-xl space-y-3 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                Nombre del Responsable
                              </label>
                              <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-[#141a26] border border-[#2c374d] rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                Cargo / Rol
                              </label>
                              <input
                                type="text"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-[#141a26] border border-[#2c374d] rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                Correo Electrónico
                              </label>
                              <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-[#141a26] border border-[#2c374d] rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.reassignExistingTasks}
                                onChange={(e) => setFormData({ ...formData, reassignExistingTasks: e.target.checked })}
                                className="rounded text-[#BE2629] focus:ring-0 cursor-pointer"
                              />
                              <span>Reasignar tareas pendientes a este nuevo responsable</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(persona)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Guardar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'passwords' && isGerencia && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-red-950/40 via-[#182030] to-red-950/40 border border-red-900/50 rounded-xl space-y-2 text-xs text-red-200">
                <div className="flex items-center gap-2 text-white font-bold">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Cada persona tiene su propio usuario y contraseña</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Las claves ya no se comparten por puesto. Usuario = correo de cada persona. Hasta que asigne una clave, ingresa con su <strong>clave inicial</strong> (Nombre2026!). Las claves asignadas se guardan cifradas (no se pueden volver a ver): al asignarla, se muestra una sola vez para que se la comunique.
                </p>
              </div>

              <div className="space-y-2.5" data-version={passwordsVersion}>
                {personas.map((persona) => {
                  const meta = PROFILE_METADATA[persona.profileType || 'operaciones'] || PROFILE_METADATA['operaciones'];
                  const info = getCredentialInfo(persona.id);
                  const initial = getInitialPasswordFor(persona);
                  const isEditingThis = editingPasswordUserId === persona.id;
                  const isShown = showPasswordMap[persona.id] || false;
                  const justAssigned = lastAssigned[persona.id];
                  return (
                    <div key={persona.id} className="p-3.5 rounded-2xl border border-[#242e42] bg-[#141926] space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{persona.name}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${meta.badge}`}>
                              {meta.label}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${info ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-amber-950/60 text-amber-300 border-amber-800/60'}`}>
                              {info ? 'Clave personalizada' : 'Clave inicial sin cambiar'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Usuario: {persona.email}
                          </div>
                        </div>
                        {!isEditingThis && (
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasswordUserId(persona.id);
                                setNewPasswordInput('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-800/60 text-[11px] font-bold cursor-pointer"
                            >
                              Asignar contraseña
                            </button>
                            {info && (
                              <button
                                type="button"
                                onClick={() => handleResetPassword(persona)}
                                className="px-2.5 py-1 rounded-lg bg-[#1e273a] hover:bg-[#28354e] text-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Volver a la clave inicial"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restablecer</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {!info && !isEditingThis && (
                        <div className="flex items-center justify-between p-2 bg-[#0c1018] border border-[#232d3f] rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-slate-400 text-[11px]">Clave inicial:</span>
                            <span className="font-mono font-bold text-white tracking-wider">
                              {isShown ? initial : '••••••••••'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(persona.id)}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}

                      {info && !isEditingThis && (
                        <div className="text-[10px] text-slate-500">
                          Última asignación: {new Date(info.updatedAt).toLocaleString('es-AR')} · por {info.updatedBy}
                        </div>
                      )}

                      {justAssigned && !isEditingThis && (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                          <span>
                            Nueva clave (visible solo ahora): <strong className="font-mono text-white">{justAssigned}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setLastAssigned(prev => {
                              const next = { ...prev };
                              delete next[persona.id];
                              return next;
                            })}
                            className="text-emerald-300 hover:text-white cursor-pointer"
                          >
                            Ocultar
                          </button>
                        </div>
                      )}

                      {isEditingThis && (
                        <div className="p-3 bg-[#0c1018] border border-blue-500/50 rounded-xl space-y-2 animate-in fade-in">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newPasswordInput}
                              onChange={(e) => setNewPasswordInput(e.target.value)}
                              placeholder="Nueva contraseña (mín. 6 caracteres)"
                              className="flex-1 px-3 py-1.5 bg-[#141a26] border border-[#2c374d] rounded-lg text-xs text-white font-mono"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setNewPasswordInput(generateRandomPassword())}
                              className="px-2.5 py-1.5 rounded-lg bg-[#1e273a] hover:bg-[#28354e] text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Generar</span>
                            </button>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPasswordUserId(null)}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAssignPassword(persona, newPasswordInput)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Overlay */}
        {deleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#151924] border border-red-700/60 p-5 rounded-2xl max-w-md w-full shadow-2xl space-y-3">
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 className="w-6 h-6" />
                <h4 className="text-base font-bold text-white">¿Eliminar Puesto de Trabajo?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Confirmas eliminar el puesto <strong>"{deleteConfirm.role}"</strong> ({deleteConfirm.name})?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-[#202838] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow cursor-pointer"
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
