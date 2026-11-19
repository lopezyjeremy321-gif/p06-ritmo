import type { Entry, Habit, HabitLog } from './types';

export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
};

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const weekdayShort = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
};

/** Los 7 dias que terminan en `today` (incluido), del mas antiguo al mas reciente. */
export const last7 = (today: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

export interface DayStat {
  date: string;
  label: string;
  expenseCents: number;
  incomeCents: number;
  habitsDone: number;
}

export function weeklyStats(today: string, entries: Entry[], logs: HabitLog[], habits: Habit[]): DayStat[] {
  const active = new Set(habits.filter((h) => !h.archived).map((h) => h.id));
  return last7(today).map((date) => ({
    date,
    label: weekdayShort(date),
    expenseCents: entries.filter((e) => e.occurred_on === date && e.kind === 'gasto').reduce((s, e) => s + e.amount_cents, 0),
    incomeCents: entries.filter((e) => e.occurred_on === date && e.kind === 'ingreso').reduce((s, e) => s + e.amount_cents, 0),
    habitsDone: logs.filter((l) => l.log_date === date && active.has(l.habit_id)).length,
  }));
}

/** Racha de dias consecutivos (terminando hoy o ayer) con el habito hecho. */
export function streak(today: string, habitId: string, logs: HabitLog[]): number {
  const days = new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.log_date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

export function weekCount(today: string, habitId: string, logs: HabitLog[]): number {
  const week = new Set(last7(today));
  return logs.filter((l) => l.habit_id === habitId && week.has(l.log_date)).length;
}

/** 123456 -> "1.234,56". Formato fijo (es) sin depender de Intl del dispositivo. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$ ${whole},${String(abs % 100).padStart(2, '0')}`;
}

/** Texto del usuario ("12,5", "1.200", "3.50") -> centimos enteros o null si no es valido/positivo. */
export function parseAmountToCents(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(/^\$/, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) return null;
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) normalized = s.replace(/\./g, '').replace(',', '.');
  else normalized = s.replace(',', '.');
  const cents = Math.round(parseFloat(normalized) * 100);
  if (!Number.isFinite(cents) || cents < 1 || cents > 100_000_000_000) return null;
  return cents;
}

/** Resumen accesible del grafico para lectores de pantalla. */
export function chartSummary(stats: DayStat[]): string {
  const tot = stats.reduce((s, d) => s + d.expenseCents, 0);
  const best = [...stats].sort((a, b) => b.expenseCents - a.expenseCents)[0];
  if (tot === 0) return 'Sin gastos en los últimos 7 días.';
  return `Gastaste ${formatMoney(tot)} en 7 días. El día de más gasto fue ${best.label} con ${formatMoney(best.expenseCents)}.`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** 2026-11-18 -> "18 nov" */
export const shortDate = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
