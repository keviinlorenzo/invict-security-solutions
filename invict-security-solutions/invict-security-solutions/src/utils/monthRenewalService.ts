import { Task } from '../types';
import { STANDARD_FIXED_TASKS_TEMPLATE } from '../data/mockData';

export function ensureMonthTasks(existingTasks: Task[], targetPeriod: string): Task[] {
  const periodTasks = existingTasks.filter(t => (t.monthPeriod || '2026-10') === targetPeriod);
  if (periodTasks.length > 0) {
    return existingTasks;
  }
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
  return [...existingTasks, ...newTasks];
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
  return [...otherMonthTasks, ...cleanFixedTasks];
}

export function ensureMonthHasFixedTasks(period: string, tasks: Task[]): Task[] {
  return ensureMonthTasks(tasks, period);
}

export function renewMonthFixedTasks(period: string, tasks: Task[]): Task[] {
  return resetMonthToStandardFixedTasks(tasks, period);
}
