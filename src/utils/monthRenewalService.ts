import { Task } from '../types';
import { STANDARD_FIXED_TASKS_TEMPLATE } from '../data/mockData';

const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function getDayOfWeekLabel(dayOfWeek?: number): string {
  if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) return 'Semanal';
  return DAY_NAMES_ES[dayOfWeek];
}

export function getDayOfWeekFromDateString(dateStr: string): number {
  const parts = (dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 1; // Default Lunes
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getDay();
}

/**
 * Obtiene todas las fechas YYYY-MM-DD de un mes (period = 'YYYY-MM') que caen en `dayOfWeek` (0..6).
 * Si se pasa `startFromDate` dentro del mismo mes, genera desde esa fecha cada 7 días hasta fin de mes.
 */
export function getWeeklyDatesForMonth(
  period: string,
  dayOfWeek: number,
  startFromDate?: string
): string[] {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1..12
  if (isNaN(year) || isNaN(month)) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];

  let minDay = 1;
  if (startFromDate && startFromDate.startsWith(`${period}-`)) {
    const startParts = startFromDate.split('-').map(Number);
    if (startParts[2] && !isNaN(startParts[2])) {
      minDay = startParts[2];
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === dayOfWeek && day >= minDay) {
      const dd = String(day).padStart(2, '0');
      dates.push(`${yearStr}-${monthStr}-${dd}`);
    }
  }

  // Si startFromDate no coincidía con dayOfWeek por algún motivo pero está en el mes, asegurar al menos desde startFromDate cada 7 días
  if (dates.length === 0 && startFromDate && startFromDate.startsWith(`${period}-`)) {
    for (let day = minDay; day <= daysInMonth; day += 7) {
      const dd = String(day).padStart(2, '0');
      dates.push(`${yearStr}-${monthStr}-${dd}`);
    }
  }

  return dates;
}

/**
 * Construye las instancias semanales de una tarea Fija Semanal para un período determinado.
 */
export function buildWeeklyTaskInstancesForMonth(
  baseTask: Omit<Task, 'id'>,
  targetPeriod: string,
  startFromDate?: string
): Task[] {
  const dayOfWeek =
    baseTask.weeklyDayOfWeek !== undefined
      ? baseTask.weeklyDayOfWeek
      : getDayOfWeekFromDateString(startFromDate || baseTask.dueDate);
  const seriesId = baseTask.weeklySeriesId || `wseries-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const allMonthDates = getWeeklyDatesForMonth(targetPeriod, dayOfWeek);
  const filteredDates = startFromDate
    ? getWeeklyDatesForMonth(targetPeriod, dayOfWeek, startFromDate)
    : allMonthDates;

  return filteredDates.map((dateStr, idx) => {
    const weekNum = allMonthDates.indexOf(dateStr) >= 0 ? allMonthDates.indexOf(dateStr) + 1 : idx + 1;
    return {
      ...baseTask,
      id: `task-wk-${targetPeriod}-s${weekNum}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nature: 'Fija Semanal',
      weeklySeriesId: seriesId,
      weeklyDayOfWeek: dayOfWeek,
      weeklyRecurrenceStopped: false,
      weekNumberInMonth: weekNum,
      monthPeriod: targetPeriod,
      startDate: dateStr,
      dueDate: dateStr,
      status: idx === 0 && baseTask.status === 'Completada' ? 'Completada' : 'No iniciada',
      completedDate: idx === 0 && baseTask.status === 'Completada' ? baseTask.completedDate : undefined,
      commentsCount: 0,
      comments: [],
    };
  });
}

/**
 * Renueva / proyecta todas las tareas Fijas Semanales activas (cuya repetición no fue detenida)
 * para todas las semanas del período `targetPeriod` (por ejemplo, el mes siguiente).
 */
export function renewWeeklyFixedTasksForPeriod(
  existingTasks: Task[],
  targetPeriod: string
): { updatedTasks: Task[]; addedCount: number; seriesCount: number } {
  const stoppedSeriesIds = new Set(
    existingTasks
      .filter(t => t.nature === 'Fija Semanal' && t.weeklyRecurrenceStopped && t.weeklySeriesId)
      .map(t => t.weeklySeriesId!)
  );

  const seriesMap = new Map<string, Task>();
  existingTasks.forEach(t => {
    if (t.nature !== 'Fija Semanal') return;
    if (t.weeklyRecurrenceStopped) return;
    if (t.weeklySeriesId && stoppedSeriesIds.has(t.weeklySeriesId)) return;
    const key = t.weeklySeriesId || `${t.area}::${t.title.toLowerCase().trim()}`;
    const prev = seriesMap.get(key);
    if (!prev || (t.monthPeriod || '') >= (prev.monthPeriod || '')) {
      seriesMap.set(key, t);
    }
  });

  if (seriesMap.size === 0) {
    return { updatedTasks: existingTasks, addedCount: 0, seriesCount: 0 };
  }

  const newWeeklyTasks: Task[] = [];

  seriesMap.forEach((templateTask, seriesKey) => {
    const dayOfWeek =
      templateTask.weeklyDayOfWeek !== undefined
        ? templateTask.weeklyDayOfWeek
        : getDayOfWeekFromDateString(templateTask.dueDate);
    const seriesId = templateTask.weeklySeriesId || seriesKey;
    const weekDates = getWeeklyDatesForMonth(targetPeriod, dayOfWeek);

    weekDates.forEach((dateStr, idx) => {
      const alreadyExists = existingTasks.some(
        existing =>
          existing.nature === 'Fija Semanal' &&
          (existing.monthPeriod || '2026-10') === targetPeriod &&
          existing.dueDate === dateStr &&
          (existing.weeklySeriesId === seriesId ||
            (existing.area === templateTask.area &&
              existing.title.toLowerCase().trim() === templateTask.title.toLowerCase().trim()))
      );

      if (!alreadyExists) {
        newWeeklyTasks.push({
          id: `task-wk-${targetPeriod}-w${idx + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          area: templateTask.area,
          title: templateTask.title,
          assignee: templateTask.assignee,
          assigneeEmail: templateTask.assigneeEmail,
          status: 'No iniciada',
          priority: templateTask.priority,
          nature: 'Fija Semanal',
          weeklySeriesId: seriesId,
          weeklyDayOfWeek: dayOfWeek,
          weeklyRecurrenceStopped: false,
          weekNumberInMonth: idx + 1,
          shiftType: templateTask.shiftType || 'General',
          objectiveLocation: templateTask.objectiveLocation || 'Base Central Maipú',
          monthPeriod: targetPeriod,
          startDate: dateStr,
          dueDate: dateStr,
          notes: templateTask.notes,
          category: templateTask.category || 'Administrativo',
          commentsCount: 0,
          comments: [],
        });
      }
    });
  });

  return {
    updatedTasks: [...existingTasks, ...newWeeklyTasks],
    addedCount: newWeeklyTasks.length,
    seriesCount: seriesMap.size,
  };
}

export function ensureMonthTasks(existingTasks: Task[], targetPeriod: string): Task[] {
  const periodTasks = existingTasks.filter(t => (t.monthPeriod || '2026-10') === targetPeriod);
  let result = [...existingTasks];

  if (periodTasks.length === 0) {
    const [yearStr, monthStr] = targetPeriod.split('-');
    const newTasks: Task[] = STANDARD_FIXED_TASKS_TEMPLATE.map((template, idx) => {
      const startDay = template.startDate || '01';
      const dueDay = template.dueDate || '15';
      return {
        id: `task-${targetPeriod}-${idx + 1}-${Date.now()}`,
        area: template.area,
        title: template.title,
        assignee: template.assignee,
        assigneeEmail: template.assigneeEmail,
        status: 'No iniciada',
        priority: template.priority,
        nature: 'Fija Mensual',
        shiftType: template.shiftType || 'General',
        objectiveLocation: template.objectiveLocation || 'Base Central Maipú',
        monthPeriod: targetPeriod,
        startDate: `${yearStr}-${monthStr}-${startDay}`,
        dueDate: `${yearStr}-${monthStr}-${dueDay}`,
        notes: template.notes,
        category: template.category,
        commentsCount: 0,
      };
    });
    result = [...result, ...newTasks];
  }

  const { updatedTasks } = renewWeeklyFixedTasksForPeriod(result, targetPeriod);
  return updatedTasks;
}

export function resetMonthToStandardFixedTasks(existingTasks: Task[], targetPeriod: string): Task[] {
  const otherMonthTasks = existingTasks.filter(t => (t.monthPeriod || '2026-10') !== targetPeriod);
  const [yearStr, monthStr] = targetPeriod.split('-');
  const cleanFixedTasks: Task[] = STANDARD_FIXED_TASKS_TEMPLATE.map((template, idx) => {
    const startDay = template.startDate || '01';
    const dueDay = template.dueDate || '15';
    return {
      id: `task-${targetPeriod}-${idx + 1}-${Date.now()}`,
      area: template.area,
      title: template.title,
      assignee: template.assignee,
      assigneeEmail: template.assigneeEmail,
      status: 'No iniciada',
      priority: template.priority,
      nature: 'Fija Mensual',
      shiftType: template.shiftType || 'General',
      objectiveLocation: template.objectiveLocation || 'Base Central Maipú',
      monthPeriod: targetPeriod,
      startDate: `${yearStr}-${monthStr}-${startDay}`,
      dueDate: `${yearStr}-${monthStr}-${dueDay}`,
      notes: template.notes,
      category: template.category,
      commentsCount: 0,
    };
  });
  const baseWithMonthly = [...otherMonthTasks, ...cleanFixedTasks];
  const { updatedTasks } = renewWeeklyFixedTasksForPeriod(baseWithMonthly, targetPeriod);
  return updatedTasks;
}

export function ensureMonthHasFixedTasks(period: string, tasks: Task[]): Task[] {
  return ensureMonthTasks(tasks, period);
}

export function renewMonthFixedTasks(period: string, tasks: Task[]): Task[] {
  return resetMonthToStandardFixedTasks(tasks, period);
}
