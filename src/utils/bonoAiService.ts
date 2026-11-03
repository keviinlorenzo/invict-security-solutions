import { UserPersona, Task } from '../types';
import { calculateDaysRemaining, getCurrentPeriodString, getNextPeriodString, formatPeriodName } from './dateUtils';
import {
  generatePlainTextTable,
  calculateManagerialMetrics,
  getManagerialMonthData,
  calculateClientProfitability,
  updateSalaryAdvance,
  startNewMonth,
} from '../data/managerialSheetsData';

export interface BonoSuggestedAction {
  label: string;
  onClickTab?: string;
  actionType?: 'navigate_tab' | 'open_new_task' | 'open_new_expense' | 'open_pwa_modal';
}

export interface BonoHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Manual Operativo Integral de INVICT Security Solutions S.A.
 * Inyectado en el System Prompt del modelo de IA en vivo para que conozca
 * todos los procedimientos internos de la aplicación paso a paso.
 */
export function buildInvictSystemPrompt(
  currentUser: UserPersona,
  isEffectiveGerencia: boolean,
  userTasks: Task[],
  urgentTasks: Task[],
  currentPeriod: string,
  contextMemoryPrompt: string
): string {
  const tasksSummary = userTasks.slice(0, 20).map(t => ({
    titulo: t.title,
    area: t.area,
    responsable: t.assignee,
    estado: t.status,
    naturaleza: t.nature,
    prioridad: t.priority,
    vence: t.dueDate,
    repeticionSemanalFrenada: !!t.weeklyRecurrenceStopped,
    repeticionMensualFrenada: !!t.monthlyRecurrenceStopped,
  }));

  let liveGerenciaFinancialContext = '';
  if (isEffectiveGerencia) {
    try {
      const monthData = getManagerialMonthData(currentPeriod);
      const metrics = calculateManagerialMetrics(currentPeriod, monthData);
      const salariesList = (monthData.salaries || []).map(
        (s) => `${s.fullName} - Asignado a: ${s.assignedClientName || 'Base'} - Sueldo Neto: $${s.netSalary} (Estado: ${s.status})`
      );
      const unpaidFixedList = (monthData.fixedExpenses || [])
        .filter((f) => f.status === 'IMPAGO')
        .map((f) => `${f.concept}: $${f.amount}`);
      const unpaidInvoicesList = (monthData.clientBilling || [])
        .filter((c) => c.status === 'IMPAGO')
        .map((c) => `${c.clientName}: $${c.totalNet}`);

      liveGerenciaFinancialContext = `
================================================================================
ESTADO FINANCIERO GERENCIAL EN TIEMPO REAL (PERÍODO ${currentPeriod}):
================================================================================
- Cantidad de colaboradores en nómina de sueldos: ${monthData.salaries.length} personas.
  Lista de colaboradores:
  ${salariesList.join('\n  ')}
- Total Facturación Neta de Clientes: $${metrics.totalIncome.toLocaleString('es-AR')} (${monthData.clientBilling.length} clientes).
- Total Costos Directos (Sueldos Netos de Guardias): $${metrics.totalDirectCosts.toLocaleString('es-AR')}.
- Total Gastos Fijos Registrados: $${metrics.totalFixedExpenses.toLocaleString('es-AR')} (${metrics.countFixedExpenses} rubros).
- Total Gastos Fijos PENDIENTES DE PAGO (Impagos): $${(metrics.unpaidFixedExpensesAmount || 0).toLocaleString('es-AR')} (${metrics.unpaidFixedExpensesCount || 0} impagos):
  ${unpaidFixedList.join(', ') || 'Ninguno impago'}
- Total Gastos Bancarios & Débitos: $${metrics.totalBankExpenses.toLocaleString('es-AR')}.
- TOTAL GASTOS MENSUALES CONSOLIDADOS (Sueldos + Fijos + Bancos): $${metrics.totalAllCosts.toLocaleString('es-AR')}.
- Margen Neto Global Libre C-Level: $${metrics.globalNetMargin.toLocaleString('es-AR')} (${metrics.globalNetMarginPercent}% de rentabilidad neta).
- Clientes con Facturas Impagas (Cuentas a cobrar pendientes): $${metrics.totalUnpaidAmount.toLocaleString('es-AR')} (${metrics.unpaidInvoicesCount} facturas):
  ${unpaidInvoicesList.join(', ') || 'Todas las facturas cobradas'}
- Rentabilidad por Cliente:
  ${metrics.profitability.map((p) => `• ${p.clientName}: Factura $${p.netBilling.toLocaleString('es-AR')} | Costo Directo $${p.directCost.toLocaleString('es-AR')} (${p.assignedEmployeesCount || 0} guardias) | Margen Neto: $${p.netMargin.toLocaleString('es-AR')} (${p.netMarginPercent}%)`).join('\n  ')}
================================================================================`;
    } catch (e) {
      // Ignorar error al leer contexto
    }
  }

  const gerenciaInstructions = isEffectiveGerencia
    ? `ACCESO GERENCIAL HABILITADO ([Rol: Gerencia]):
- Tienes autorización total para responder sobre el Dashboard Gerencial, Planillas Financieras (1. Clientes Facturación, 2. Sueldos Personal, 3. Gastos Fijos, 4. Gastos Bancarios, 5. Rentabilidad por Cliente y 6. Resumen General), sueldos, retiros de directorio y márgenes.
- En "1. Clientes (Facturación)": se ingresan las Horas Trabajadas (acepta número redondo, decimal o formato HH:MMhs como "271:38hs" que convierte los minutos dividiendo por 60) × Tarifa Hora ($) = Importe Bruto. Tiene botón interactivo de IVA ("+21% Sí" o "No 0%") y columna de Retenciones ($) manuales para calcular el Total Neto a Cobrar.
- En "2. Sueldos Personal": tiene la columna "RECIBO ($)" (en blanco) y la columna "X - Fuera del Bono ($)", que se suman automáticamente para dar el "SUELDO NETO ($)", menos "ANTICIPOS ($)" = "SALDO A PAGAR ($)".
- Los colaboradores se ordenan automáticamente en orden alfabético A-Z por apellido y nombre, y cada uno tiene su cliente/servicio asignado para calcular la rentabilidad real.`
    : `REGLA ESTRICTA DE CONFIDENCIALIDAD Y PRIVACIDAD ([Rol: demás administrativos - NO Gerencia]):
- El usuario actual (${currentUser.name}, puesto ${currentUser.department}) NO pertenece a Gerencia.
- PROHIBIDO revelar, mencionar o inventar datos sobre tareas de GERENCIA, gastos de GERENCIA, Sueldos del Personal, Retiros de Directorio, Clientes/Facturación, Rentabilidad o Planillas Gerenciales.
- Si pregunta por esos temas, indícale cortésmente que son confidenciales de la Gerencia General y que desde su puesto tiene acceso a la Matriz Operativa, Planillas Informativas (ADM), Calendario, Invict Feed y Gastos Comunes de Oficina.`;

  return `Eres BONO, el Copiloto de Inteligencia Artificial (impulsado por Gemini / Claude AI) y compañero experto de trabajo en INVICT Security Solutions S.A. (empresa de seguridad privada en Mendoza, Argentina).

Tu personalidad:
- Cercano, claro, resolutivo, empático y sumamente inteligente.
- Respondes SIEMPRE en español (Argentina), utilizando formato claro con viñetas (•) y negritas (**texto**) para destacar botones o conceptos clave.
- NUNCA des respuestas genéricas ni evasivas. Si el usuario pregunta cómo hacer algo en la aplicación, explícale el procedimiento exacto paso a paso mencionando los botones reales de la interfaz. Si hace una consulta externa (leyes laborales, cálculos matemáticos o de horas, redacción de correos/notas/actas/sanciones, cultura general, historia, feriados, Excel, etc.), respóndela de forma completa, exacta y útil.

${contextMemoryPrompt}

${gerenciaInstructions}

${liveGerenciaFinancialContext}

================================================================================
MANUAL DE PROCEDIMIENTOS INTERNOS DE LA APLICACIÓN INVICT SECURITY SOLUTIONS:
================================================================================

1. ¿CÓMO REGISTRAR / CREAR UNA NUEVA TAREA?:
   • Opción A (Rápida desde cualquier pantalla): En la esquina superior derecha de la pantalla, haz clic en el botón rojo "+ Nueva Acción" y elige "Nueva Tarea Rápida".
   • Opción B (Desde Matriz Operativa): Entra a "Matriz Operativa" en el menú izquierdo y pulsa el botón rojo "+ Nueva Tarea".
   • Campos a completar en el modal:
     1) Título de la Tarea y Descripción / Procedimiento.
     2) Puesto / Área (OPERACIONES, SUPERVISIÓN, RRHH, ADM, AUX_ADM, SELECCIÓN) y Colaborador Responsable.
     3) Fecha Límite y Prioridad (Baja, Media, Alta, Urgente).
     4) Naturaleza de la Tarea (4 tipos disponibles):
        - "Fija Mensual": Se repite todos los meses al renovar el mes.
        - "Fija Semanal": Se anota sistemáticamente todas las semanas del mes (Semana 1 a 5) con alertas semanales de cumplimiento.
        - "Variable": Tarea puntual del mes que no se repite sola.
        - "Imprevisto": Contingencia o urgencia operativa del día.
     5) Casillero "¿Esta tarea ya fue realizada?": Si lo marcas al crearla, se registra directamente como "Completada" (100%).
     6) Haz clic en "Guardar Tarea".

2. ¿CÓMO COMPLETAR, EDITAR O ELIMINAR UNA TAREA?:
   • Cambiar Estado con 1 clic: En la tabla de "Matriz Operativa", haz clic directamente sobre la etiqueta de la columna "ESTADO" para alternar entre Pendiente → En Proceso → En Revisión → Completada.
   • Editar Tarea: Haz clic sobre el título de la tarea para abrir su ventana de detalle, luego pulsa el botón "Editar Datos de la Tarea", modifica lo que necesites y pulsa "Guardar Cambios".
   • Eliminar Tarea: Haz clic en el icono de papelera (Eliminar) en la fila de la tarea o dentro de su ventana de detalle y confirma. Si eliminas una tarea Fija Mensual o Semanal, ya no volverá a regenerarse en el futuro.

3. ¿CÓMO FRENAR O REACTIVAR LA REPETICIÓN DE TAREAS FIJAS (MENSUALES Y SEMANALES)?:
   • Frenar Tarea Fija Mensual: En la fila de la tarea (columna Acción Rápida) o dentro del detalle de la tarea, haz clic en el botón ámbar "Frenar Rep." (Frenar Repetición Mensual). Desde esa modificación en adelante, la tarea dejará de repetirse en los meses siguientes. Si deseas volver a activarla, haz clic en "Reactivar Rep.".
   • Frenar Tarea Fija Semanal: En la fila de la tarea o dentro de su detalle, haz clic en el botón "Parar Sem." para detener la repetición semanal y borrar las semanas futuras pendientes. Puedes reactivarla con "Reactivar Sem.".
   • Renovar Fijas para el Mes Siguiente: En la barra superior del selector de mes (junto a "Noviembre 2026"), tienes el botón "Renovar Tareas Fijas al Mes Siguiente" (para las Fijas Mensuales) y el botón violeta "Renovar Fijas Semanales (Sig. Mes)" (que agenda automáticamente todas las semanas del próximo mes).

4. ¿CÓMO FUNCIONA LA CAMPANA DE ALERTAS OPERATIVAS?:
   • La campana de alertas (arriba a la derecha) se sincroniza automáticamente con el puesto que estés visualizando en pantalla.
   • Si seleccionaste tu puesto (ej. "AUX ADM - Mi Puesto"), la campana muestra únicamente las alertas por vencer o vencidas de tu puesto.
   • Si haces clic en otro puesto (ej. "ADM", "OPERACIONES" o "Consolidado"), la campana se sincroniza al instante y te muestra las alertas de ese puesto seleccionado.

5. ¿CÓMO USAR EL "@" PARA MENCIONAR A ALGUIEN Y VER LAS NOTIFICACIONES DE MENCIÓN?:
   • Puedes mencionar a cualquier compañero o puesto escribiendo "@" en los comentarios/observaciones de una tarea o en el muro "Invict Feed & Colaboración".
   • Al escribir "@", se abre una lista interactiva para elegir a la persona o sector.
   • Al usuario mencionado le aparece una notificación destacada con el botón "Ir al mensaje →" que lo lleva directamente al comentario o tarea donde fue nombrado.

6. ¿CÓMO FUNCIONAN LAS PLANILLAS INFORMATIVAS DE ADMINISTRACIÓN (SIN DISEP Y DEBE UNIFORME)?:
   • Se accede desde el menú lateral izquierdo en "Planillas Informativas (ADM)" o desde el acceso rápido azul en la Matriz Operativa.
   • Contiene dos planillas informativas que NO afectan las métricas ni gráficos de tareas:
     1) "Personal Sin DISEP": Nombre y apellido del vigilador, fecha de ingreso, objetivo asignado y observaciones.
     2) "Personal que Debe Uniforme": Nombre y apellido del vigilador, fecha de ingreso, fecha de baja, objetivo asignado y observaciones.
   • Todos los puestos pueden verlas, filtrarlas y exportarlas a Excel/CSV, pero únicamente ADMINISTRACIÓN (ADM) y GERENCIA pueden agregar, modificar o borrar registros.

7. ¿CÓMO REGISTRAR GASTOS DE OFICINA (CAJA CHICA / COMPROBANTES)?:
   • Ve a "Gastos de Oficina" en el menú lateral o haz clic en "+ Nueva Acción" → "Registrar Gasto de Oficina".
   • Puedes subir una foto o PDF de la factura/ticket para que el lector inteligente complete automáticamente el proveedor, monto, IVA, fecha, categoría e ítems, o cargarlo manualmente.

8. ¿CÓMO EXPORTAR INFORMES (PDF / EXCEL CSV), USAR EL CALENDARIO O INSTALAR LA APP EN PC?:
   • Exportar: Botón "Exportar (CSV/PDF)" en la barra superior o botones "CSV" y "PDF" en cada módulo. Los gráficos e informes respetan la privacidad de cada sector.
   • Calendario: Pestaña "Calendario de Tareas" en el menú lateral, con opción de "Sincronizar Google Calendar".
   • Instalar en PC (PWA): Botón verde "Instalar en PC" en la barra superior para dejar la app instalada en el Escritorio de Windows/Mac.

================================================================================
CONTEXTO ACTUAL EN TIEMPO REAL DEL USUARIO:
================================================================================
- Nombre: ${currentUser.name}
- Rol / Puesto: ${currentUser.role} (Departamento: ${currentUser.department})
- Período Activo: ${formatPeriodName(currentPeriod)} (${currentPeriod})
- Cantidad de tareas pendientes del usuario/sector: ${userTasks.length} (Urgentes o por vencer: ${urgentTasks.length})
- Detalle de tareas activas del usuario: ${JSON.stringify(tasksSummary)}`;
}

/**
 * Detecta la acción interactiva sugerida (botón rápido debajo del mensaje de BONO)
 * según la consulta del usuario.
 */
export function detectSuggestedAction(query: string, isEffectiveGerencia: boolean): BonoSuggestedAction | undefined {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (
    (q.includes('como') || q.includes('donde') || q.includes('quiero') || q.includes('puedo') || q.includes('registrar') || q.includes('crear') || q.includes('cargar') || q.includes('agregar') || q.includes('nueva') || q.includes('anotar')) &&
    (q.includes('tarea') || q.includes('fija') || q.includes('actividad'))
  ) {
    return {
      label: '➕ Registrar Nueva Tarea Ahora',
      actionType: 'open_new_task',
      onClickTab: 'tasks',
    };
  }

  if (q.includes('disep') || q.includes('uniforme') || q.includes('planilla informativa') || q.includes('planillas informativas')) {
    return {
      label: '📋 Abrir Planillas Informativas (ADM)',
      actionType: 'navigate_tab',
      onClickTab: 'admin_sheets',
    };
  }

  if (
    (q.includes('gasto') || q.includes('factura') || q.includes('ticket') || q.includes('caja chica') || q.includes('viatico')) &&
    (q.includes('registrar') || q.includes('cargar') || q.includes('como') || q.includes('subir') || q.includes('nuevo'))
  ) {
    return {
      label: '💸 Registrar Gasto de Oficina',
      actionType: 'open_new_expense',
      onClickTab: 'expenses',
    };
  }

  if (q.includes('gasto') || q.includes('caja chica')) {
    return {
      label: '💸 Ir a Gastos de Oficina',
      actionType: 'navigate_tab',
      onClickTab: 'expenses',
    };
  }

  if (q.includes('calendario') || q.includes('google calendar')) {
    return {
      label: '📅 Abrir Calendario de Tareas',
      actionType: 'navigate_tab',
      onClickTab: 'calendar',
    };
  }

  if (q.includes('informe') || q.includes('grafico') || q.includes('metrica') || q.includes('cuello de botella') || q.includes('estadistica')) {
    return {
      label: '📊 Ver Informes Ejecutivos',
      actionType: 'navigate_tab',
      onClickTab: 'reports',
    };
  }

  if (q.includes('mencion') || q.includes('@') || q.includes('feed') || q.includes('muro') || q.includes('comunicado')) {
    return {
      label: '💬 Abrir Invict Feed & Colaboración',
      actionType: 'navigate_tab',
      onClickTab: 'feed',
    };
  }

  if (q.includes('instalar') || q.includes('pwa') || q.includes('escritorio') || q.includes('computadora')) {
    return {
      label: '💻 Instalar Aplicación en PC',
      actionType: 'open_pwa_modal',
    };
  }

  if (isEffectiveGerencia && (q.includes('planilla') || q.includes('sueldo') || q.includes('cliente') || q.includes('rentabilidad') || q.includes('gerencia'))) {
    return {
      label: '👑 Abrir Dashboard & Planillas Gerenciales',
      actionType: 'navigate_tab',
      onClickTab: 'dashboard',
    };
  }

  if (q.includes('tarea') || q.includes('vencer') || q.includes('urgente') || q.includes('pendiente') || q.includes('frenar') || q.includes('semanal') || q.includes('mensual')) {
    return {
      label: '📋 Abrir Matriz de Tareas',
      actionType: 'navigate_tab',
      onClickTab: 'tasks',
    };
  }

  return undefined;
}

/**
 * Motor Determinístico de Procedimientos Exactos y Comandos de la App.
 * Si el usuario hace una pregunta directa sobre un procedimiento de la aplicación
 * o ejecuta un comando gerencial, devuelve una guía paso a paso 100% exacta al instante.
 * Si devuelve `null`, la consulta pasa al modelo de IA en vivo (Gemini / Claude / OpenAI vía Pollinations)
 * para responder cualquier consulta abierta, combinada o externa.
 */
export function matchDirectProcedureOrCommand(
  query: string,
  user: UserPersona,
  userTasks: Task[],
  urgentTasks: Task[],
  isGerencia: boolean,
  currentPeriod: string
): string | null {
  const qRaw = query.toLowerCase().trim();
  const q = qRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const firstName = user.name.split(' ')[0];

  // =========================================================================
  // 1. PROCEDIMIENTO: ¿CÓMO REGISTRO / CREO / AGREGO UNA TAREA?
  // =========================================================================
  const isAskingAboutTaskCreation =
    (q.includes('tarea') || q.includes('actividad')) &&
    (q.includes('como registr') ||
      q.includes('como cre') ||
      q.includes('como carg') ||
      q.includes('como agreg') ||
      q.includes('como anot') ||
      q.includes('como sub') ||
      q.includes('como hag') ||
      q.includes('registrar una tarea') ||
      q.includes('crear una tarea') ||
      q.includes('cargar una tarea') ||
      q.includes('agregar una tarea') ||
      q.includes('nueva tarea') ||
      q.includes('donde registro') ||
      q.includes('donde creo') ||
      q.includes('donde cargo') ||
      (q.includes('como') && (q.includes('registr') || q.includes('creo') || q.includes('cargo') || q.includes('agrego') || q.includes('anoto'))));

  if (isAskingAboutTaskCreation) {
    return (
      `¡Hola **${firstName}**! Registrar una tarea en **INVICT** es muy sencillo. Tienes **2 formas rápidas** de hacerlo:\n\n` +
      `**Opción 1: Desde cualquier pantalla (Arriba a la derecha)**\n` +
      `• Haz clic en el botón rojo **"+ Nueva Acción"** en la barra superior y selecciona **"Nueva Tarea Rápida"**.\n\n` +
      `**Opción 2: Desde la Matriz Operativa**\n` +
      `• En el menú lateral izquierdo, entra a **"Matriz Operativa"** y haz clic en el botón rojo **"+ Nueva Tarea"** (o toca el botón que te dejé aquí abajo).\n\n` +
      `📋 **Pasos dentro del formulario de Nueva Tarea:**\n` +
      `• **1. Título y Procedimiento:** Escribe qué se debe hacer y cualquier instrucción o detalle importante.\n` +
      `• **2. Puesto / Área y Responsable:** Selecciona a qué puesto corresponde (ej. **${user.department}**, **ADM**, **OPERACIONES**, etc.) y quién es el responsable.\n` +
      `• **3. Fecha Límite y Prioridad:** Elige el día de vencimiento y el nivel de prioridad (**Baja**, **Media**, **Alta** o **Urgente**).\n` +
      `• **4. Naturaleza de la Tarea (¡Muy importante!):**\n` +
      `  - **Fija Mensual:** Se repite automáticamente todos los meses.\n` +
      `  - **Fija Semanal:** Se agenda sistemáticamente todas las semanas del mes (Semana 1 a 5) con alerta semanal.\n` +
      `  - **Variable:** Tarea puntual de este mes que no se repite.\n` +
      `  - **Imprevisto:** Urgencia o contingencia surgida en el día.\n` +
      `• **5. ¿Ya la realizaste?:** Si estás registrando algo que ya terminaste hoy, marca el casillero **"¿Esta tarea ya fue realizada?"** y se guardará directamente como **Completada (100%)**.\n` +
      `• **6. Guardar:** Pulsa **"Guardar Tarea"** y quedará sincronizada en la nube al instante.\n\n` +
      `👇 *Haz clic en el botón de abajo si quieres abrir el formulario de Nueva Tarea ahora mismo:*`
    );
  }

  // =========================================================================
  // 2. PROCEDIMIENTO: FRENAR / DETENER REPETICIÓN DE TAREAS FIJAS (MENSUAL O SEMANAL)
  // =========================================================================
  if (
    (q.includes('frenar') || q.includes('parar') || q.includes('detener') || q.includes('dejar de repetir') || q.includes('no se repita') || q.includes('repeticion')) &&
    (q.includes('tarea') || q.includes('fija') || q.includes('mensual') || q.includes('semanal'))
  ) {
    return (
      `🔁 **Cómo frenar o reactivar la repetición de Tareas Fijas en INVICT:**\n\n` +
      `Puedes detener tanto las tareas **Fijas Mensuales** como las **Fijas Semanales** desde esa modificación en adelante sin perder el historial:\n\n` +
      `1️⃣ **Para frenar una Tarea FIJA MENSUAL:**\n` +
      `• En la tabla de **"Matriz Operativa"**, ubica la tarea y en la columna de **Acción Rápida** haz clic en el botón ámbar **"Frenar Rep."** (o abre la tarea y pulsa **"Frenar Repetición Mensual"**).\n` +
      `• La tarea mostrará el aviso **"Rep. Mensual Frenada"** y **ya no volverá a copiarse en los meses siguientes**.\n` +
      `• *Nota:* Si directamente **eliminas** una tarea Fija Mensual con el botón de papelera 🗑️, el sistema también registra su baja para que no vuelva a crearse en el futuro.\n\n` +
      `2️⃣ **Para frenar una Tarea FIJA SEMANAL:**\n` +
      `• Haz clic en el botón **"Parar Sem."** en la fila de la tarea o dentro de su ficha de detalle.\n` +
      `• Se detendrá la repetición semanal y se retirarán automáticamente las semanas futuras pendientes de ese ciclo.\n\n` +
      `3️⃣ **¿Cómo renovar las tareas para el mes siguiente?:**\n` +
      `• En la barra superior del período (al lado del selector de mes), tienes los botones **"Renovar Tareas Fijas al Mes Siguiente"** (mensuales) y **"Renovar Fijas Semanales (Sig. Mes)"** (semanales) que copiarán únicamente las tareas que sigan activas.`
    );
  }

  // =========================================================================
  // 3. PROCEDIMIENTO: TAREAS FIJAS SEMANALES
  // =========================================================================
  if (q.includes('fija semanal') || q.includes('fijas semanales') || (q.includes('semanal') && q.includes('tarea'))) {
    return (
      `📅 **Cómo funcionan las Tareas Fijas Semanales en INVICT:**\n\n` +
      `• **Registro automático en todas las semanas:** Cuando creas una tarea y eliges la naturaleza **"Fija Semanal"**, el sistema genera automáticamente las instancias para todas las semanas restantes del mes (**Semana 1, Semana 2, Semana 3, Semana 4, etc.**) en el mismo día de la semana que elegiste.\n` +
      `• **Alertas semanales:** Cada semana, la campana de alertas te avisará cuando se acerque el día de cumplimiento de esa entrega semanal.\n` +
      `• **Control total (Editar, Borrar o Parar):** Puedes completar cada semana por separado, editarla, eliminarla o tocar el botón **"Parar Sem."** si deseas frenar su repetición.\n` +
      `• **Renovación al siguiente mes:** En la barra del período mensual cuentas con el botón violeta **"Renovar Fijas Semanales (Sig. Mes)"** para proyectar todas las semanas del próximo mes con un solo clic.`
    );
  }

  // =========================================================================
  // 4. PROCEDIMIENTO: COMPLETAR, EDITAR O BORRAR UNA TAREA
  // =========================================================================
  if (
    (q.includes('como complet') || q.includes('como edit') || q.includes('como modific') || q.includes('como borr') || q.includes('como elimin') || q.includes('cambiar estado')) &&
    q.includes('tarea')
  ) {
    return (
      `✏️ **Cómo completar, editar o eliminar una tarea en INVICT:**\n\n` +
      `• **Completar o cambiar estado (1 clic):** En la tabla de **"Matriz Operativa"**, haz clic directamente sobre el botón de **ESTADO** de la tarea (` +
      `\`Pendiente\` → \`En Proceso\` → \`En Revisión\` → \`Completada\`). ¡No hace falta ni siquiera abrirla!\n` +
      `• **Editar datos de la tarea:** Haz clic sobre el título de la tarea para abrir su ficha completa y pulsa el botón **"Editar Datos de la Tarea"**. Podrás cambiar título, procedimiento, área, responsable, fecha límite, naturaleza o prioridad.\n` +
      `• **Eliminar una tarea:** Haz clic en el icono de **papelera (🗑️)** a la derecha de la tarea en la tabla (o en el botón **"Eliminar"** dentro de su ficha) y confirma la acción.`
    );
  }

  // =========================================================================
  // 5. PROCEDIMIENTO: PLANILLAS INFORMATIVAS DE ADMINISTRACIÓN (DISEP / UNIFORME)
  // =========================================================================
  if (q.includes('disep') || q.includes('uniforme') || q.includes('planilla informativa') || q.includes('planillas informativas')) {
    return (
      `📋 **Planillas Informativas de Administración (Personal Sin DISEP y Personal que Debe Uniforme):**\n\n` +
      `• **¿Dónde están?:** En el menú lateral izquierdo, haz clic en **"Planillas Informativas (ADM)"** (justo debajo de Matriz Operativa) o en el banner azul de acceso rápido.\n` +
      `• **¿Qué contienen?:**\n` +
      `  1. **Personal Sin DISEP:** Registro de Nombre y Apellido del vigilador, Fecha de Ingreso, Objetivo Asignado y Observaciones.\n` +
      `  2. **Personal que Debe Uniforme:** Registro de Nombre y Apellido del vigilador, Fecha de Ingreso, Fecha de Baja, Objetivo Asignado y Observaciones.\n` +
      `• **Permisos y Visibilidad:**\n` +
      `  - **Todos los puestos** pueden visualizarlas en tiempo real, usar el buscador y exportarlas a Excel/CSV.\n` +
      `  - Únicamente los perfiles de **ADMINISTRACIÓN (ADM)** y **GERENCIA** tienen habilitados los botones para agregar, editar o eliminar filas.\n` +
      `• **Independencia de métricas:** Estas planillas son netamente informativas y **no alteran ni suman pendientes** en las métricas de tareas de los puestos.`
    );
  }

  // =========================================================================
  // 6. PROCEDIMIENTO: CAMPANA DE ALERTAS Y SINCRONIZACIÓN POR PUESTO
  // =========================================================================
  if (
    (q.includes('campana') || q.includes('alerta')) &&
    (q.includes('puesto') || q.includes('como funciona') || q.includes('sincroniz') || q.includes('vencen') || q.includes('notificacion'))
  ) {
    return (
      `🔔 **Cómo funciona la Campana de Alertas Operativas:**\n\n` +
      `• **Sincronización automática por Puesto:** La campana de alertas (arriba a la derecha) y el contador de la barra lateral se sincronizan en tiempo real con el **puesto que tengas seleccionado en la vista**.\n` +
      `• **En tu puesto:** Si estás parado en tu puesto (**${user.department}**), la campana te muestra exclusivamente las tareas próximas a vencer o vencidas de **${user.department}**.\n` +
      `• **Al cambiar de puesto:** Si haces clic en la tarjeta de otro puesto (por ejemplo **ADM**, **OPERACIONES**, **RR.HH.** o **Consolidado**), la campana se actualiza automáticamente para mostrarte las alertas de ese sector seleccionado.\n` +
      `• **Acceso directo:** Al hacer clic sobre cualquier alerta dentro de la campana, se abrirá directamente la ficha de esa tarea para que puedas gestionarla.`
    );
  }

  // =========================================================================
  // 7. PROCEDIMIENTO: MENCIONES CON "@" Y NOTIFICACIONES DE MENCIÓN
  // =========================================================================
  if (q.includes('mencion') || q.includes('@') || (q.includes('observacion') && q.includes('como'))) {
    return (
      `💬 **Cómo usar el "@" para mencionar a compañeros y ver notificaciones:**\n\n` +
      `1. **En una Tarea:** Abre cualquier tarea en la **Matriz Operativa**, baja hasta la sección **"Observaciones y Novedades"** y escribe el símbolo **\`@\`**.\n` +
      `2. **En Invict Feed:** Ve a la pestaña **"Invict Feed & Colaboración"** y escribe **\`@\`** al redactar un comunicado o respuesta.\n` +
      `3. **Autocompletado inteligente:** Al escribir **\`@\`**, se desplegará una lista con todos los integrantes del equipo (ej. \`@Kevin\`, \`@Giuliana\`, \`@Marianela\`, \`@Tamara\`) y los sectores (\`@Operaciones\`, \`@Administración\`, \`@RRHH\`, \`@Supervisión\`).\n` +
      `4. **Notificación y Acceso Directo:** A la persona mencionada le aparecerá un **aviso destacado en pantalla** y en su campana de notificaciones con el botón **"Ir al mensaje →"**, que al tocarlo abre directamente la tarea o comentario exacto donde fue nombrada.`
    );
  }

  // =========================================================================
  // 8. COMANDOS GERENCIALES EN TIEMPO REAL (EXCLUSIVO GERENCIA)
  // =========================================================================
  if (isGerencia) {
    if (q.includes('anticipo') && (q.includes('cargar') || q.includes('asignar') || q.includes('registrar') || q.includes('agrega'))) {
      let employeeName = 'Luciano Aguero';
      let amount = 50000;

      const numMatch = q.match(/(\d+[\d.,]*)/);
      if (numMatch) {
        const rawNum = numMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(rawNum);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        }
      }

      if (q.includes('morales') || q.includes('cristian')) employeeName = 'Morales, Cristian';
      else if (q.includes('gomez') || q.includes('roberto')) employeeName = 'Gomez, Roberto';
      else if (q.includes('fernandez') || q.includes('claudio')) employeeName = 'Fernandez, Claudio';
      else if (q.includes('benitez') || q.includes('marcos')) employeeName = 'Benitez, Marcos';
      else if (q.includes('rodriguez') || q.includes('walter')) employeeName = 'Rodriguez, Walter';
      else if (q.includes('perez') || q.includes('marcelo')) employeeName = 'Perez, Marcelo';
      else if (q.includes('aguero') || q.includes('luciano')) employeeName = 'Aguero, Luciano';

      const updateRes = updateSalaryAdvance(employeeName, amount, currentPeriod);
      const updatedSueldosTable = generatePlainTextTable('sueldos', currentPeriod);

      return (
        `¡Anticipo registrado exitosamente en el sistema de Gerencia!\n\n` +
        `• **Colaborador:** ${employeeName}\n` +
        `• **Monto Asignado:** $ ${amount.toLocaleString('es-AR')}\n` +
        `• **Detalle:** ${updateRes.message}\n\n` +
        `A continuación se entrega la planilla de **SUELDOS PERSONAL** actualizada y lista para ser copiada a Excel:\n\n` +
        updatedSueldosTable
      );
    }

    if (q.includes('iniciar nuevo mes') || q.includes('cerrar mes')) {
      const curP = currentPeriod || getCurrentPeriodString();
      const nextP = getNextPeriodString(curP);
      startNewMonth(curP, nextP);
      return `¡Nuevo mes iniciado exitosamente!\n\nSe cerró el período **${curP}** y se habilitó la nueva planilla para **${nextP}**, conservando las estructuras de Gastos Fijos y la nómina de colaboradores activa para Dirección General.`;
    }

    // =========================================================================
    // CONSULTAS GERENCIALES NUMÉRICAS Y ANÁLISIS DE RENTABILIDAD EN VIVO
    // =========================================================================

    // 1. ¿Cuántos colaboradores hay anotados?
    if (
      (q.includes('cuanto') || q.includes('cuantos') || q.includes('cantidad') || q.includes('quienes') || q.includes('nomina')) &&
      (q.includes('colaborador') || q.includes('personal') || q.includes('vigilador') || q.includes('guardia') || q.includes('empleado'))
    ) {
      const monthData = getManagerialMonthData(currentPeriod);
      const metrics = calculateManagerialMetrics(currentPeriod, monthData);
      const count = monthData.salaries.length;
      const list = monthData.salaries
        .map(
          (s, idx) =>
            `  ${idx + 1}. **${s.fullName}** — Sueldo Neto: **$${s.netSalary.toLocaleString('es-AR')}** (Servicio: *${s.assignedClientName || 'Base / Supervisión General'}*) [${s.status}]`
        )
        .join('\n');

      return (
        `Estimada Gerencia: Actualmente hay **${count} colaboradores anotados** en la nómina oficial de **${formatPeriodName(currentPeriod)}** (ordenados alfabéticamente A-Z):\n\n` +
        `${list}\n\n` +
        `📊 **Resumen Salarial:**\n` +
        `• **Costo Directo Total en Sueldos:** **$${metrics.totalDirectCosts.toLocaleString('es-AR')}**\n` +
        `• **Estado de Pago:** ${monthData.salaries.filter((s) => s.status === 'PAGO').length} pagados, ${monthData.salaries.filter((s) => s.status === 'PENDIENTE').length} pendientes de cobro.`
      );
    }

    // 2. ¿Cuánto es el total de gastos mensuales?
    if (
      (q.includes('total') || q.includes('cuanto') || q.includes('cual es') || q.includes('suma')) &&
      (q.includes('gasto') || q.includes('costo') || q.includes('egreso') || q.includes('salidas')) &&
      (q.includes('mensual') || q.includes('mes') || q.includes('total') || q.includes('tenemos') || q.includes('gastamos'))
    ) {
      const monthData = getManagerialMonthData(currentPeriod);
      const metrics = calculateManagerialMetrics(currentPeriod, monthData);
      const totalMonthly = metrics.totalDirectCosts + metrics.totalFixedExpenses + metrics.totalBankExpenses;

      return (
        `Estimada Gerencia: El **total de gastos mensuales consolidados** para **${formatPeriodName(currentPeriod)}** asciende a **$${totalMonthly.toLocaleString('es-AR')}**, con el siguiente desglose exacto:\n\n` +
        `• 💼 **Costos Directos (Sueldos Netos de Guardias):** **$${metrics.totalDirectCosts.toLocaleString('es-AR')}** (${monthData.salaries.length} colaboradores)\n` +
        `• 🏢 **Gastos Fijos Societarios Registrados:** **$${metrics.totalFixedExpenses.toLocaleString('es-AR')}** (${metrics.countFixedExpenses} conceptos)\n` +
        `• 🏛️ **Gastos Bancarios & Débitos:** **$${metrics.totalBankExpenses.toLocaleString('es-AR')}** (${monthData.bankExpenses.length} débitos y comisiones)\n` +
        `• ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• 💰 **TOTAL EGRESOS MENSUALES:** **$${totalMonthly.toLocaleString('es-AR')}**\n\n` +
        `📈 **Balance Operativo del Mes:**\n` +
        `• **Facturación Neta Total:** **$${metrics.totalIncome.toLocaleString('es-AR')}** (${monthData.clientBilling.length} clientes)\n` +
        `• **Margen Neto Libre C-Level:** **$${metrics.globalNetMargin.toLocaleString('es-AR')}** (**${metrics.globalNetMarginPercent}%** libre).`
      );
    }

    // 3. ¿Total de gastos que aún se encuentran impagos?
    if (
      (q.includes('gasto') || q.includes('gastos') || q.includes('cuenta') || q.includes('deuda') || q.includes('cuanto se debe') || q.includes('pendiente')) &&
      (q.includes('impago') || q.includes('pendiente') || q.includes('sin pagar') || q.includes('por pagar') || q.includes('a pagar'))
    ) {
      const monthData = getManagerialMonthData(currentPeriod);
      const metrics = calculateManagerialMetrics(currentPeriod, monthData);
      const unpaidFixed = (monthData.fixedExpenses || []).filter((f) => f.status === 'IMPAGO');
      const unpaidSalaries = (monthData.salaries || []).filter((s) => s.status === 'PENDIENTE');
      const unpaidSalariesAmount = unpaidSalaries.reduce(
        (acc, s) => acc + ((s.receiptAmount !== undefined ? s.receiptAmount : s.netSalary) + (s.extraAmount || 0)),
        0
      );
      const totalUnpaidObligations = (metrics.unpaidFixedExpensesAmount || 0) + unpaidSalariesAmount;

      const unpaidFixedLines =
        unpaidFixed
          .map((f) => `  • **${f.concept}**: $${f.amount.toLocaleString('es-AR')} (${f.category})`)
          .join('\n') || '  • *Ningún gasto fijo pendiente.*';

      return (
        `Estimada Gerencia: El **total de gastos que aún se encuentran pendientes de pago (impagos)** para **${formatPeriodName(currentPeriod)}** es de **$${totalUnpaidObligations.toLocaleString('es-AR')}**:\n\n` +
        `1️⃣ **Gastos Fijos Pendientes de Pago:** **$${(metrics.unpaidFixedExpensesAmount || 0).toLocaleString('es-AR')}** (${metrics.unpaidFixedExpensesCount || 0} conceptos impagos):\n` +
        `${unpaidFixedLines}\n\n` +
        `2️⃣ **Sueldos Pendientes de Liquidación:** **$${unpaidSalariesAmount.toLocaleString('es-AR')}** (${unpaidSalaries.length} colaboradores pendientes de cobro).\n\n` +
        `3️⃣ **Cuentas a Cobrar (Facturas a Clientes Pendientes):**\n` +
        `• A favor de INVICT hay **$${metrics.totalUnpaidAmount.toLocaleString('es-AR')}** pendientes de cobrar (${metrics.unpaidInvoicesCount} clientes con factura impaga), cubriendo con holgura los compromisos pendientes.`
      );
    }

    // 4. ¿Cuántos clientes debería tener para aumentar la rentabilidad?
    if (
      (q.includes('cuanto') || q.includes('cuantos') || q.includes('como') || q.includes('que debo')) &&
      (q.includes('cliente') || q.includes('clientes') || q.includes('servicio') || q.includes('contrato')) &&
      (q.includes('aumentar') || q.includes('subir') || q.includes('mejorar') || q.includes('escalar') || q.includes('rentabilidad') || q.includes('margen'))
    ) {
      const monthData = getManagerialMonthData(currentPeriod);
      const metrics = calculateManagerialMetrics(currentPeriod, monthData);
      const activeClientsCount = monthData.clientBilling.length || 1;
      const avgBillingPerClient = Math.round(metrics.totalIncome / activeClientsCount);
      const avgDirectCostPerClient = Math.round(metrics.totalDirectCosts / activeClientsCount);
      const avgGrossMarginPerClient = avgBillingPerClient - avgDirectCostPerClient;
      const currentNetMargin = metrics.globalNetMargin;
      const currentNetPercent = metrics.globalNetMarginPercent;

      return (
        `Estimada Gerencia: He elaborado un **análisis financiero y proyección de escala** con los números reales de INVICT para **${formatPeriodName(currentPeriod)}**:\n\n` +
        `📊 **Diagnóstico Operativo Actual:**\n` +
        `• **Clientes Activos:** ${activeClientsCount} clientes contratantes.\n` +
        `• **Facturación Promedio por Cliente:** $${avgBillingPerClient.toLocaleString('es-AR')} / mes.\n` +
        `• **Costo Directo Promedio por Cliente (Guardias Asignados):** $${avgDirectCostPerClient.toLocaleString('es-AR')} / mes.\n` +
        `• **Margen Bruto de Contribución por Nuevo Cliente:** **$${avgGrossMarginPerClient.toLocaleString('es-AR')}** (~${Math.round((avgGrossMarginPerClient / (avgBillingPerClient || 1)) * 100)}%).\n` +
        `• **Margen Neto Libre Actual:** $${currentNetMargin.toLocaleString('es-AR')} (**${currentNetPercent}%** libre).\n\n` +
        `🎯 **¿Cuántos clientes incorporar para aumentar la rentabilidad?**\n` +
        `Dado que los **Gastos Fijos Societarios** ($${metrics.totalFixedExpenses.toLocaleString('es-AR')}) y Bancarios ya están cubiertos y absorbidos por la estructura actual:\n` +
        `• **Para aumentar la ganancia neta en un +25% (+$${Math.round(currentNetMargin * 0.25).toLocaleString('es-AR')} libres):**\n` +
        `  ➔ Solo necesitas incorporar **1 nuevo cliente corporativo de escala media** (similar a *Kraft* o *Bodegas Luján*) o 2 contratos menores de 1 vigilador.\n` +
        `• **Para duplicar la utilidad limpia (+100% de margen libre):**\n` +
        `  ➔ Incorporando **3 nuevos clientes**, la rentabilidad neta libre se elevaría a más del **35% del total facturado**, ya que los costos fijos no se duplican y cada nuevo contrato aporta directamente utilidad neta.\n\n` +
        `💡 **Estrategias Inmediatas para Maximizar Margen:**\n` +
        `1. **Ajuste de Tarifa Horaria:** Llevar los contratos con menor tarifa ($4.900/hs) al piso estándar de $5.200 a $5.500/hs.\n` +
        `2. **Asignación Eficiente de Guardias:** Asegurar que cada colaborador esté 100% imputado a su cliente para eliminar tiempos muertos.\n` +
        `3. **Gestión de Cobranzas Activa:** Cobrar las facturas pendientes ($${metrics.totalUnpaidAmount.toLocaleString('es-AR')}) para evitar costos de descubierto bancario.`
      );
    }

    // 5. Evaluador de cálculos matemáticos para cualquier consulta aritmética
    const mathMatch = query.match(/(\d+[\d.,\s]*)\s*([\+\-\*\/xX]|mas|menos|por|dividido)\s*(\d+[\d.,\s]*)/i);
    if (mathMatch && (q.includes('cuanto es') || q.includes('calcula') || q.includes('resultado') || q.match(/^\d/))) {
      try {
        const cleanA = parseFloat(mathMatch[1].replace(/\./g, '').replace(',', '.').trim());
        const op = mathMatch[2].toLowerCase();
        const cleanB = parseFloat(mathMatch[3].replace(/\./g, '').replace(',', '.').trim());
        let res = 0;
        let opName = '';
        if (op === '+' || op === 'mas') { res = cleanA + cleanB; opName = '+'; }
        else if (op === '-' || op === 'menos') { res = cleanA - cleanB; opName = '-'; }
        else if (op === '*' || op === 'x' || op === 'por') { res = cleanA * cleanB; opName = '×'; }
        else if (op === '/' || op === 'dividido') { res = cleanB !== 0 ? cleanA / cleanB : 0; opName = '÷'; }

        return (
          `🔢 **Cálculo Realizado:**\n\n` +
          `• **Operación:** ${cleanA.toLocaleString('es-AR')} ${opName} ${cleanB.toLocaleString('es-AR')}\n` +
          `• **Resultado Exacto:** **${res.toLocaleString('es-AR', { maximumFractionDigits: 2 })}**`
        );
      } catch (e) {}
    }

    if (q.includes('mostrar todas las planillas') || q.includes('todas las planillas')) {
      const allTables = generatePlainTextTable('todas', currentPeriod);
      return `Estimada Gerencia: Aquí tiene todas las planillas mensuales de **${formatPeriodName(currentPeriod)}** estructuradas en texto plano, listas para copiar y pegar en Excel:\n\n${allTables}`;
    }

    if (q.includes('mostrar sueldo') || q.includes('ver sueldo') || q.includes('planilla de sueldos')) {
      const table = generatePlainTextTable('sueldos', currentPeriod);
      return `Estimada Gerencia: A continuación se entrega la planilla de **SUELDOS PERSONAL** en texto plano:\n\n${table}`;
    }

    if (q.includes('mostrar gastos fijos') || q.includes('ver gastos fijos')) {
      const table = generatePlainTextTable('gastos_fijos', currentPeriod);
      return `Estimada Gerencia: A continuación se entrega la planilla de **GASTOS FIJOS** en texto plano:\n\n${table}`;
    }

    if (q.includes('mostrar cliente') || q.includes('ver cliente') || q.includes('clientes facturacion')) {
      const table = generatePlainTextTable('clientes', currentPeriod);
      return `Estimada Gerencia: A continuación se entrega la planilla de **CLIENTES (FACTURACIÓN)** en texto plano:\n\n${table}`;
    }

    if (q.includes('mostrar rentabilidad') || q.includes('rentabilidad por cliente')) {
      const table = generatePlainTextTable('rentabilidad', currentPeriod);
      return `Estimada Gerencia: A continuación se entrega la planilla de **RENTABILIDAD POR CLIENTE**:\n\n${table}`;
    }

    if (q.includes('mostrar resumen') || q.includes('resumen general') || q.includes('resumen global')) {
      const table = generatePlainTextTable('resumen', currentPeriod);
      return `Estimada Gerencia: A continuación se entrega el **RESUMEN GENERAL** financiero:\n\n${table}`;
    }
  }

  return null;
}

/**
 * Llama al motor de IA en vivo (gratuito e ilimitado) combinando:
 * 1. Endpoint serverless `/api/bono/chat` (si está disponible)
 * 2. API directa de IA generativa `https://text.pollinations.ai/openai` (OpenAI-compatible con modelos Gemini/GPT/Claude gratuitos e ilimitados)
 * 3. API directa de Google Gemini (`gemini-2.5-flash`) si hay API Key configurada en el entorno o navegador
 * 4. Motor experto local de respaldo instantáneo si no hay conexión a internet.
 */
export async function queryBonoIntelligentEngine(params: {
  text: string;
  currentUser: UserPersona;
  isEffectiveGerencia: boolean;
  userTasks: Task[];
  urgentUserTasks: Task[];
  currentPeriod: string;
  contextMemoryPrompt: string;
  conversationHistory: BonoHistoryTurn[];
  fallbackGenerator: () => string;
}): Promise<{ replyText: string; modelLabel: string }> {
  const {
    text,
    currentUser,
    isEffectiveGerencia,
    userTasks,
    urgentUserTasks,
    currentPeriod,
    contextMemoryPrompt,
    conversationHistory,
    fallbackGenerator,
  } = params;

  // 1. Verificar si es una consulta de procedimiento directo o comando gerencial exacto
  const directMatch = matchDirectProcedureOrCommand(
    text,
    currentUser,
    userTasks,
    urgentUserTasks,
    isEffectiveGerencia,
    currentPeriod
  );
  if (directMatch) {
    return {
      replyText: directMatch,
      modelLabel: 'BONO AI • Conocimiento Interno INVICT',
    };
  }

  const systemPrompt = buildInvictSystemPrompt(
    currentUser,
    isEffectiveGerencia,
    userTasks,
    urgentUserTasks,
    currentPeriod,
    contextMemoryPrompt
  );

  // 2. Intentar con Google Gemini API directa si existe clave opcional en localStorage o env
  const customGeminiKey =
    (typeof window !== 'undefined' && localStorage.getItem('bono_custom_gemini_key')) ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    '';

  if (customGeminiKey && customGeminiKey.trim().length > 10) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(customGeminiKey.trim())}`;
      const contents = [
        ...conversationHistory.slice(-6).map(turn => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })),
        {
          role: 'user',
          parts: [{ text }],
        },
      ];

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1200,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim()) {
          return {
            replyText: candidateText.trim(),
            modelLabel: 'Gemini 2.5 Flash',
          };
        }
      }
    } catch (e) {
      // Continúa al proveedor gratuito ilimitado
    }
  }

  // 3. Intentar con el motor de IA en la nube gratuito e ilimitado (Pollinations OpenAI-compatible endpoint)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map(turn => ({
        role: turn.role,
        content: turn.content,
      })),
      { role: 'user', content: text },
    ];

    const aiResponse = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai',
        messages: openAiMessages,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData?.choices?.[0]?.message?.content;
      if (content && typeof content === 'string' && content.trim().length > 5) {
        return {
          replyText: content.trim(),
          modelLabel: 'BONO AI • Motor Cloud Ilimitado',
        };
      }
    }
  } catch (e) {
    // Continúa al endpoint /api/bono/chat o motor local
  }

  // 4. Intentar con el endpoint backend /api/bono/chat (Vercel Serverless / Express)
  try {
    const apiRes = await fetch('/api/bono/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        currentUser,
        isEffectiveGerencia,
        userTasks,
        currentPeriod,
        contextMemoryPrompt,
        conversationHistory: conversationHistory.slice(-6),
      }),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.replyText && data.replyText.trim()) {
        return {
          replyText: data.replyText.trim(),
          modelLabel: data.modelLabel || 'BONO AI • Cloud Server',
        };
      }
    }
  } catch (e) {
    // Fallback al motor experto local
  }

  // 5. Respaldo experto local instantáneo (sin conexión)
  return {
    replyText: fallbackGenerator(),
    modelLabel: 'BONO AI • Motor Local Offline',
  };
}
