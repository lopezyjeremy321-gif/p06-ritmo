import { describe, expect, it } from 'vitest';
import { addDays, chartSummary, formatMoney, last7, parseAmountToCents, streak, weekCount, weeklyStats } from '../../src/data/stats';
import type { Entry, Habit, HabitLog } from '../../src/data/types';

const habit = (id: string, archived = false): Habit => ({ id, name: id, icon: 'check', weekly_target: 7, archived, updated_at: '' });
const log = (habit_id: string, log_date: string): HabitLog => ({ id: habit_id + log_date, habit_id, log_date, updated_at: '' });
const entry = (kind: Entry['kind'], amount_cents: number, occurred_on: string): Entry => ({ id: kind + amount_cents + occurred_on, kind, amount_cents, category: 'x', note: '', occurred_on, updated_at: '' });

describe('fechas', () => {
  it('addDays cruza mes y anio', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('last7 devuelve 7 dias terminando hoy', () => {
    const d = last7('2026-11-18');
    expect(d).toHaveLength(7);
    expect(d[0]).toBe('2026-11-12');
    expect(d[6]).toBe('2026-11-18');
  });
});

describe('weeklyStats', () => {
  it('suma gastos e ingresos por dia y cuenta habitos solo de habitos activos', () => {
    const s = weeklyStats('2026-11-18',
      [entry('gasto', 1000, '2026-11-18'), entry('gasto', 250, '2026-11-18'), entry('ingreso', 9000, '2026-11-17'), entry('gasto', 5, '2026-10-01')],
      [log('a', '2026-11-18'), log('b', '2026-11-18'), log('a', '2026-11-17')],
      [habit('a'), habit('b', true)]);
    const hoy = s[6];
    expect(hoy.expenseCents).toBe(1250);
    expect(hoy.habitsDone).toBe(1);
    expect(s[5].incomeCents).toBe(9000);
    expect(s.reduce((t, d) => t + d.expenseCents, 0)).toBe(1250); // el gasto fuera de la ventana no cuenta
  });
});

describe('rachas', () => {
  it('cuenta dias consecutivos terminando hoy', () => {
    expect(streak('2026-11-18', 'a', [log('a', '2026-11-18'), log('a', '2026-11-17'), log('a', '2026-11-16')])).toBe(3);
  });
  it('si hoy aun no se hizo, la racha de ayer sigue viva', () => {
    expect(streak('2026-11-18', 'a', [log('a', '2026-11-17'), log('a', '2026-11-16')])).toBe(2);
  });
  it('un hueco la corta y 0 si no hay registros', () => {
    expect(streak('2026-11-18', 'a', [log('a', '2026-11-18'), log('a', '2026-11-16')])).toBe(1);
    expect(streak('2026-11-18', 'a', [])).toBe(0);
  });
  it('weekCount ignora otros habitos y dias fuera de ventana', () => {
    expect(weekCount('2026-11-18', 'a', [log('a', '2026-11-18'), log('b', '2026-11-18'), log('a', '2026-10-01')])).toBe(1);
  });
});

describe('dinero', () => {
  it('formatMoney', () => {
    expect(formatMoney(123456)).toBe('$ 1.234,56');
    expect(formatMoney(5)).toBe('$ 0,05');
    expect(formatMoney(100000000000)).toBe('$ 1.000.000.000,00');
  });
  it.each([
    ['12,5', 1250], ['12.50', 1250], ['1.200', 120000], ['1.234,56', 123456], ['$ 3', 300], ['0,01', 1],
  ])('parse %s -> %i', (txt, cents) => expect(parseAmountToCents(txt)).toBe(cents));
  it.each(['', 'abc', '0', '-5', '1,234,56', '12,345', '1e5', '999999999999'])('rechaza %s', (txt) => {
    expect(parseAmountToCents(txt)).toBeNull();
  });
});

describe('chartSummary', () => {
  it('describe el total y el dia pico; vacio sin gastos', () => {
    const st = weeklyStats('2026-11-18', [entry('gasto', 1000, '2026-11-18')], [], []);
    expect(chartSummary(st)).toContain('$ 10,00');
    expect(chartSummary(weeklyStats('2026-11-18', [], [], []))).toContain('Sin gastos');
  });
});
