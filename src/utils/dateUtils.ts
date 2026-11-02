// Dynamically calculate current system date and period (e.g. 2026-10-15 and 2026-10)
export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCurrentPeriodString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getNextPeriodString(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Nota: se calculan al cargar la app. App.tsx recarga la página al cambiar el día
// para que siempre reflejen la fecha real.
export const DEFAULT_PERIOD = getCurrentPeriodString();
export const CURRENT_APP_DATE = getTodayDateString();

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function formatPeriodName(periodStr: string): string {
  if (!periodStr) periodStr = getCurrentPeriodString();
  const parts = periodStr.split('-');
  if (parts.length < 2) return periodStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTH_NAMES_ES[monthIdx] || parts[1];
  return `${monthName} ${year}`;
}

export function formatCurrentFullDate(): string {
  const d = new Date();
  const day = d.getDate();
  const monthName = MONTH_NAMES_ES[d.getMonth()] || 'Octubre';
  const year = d.getFullYear();
  return `${day} de ${monthName} de ${year}`;
}

export function getAdjacentPeriod(periodStr: string, delta: number): string {
  const parts = (periodStr || DEFAULT_PERIOD).split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  month += delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  const mm = month < 10 ? `0${month}` : `${month}`;
  return `${year}-${mm}`;
}

export function getAvailablePeriodsList(): { id: string; label: string }[] {
  const list: { id: string; label: string }[] = [];
  // From 2025-01 to 2027-12
  for (let y = 2025; y <= 2027; y++) {
    for (let m = 1; m <= 12; m++) {
      const mm = m < 10 ? `0${m}` : `${m}`;
      const id = `${y}-${mm}`;
      list.push({
        id,
        label: formatPeriodName(id),
      });
    }
  }
  return list;
}

export function calculateDaysRemaining(
  dueDateStr: string,
  completedDateStr?: string
): {
  days: number;
  label: string;
  badgeClass: string;
  status: 'completada' | 'vencida' | 'urgente_48h' | 'en_termino';
} {
  if (completedDateStr) {
    return {
      days: 0,
      label: 'Completada',
      badgeClass: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80',
      status: 'completada',
    };
  }
  if (!dueDateStr) {
    return {
      days: 999,
      label: 'Sin fecha',
      badgeClass: 'text-slate-400 bg-slate-900 border-slate-700',
      status: 'en_termino',
    };
  }
  // Parse YYYY-MM-DD or DD/MM/YYYY
  let dueTime = 0;
  if (dueDateStr.includes('/')) {
    const parts = dueDateStr.split('/');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    dueTime = new Date(y, m, d).getTime();
  } else {
    dueTime = new Date(dueDateStr + 'T23:59:59').getTime();
  }
  const todayStr = getTodayDateString();
  const now = new Date(todayStr + 'T12:00:00').getTime();
  const diffMs = dueTime - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      days,
      label: `Vencida (${Math.abs(days)}d)`,
      badgeClass: 'text-red-400 bg-red-950/80 border-red-800/80 font-bold',
      status: 'vencida',
    };
  } else if (days === 0) {
    return {
      days,
      label: 'Vence Hoy (<24h)',
      badgeClass: 'text-amber-300 bg-amber-950/80 border-amber-700/80 font-bold',
      status: 'urgente_48h',
    };
  } else if (days <= 2) {
    return {
      days,
      label: `${days}d restante${days > 1 ? 's' : ''} (48h)`,
      badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
      status: 'urgente_48h',
    };
  } else {
    return {
      days,
      label: `${days} días restantes`,
      badgeClass: 'text-slate-300 bg-[#161c28] border-[#252f44]',
      status: 'en_termino',
    };
  }
}

export function formatDateLocale(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatCurrencyARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface WeekRange {
  weekIndex: number;
  label: string;
  shortLabel: string;
  startDay: number;
  endDay: number;
  dateRangeStr: string;
}

export function getWeeksForPeriod(periodStr: string): WeekRange[] {
  const parts = (periodStr || DEFAULT_PERIOD).split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  return [
    { weekIndex: 1, label: 'Semana 1', shortLabel: 'Sem 1', startDay: 1, endDay: 7, dateRangeStr: '1-7' },
    { weekIndex: 2, label: 'Semana 2', shortLabel: 'Sem 2', startDay: 8, endDay: 14, dateRangeStr: '8-14' },
    { weekIndex: 3, label: 'Semana 3', shortLabel: 'Sem 3', startDay: 15, endDay: 21, dateRangeStr: '15-21' },
    { weekIndex: 4, label: 'Semana 4', shortLabel: 'Sem 4', startDay: 22, endDay: Math.min(28, daysInMonth), dateRangeStr: `22-${Math.min(28, daysInMonth)}` },
    ...(daysInMonth > 28 ? [
      { weekIndex: 5, label: 'Semana 5 / Cierre', shortLabel: 'Sem 5', startDay: 29, endDay: daysInMonth, dateRangeStr: `29-${daysInMonth}` }
    ] : []),
  ];
}

export function getWeekIndexForDate(dateStr: string): number {
  if (!dateStr) return 1;
  let day = 1;
  if (dateStr.includes('/')) {
    day = parseInt(dateStr.split('/')[0], 10) || 1;
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    day = parseInt(parts[2], 10) || 1;
  }
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}
