import React, { useState, useRef } from 'react';
import { Expense, ExpenseCategory, UserPersona, PaymentMethodType, ExpenseItemBreakdown } from '../types';
import { scanAndAnalyzeReceiptFile } from '../utils/receiptScannerService';
import {
  X,
  Receipt,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Building,
  Check,
  Tag,
  DollarSign
} from 'lucide-react';

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  currentPeriod: string;
  currentPersona?: UserPersona;
}

const GASTOS_COMUNES: ExpenseCategory[] = [
  'Compras de Insumos',
  'Viáticos Operativos',
  'Servicios de Oficina',
  'Mantenimiento / Ploteo',
  'Movilidad y Combustible',
  'Indumentaria / Uniformes',
];

const GASTOS_ESPECIALES_GERENCIA: ExpenseCategory[] = [
  'Telefonía y Conectividad',
  'Multas REPRIV',
];

const PAYMENT_METHODS: PaymentMethodType[] = [
  'Efectivo',
  'Transferencia Bancaria',
  'Cheque Físico',
  'E-Check',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Otro',
];

export const NewExpenseModal: React.FC<NewExpenseModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  currentPeriod,
  currentPersona,
}) => {
  const isGerencia = Boolean(
    currentPersona && (currentPersona.department === 'GERENCIA' || currentPersona.profileType === 'GERENTE')
  );

  const [date, setDate] = useState(`${currentPeriod}-10`);
  const [category, setCategory] = useState<ExpenseCategory>('Compras de Insumos');
  const [provider, setProvider] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Pagado' | 'Pendiente' | 'En Revisión'>('Pendiente');
  const [responsible, setResponsible] = useState(currentPersona?.name || 'Giuliana');
  const [notes, setNotes] = useState('');

  // Payment Method States
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Efectivo');
  const [paymentDate, setPaymentDate] = useState(`${currentPeriod}-10`);
  const [checkDeliveryDate, setCheckDeliveryDate] = useState(`${currentPeriod}-10`);
  const [checkDebitDate, setCheckDebitDate] = useState(`${currentPeriod}-28`);
  const [checkNumber, setCheckNumber] = useState('');

  // Item Breakdown State
  const [items, setItems] = useState<ExpenseItemBreakdown[]>([]);

  // Document OCR / AI Analyzer State
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [analyzedDocName, setAnalyzedDocName] = useState<string | null>(null);
  const [analyzeSuccessMessage, setAnalyzeSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isCheckPayment = paymentMethod === 'Cheque Físico' || paymentMethod === 'E-Check';

  // Item Breakdown Management
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0, subtotal: 0 },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof ExpenseItemBreakdown, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: val };

      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? parseFloat(val) || 0 : target.quantity || 1;
        const p = field === 'unitPrice' ? parseFloat(val) || 0 : target.unitPrice || 0;
        target.subtotal = Math.round(q * p);
      }
      next[index] = target;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, header if present
        const base64Data = result.split(',')[1] || result;
        resolve(base64Data);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Extract raw text for text or word files
  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
      return await file.text();
    }
    // Read slice of buffer for plain ASCII string segments in word or pdf
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 50000));
      let decoded = '';
      for (let i = 0; i < bytes.length; i++) {
        const ch = bytes[i];
        if (ch >= 32 && ch <= 126) {
          decoded += String.fromCharCode(ch);
        } else if (ch === 10 || ch === 13) {
          decoded += '\n';
        }
      }
      return decoded;
    } catch (e) {
      return '';
    }
  };

  // Intelligent Parser for PDF, Word, Image & Text Receipts
  const analyzeReceiptDocument = async (file: File) => {
    setIsAnalyzingDoc(true);
    setAnalyzedDocName(file.name);
    setAnalyzeSuccessMessage(null);

    try {
      const data = await scanAndAnalyzeReceiptFile(file);

      if (data) {
        // 1. Emisor / Comercio
        if (data.provider) {
          setProvider(data.provider);
        }

        // 2. Monto TOTAL real del comprobante
        if (data.totalAmount && data.totalAmount > 0) {
          setAmount(String(Math.round(data.totalAmount)));
        }

        // 3. Número de Comprobante / Factura
        if (data.invoiceNumber) {
          setInvoiceNumber(data.invoiceNumber);
        }

        // 4. Fecha de emisión
        if (data.date) {
          setDate(data.date);
          setPaymentDate(data.date);
          setCheckDeliveryDate(data.date);
        }

        // 5. Categoría
        if (data.category && GASTOS_COMUNES.includes(data.category as any)) {
          setCategory(data.category as ExpenseCategory);
        }

        // 6. Método de pago
        if (data.paymentMethod) {
          setPaymentMethod(data.paymentMethod as PaymentMethodType);
        }

        // 7. Ítems detallados
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }

        setPaymentStatus('Pagado');
        const formattedTotal = Math.round(data.totalAmount || 0).toLocaleString('es-AR');
        setNotes(
          `Comprobante verificado: ${file.name}. Comercio emisor: ${data.provider || 'Comercio local'}. Monto total analizado: $ ${formattedTotal}. Método: ${data.method || 'Auto'}`
        );

        setAnalyzeSuccessMessage(
          `✓ Comprobante "${file.name}" leído y analizado con éxito.\n` +
          `• Empresa/Comercio emisor: ${data.provider || 'Identificado'}\n` +
          `• Monto TOTAL final: $ ${formattedTotal}\n` +
          (data.invoiceNumber ? `• N° Comprobante: ${data.invoiceNumber}\n` : '') +
          `• ${data.items?.length || 0} ítems y productos detallados cargados en el desglose.`
        );
      }
    } catch (err: any) {
      console.warn('Error analyzing receipt document:', err);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const detectedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      setProvider(detectedName);
      setNotes(`Comprobante adjuntado: ${file.name}. Datos cargados para verificación manual.`);
      setAnalyzeSuccessMessage(`Archivo "${file.name}" cargado. Por favor verifica los campos y el monto total.`);
    } finally {
      setIsAnalyzingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeReceiptDocument(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    onAddExpense({
      date,
      category,
      provider: provider.trim() || 'Proveedor Mendoza',
      invoiceNumber: invoiceNumber.trim() || 'FAC-0001',
      amount: numAmount,
      subtotal: Math.round(numAmount / 1.21),
      vatRate: 21,
      vatAmount: Math.round(numAmount - numAmount / 1.21),
      withholdingRate: 0,
      withholdings: 0,
      paymentStatus,
      paymentMethod,
      paymentDate: !isCheckPayment ? paymentDate || date : undefined,
      checkDeliveryDate: isCheckPayment ? checkDeliveryDate : undefined,
      checkDebitDate: isCheckPayment ? checkDebitDate : undefined,
      checkNumber: isCheckPayment ? checkNumber.trim() || undefined : undefined,
      responsible: responsible.trim() || (currentPersona?.name || 'Responsable'),
      notes: notes.trim(),
      attachmentName: analyzedDocName || undefined,
      items: items.length > 0 ? items : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-[#121620] border border-[#273248] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden input for receipt doc / invoice upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-[#171c29] via-[#1a2234] to-[#171c29] border-b border-[#252f44] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#BE2629]/20 text-[#BE2629] border border-[#BE2629]/40">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Registrar Nuevo Gasto de Oficina</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#202737] text-slate-300 border border-[#2f394e]">
                  {isGerencia ? 'Acceso Gerencial' : 'Gastos Comunes'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isGerencia
                  ? 'Gestión contable integral, cheques, e-checks y retenciones societarias'
                  : 'Rendición de caja chica, insumos y comprobantes de oficina'}
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

        {/* AI Receipt / Invoice OCR Upload Section */}
        <div className="p-4 bg-[#0d1017] border-b border-[#1f2739] space-y-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Lector & Analizador Inteligente de Facturas / Tickets
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Detecta Comercio Emisor · Monto Total · Ítems del Ticket
            </span>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#2f3c58] hover:border-cyan-500/70 bg-[#131824]/60 hover:bg-[#161e30] p-3 rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer group"
          >
            <div className="p-2.5 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                {isAnalyzingDoc
                  ? 'Analizando detalladamente el comprobante (comercio, total e ítems)...'
                  : analyzedDocName
                  ? `Comprobante cargado: ${analyzedDocName} (clic para subir otro)`
                  : 'Cargar Factura / Ticket / Comprobante (PDF, Word o Imagen)'}
              </p>
              <p className="text-[11px] text-slate-400">
                Lee automáticamente la empresa que REALIZA EL TICKET, el monto final "TOTAL" y cada uno de los ítems comprados.
              </p>
            </div>
          </div>

          {analyzeSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="whitespace-pre-line leading-relaxed font-sans">{analyzeSuccessMessage}</div>
            </div>
          )}
        </div>

        {/* Modal Form Scroll Area */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Row 1: Fecha de Emisión y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Fecha del Comprobante:</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (!isCheckPayment) setPaymentDate(e.target.value);
                }}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoría del Gasto:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white cursor-pointer focus:outline-none focus:border-blue-500"
              >
                <optgroup label="Gastos Comunes de Oficina">
                  {GASTOS_COMUNES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
                {isGerencia && (
                  <optgroup label="Gastos Especiales / Gerenciales">
                    {GASTOS_ESPECIALES_GERENCIA.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Row 2: Proveedor (Empresa que realiza el ticket) y N° Factura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Proveedor / Comercio Emisor:</span>
                <span className="text-[10px] text-blue-400 font-normal">Empresa que emite el ticket</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Librería & Papelera García Hermanos, YPF Central..."
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">N° Comprobante / Ticket / Boleta:</label>
              <input
                type="text"
                placeholder="Ej: FC-B 0004-00018920 o TCK-98214"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 3: Monto TOTAL Final y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Monto TOTAL Final ($ ARS):</span>
                <span className="text-[10px] text-emerald-400 font-bold">Total a Pagar</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-mono font-bold">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="10"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-[#161b24] border border-[#2b364e] focus:border-emerald-500 rounded-xl text-white font-mono font-bold text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Estado del Pago:</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white cursor-pointer focus:outline-none focus:border-blue-500"
              >
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Revisión">En Revisión</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Responsable del Registro:</label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nombre del responsable"
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION: MÉTODO DE PAGO Y FECHAS (CHEQUE / E-CHECK vs OTROS)     */}
          {/* ================================================================= */}
          <div className="p-3.5 bg-[#141926] border border-[#253046] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                Método de Pago y Fechas de Liquidación
              </span>
              <span className="text-[10px] text-slate-400">
                {isCheckPayment ? 'Requiere fecha de entrega y fecha de débito' : 'Requiere fecha en la que se pagó'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Forma / Medio de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                  className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white cursor-pointer focus:outline-none focus:border-blue-500 font-medium"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Inputs: Cheque Físico / E-Check */}
              {isCheckPayment ? (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    N° de Cheque o E-Check (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: CH-Galicia-48120 o ECH-00912"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Fecha en la que se Pagó:</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Efectivo / Transferencia</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* If Cheque or E-Check: Show the TWO required dates */}
            {isCheckPayment && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#111622] rounded-xl border border-amber-800/40">
                <div>
                  <label className="block text-amber-200 font-bold mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fecha de Entrega del Cheque:</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={checkDeliveryDate}
                    onChange={(e) => setCheckDeliveryDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#161b24] border border-[#2b364e] rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Día en que se firmó y entregó al proveedor.
                  </span>
                </div>
                <div>
                  <label className="block text-cyan-200 font-bold mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Fecha en que se Debitaría el Pago:</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={checkDebitDate}
                    onChange={(e) => setCheckDebitDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#161b24] border border-[#2b364e] rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Fecha prevista de impacto en la cuenta bancaria.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION: DESGLOSE DETALLADO DE ÍTEMS DEL COMPROBANTE               */}
          {/* ================================================================= */}
          <div className="p-3.5 bg-[#141926] border border-[#253046] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-400" />
                Ítems y Productos Comprados ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1f2738] hover:bg-[#283247] text-blue-300 text-[11px] font-semibold border border-[#303c54] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Agregar Ítem</span>
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-1">
                Al subir una factura o ticket, el analizador inteligente completará automáticamente cada uno de los productos comprados aquí. También puedes agregar ítems manualmente.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[#10141e] border border-[#222a3d]"
                  >
                    <span className="text-[10px] font-mono text-slate-500 w-4 text-center">#{idx + 1}</span>
                    <input
                      type="text"
                      placeholder="Descripción del ítem o producto..."
                      value={it.description}
                      onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                      className="flex-1 bg-transparent border-b border-transparent focus:border-blue-500 text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-[10px] text-slate-500">Cant:</span>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity || 1}
                        onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                        className="w-12 bg-[#161c28] border border-[#263146] rounded px-1.5 py-0.5 text-xs text-center text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-[10px] text-slate-500">Sub: $</span>
                      <input
                        type="number"
                        min="0"
                        value={it.subtotal || 0}
                        onChange={(e) => handleUpdateItem(idx, 'subtotal', e.target.value)}
                        className="w-20 bg-[#161c28] border border-[#263146] rounded px-1.5 py-0.5 text-xs text-right text-emerald-300 font-mono focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      title="Eliminar ítem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 4: Observaciones */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Detalle / Justificación del Gasto:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Objetivo o motivo del gasto operativo en sede Maipú o puestos..."
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2b364e] rounded-xl text-white resize-none focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b2232] text-slate-300 rounded-xl font-semibold cursor-pointer hover:bg-[#252f44] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#BE2629] hover:bg-[#a62b2e] text-white rounded-xl font-bold shadow transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Gasto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
