export type TableName = 'p06_habits' | 'p06_habit_logs' | 'p06_entries';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  weekly_target: number;
  archived: boolean;
  updated_at: string;
}
export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string; // YYYY-MM-DD
  updated_at: string;
}
export type EntryKind = 'gasto' | 'ingreso';
export interface Entry {
  id: string;
  kind: EntryKind;
  amount_cents: number;
  category: string;
  note: string;
  occurred_on: string; // YYYY-MM-DD
  updated_at: string;
}

export interface Cache {
  p06_habits: Habit[];
  p06_habit_logs: HabitLog[];
  p06_entries: Entry[];
}
export const emptyCache = (): Cache => ({ p06_habits: [], p06_habit_logs: [], p06_entries: [] });
export const TABLES: TableName[] = ['p06_habits', 'p06_habit_logs', 'p06_entries'];

/** Operacion pendiente de enviar. Nunca lleva user_id: lo pone el servidor. */
export interface Op {
  opId: string;
  table: TableName;
  type: 'upsert' | 'delete';
  rowId: string;
  payload?: Record<string, unknown>;
  queuedAt: number;
  attempts: number;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error' | 'signed_out';
