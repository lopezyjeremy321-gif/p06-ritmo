/**
 * Motor offline-first. Logica pura (sin React ni red concreta) para poder probarla.
 *  - Toda escritura se aplica local al instante y se encola en un outbox persistente.
 *  - Al sincronizar SIEMPRE se re-autoriza: se pregunta al servidor quien es la sesion; si no coincide con
 *    el dueno de los datos locales, se borra todo (no se confia en datos locales ni se restaura estado ajeno).
 *  - Conflictos: gana la marca de tiempo del servidor (updated_at lo fija un trigger); un cambio local
 *    pendiente se reenvia y por tanto vuelve a ganar solo si el servidor lo acepta.
 *  - El servidor (RLS) es la autoridad: una operacion rechazada por permisos se descarta y se avisa.
 */
import { emptyCache, TABLES, type Cache, type Op, type TableName } from './types';

export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface RemoteError { code?: string; message: string; status?: number }
export interface Remote {
  /** Id de usuario segun el SERVIDOR (valida el token), o null si la sesion no vale. */
  whoAmI(): Promise<string | null>;
  upsert(table: TableName, row: Record<string, unknown>): Promise<RemoteError | null>;
  remove(table: TableName, id: string): Promise<RemoteError | null>;
  fetchAll(table: TableName): Promise<{ rows: Record<string, unknown>[]; error: RemoteError | null }>;
}

export const KEY_PREFIX = 'ritmo:v1:';
const cacheKey = (uid: string) => `${KEY_PREFIX}${uid}:cache`;
const outboxKey = (uid: string) => `${KEY_PREFIX}${uid}:outbox`;
const ownerKey = `${KEY_PREFIX}owner`;

export type SyncResult =
  | { status: 'synced'; pushed: number; rejected: Op[] }
  | { status: 'offline' }
  | { status: 'error'; message: string; pushed: number }
  | { status: 'signed_out'; wiped: boolean };

const isPermission = (e: RemoteError) => e.code === '42501' || e.status === 401 || e.status === 403;
const isTransient = (e: RemoteError) => !e.status || e.status >= 500 || e.status === 0 || e.code === 'NETWORK' || e.status === 408 || e.status === 429;
const isRejected = (e: RemoteError) => isPermission(e) || (e.status !== undefined && e.status >= 400 && e.status < 500 && !isTransient(e)) || /^(22|23|42)/.test(e.code ?? '');

export class LocalStore {
  constructor(private kv: KV) {}

  async owner(): Promise<string | null> { return this.kv.getItem(ownerKey); }
  async setOwner(uid: string) { await this.kv.setItem(ownerKey, uid); }

  async loadCache(uid: string): Promise<Cache> {
    const raw = await this.kv.getItem(cacheKey(uid));
    if (!raw) return emptyCache();
    try { return { ...emptyCache(), ...(JSON.parse(raw) as Partial<Cache>) }; } catch { return emptyCache(); }
  }
  async saveCache(uid: string, c: Cache) { await this.kv.setItem(cacheKey(uid), JSON.stringify(c)); }

  async loadOutbox(uid: string): Promise<Op[]> {
    const raw = await this.kv.getItem(outboxKey(uid));
    if (!raw) return [];
    try { return JSON.parse(raw) as Op[]; } catch { return []; }
  }
  async saveOutbox(uid: string, ops: Op[]) { await this.kv.setItem(outboxKey(uid), JSON.stringify(ops)); }

  /** Logout / cambio de cuenta: borra TODO lo local de la app (cache, outbox, dueno). */
  async wipeAll(): Promise<number> {
    const keys = (await this.kv.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
    for (const k of keys) await this.kv.removeItem(k);
    return keys.length;
  }
}

/** Cola con coalescing: varias ediciones de la misma fila se funden en una; delete reemplaza todo lo anterior. */
export function enqueue(ops: Op[], op: Op): Op[] {
  const rest = ops.filter((o) => !(o.table === op.table && o.rowId === op.rowId));
  if (op.type === 'upsert') {
    const prev = ops.find((o) => o.table === op.table && o.rowId === op.rowId && o.type === 'upsert');
    return [...rest, { ...op, payload: { ...(prev?.payload ?? {}), ...(op.payload ?? {}) }, queuedAt: prev?.queuedAt ?? op.queuedAt }];
  }
  return [...rest, op];
}

type Row = { id: string } & Record<string, unknown>;
export function applyLocal(cache: Cache, table: TableName, type: 'upsert' | 'delete', row: Row): Cache {
  const current = cache[table] as unknown as Row[];
  const prev = current.find((r) => r.id === row.id);
  const rest = current.filter((r) => r.id !== row.id);
  const next = type === 'upsert' ? [...rest, { ...prev, ...row }] : rest;
  let out = { ...cache, [table]: next } as unknown as Cache;
  if (type === 'delete' && table === 'p06_habits') {
    out = { ...out, p06_habit_logs: out.p06_habit_logs.filter((l) => l.habit_id !== row.id) };
  }
  return out;
}

/** Aplica el estado del servidor al cache, respetando lo que aun esta pendiente de enviar. */
export function mergeServer(cache: Cache, table: TableName, rows: Record<string, unknown>[], pending: Op[]): Cache {
  const pendingIds = new Set(pending.filter((o) => o.table === table).map((o) => o.rowId));
  const kept = (cache[table] as { id: string }[]).filter((r) => pendingIds.has(r.id));
  const fromServer = rows.filter((r) => !pendingIds.has(r.id as string)).map(stripUser);
  return { ...cache, [table]: [...fromServer, ...kept] } as Cache;
}

export function stripUser<T extends Record<string, unknown>>(row: T): T {
  const { user_id: _u, created_at: _c, ...rest } = row as Record<string, unknown>;
  return rest as T;
}

export interface SyncDeps {
  store: LocalStore;
  remote: Remote;
  isOnline: () => Promise<boolean>;
}

/**
 * Sincroniza: re-autoriza, vacia el outbox y trae el estado del servidor.
 * `hint` = usuario con el que la app cree estar logueada (si difiere del dueno local se borra todo).
 */
export async function syncOnce(deps: SyncDeps): Promise<SyncResult & { cache?: Cache; uid?: string }> {
  const { store, remote } = deps;
  if (!(await deps.isOnline())) return { status: 'offline' };

  // 1) Re-autorizar con el servidor: el token se valida AHORA, no se confia en lo guardado.
  let uid: string | null;
  try { uid = await remote.whoAmI(); } catch { return { status: 'offline' }; } // fallo de red != sesion invalida
  if (!uid) {
    const wiped = (await store.wipeAll()) > 0;
    return { status: 'signed_out', wiped };
  }
  const owner = await store.owner();
  if (owner && owner !== uid) await store.wipeAll(); // otra cuenta: nada de lo local le pertenece
  await store.setOwner(uid);

  // 2) Enviar pendientes en orden
  let ops = await store.loadOutbox(uid);
  const rejected: Op[] = [];
  let pushed = 0;
  const remaining: Op[] = [];
  let stop: string | null = null;
  for (const op of ops) {
    if (stop) { remaining.push(op); continue; }
    const err = op.type === 'upsert'
      ? await remote.upsert(op.table, { id: op.rowId, ...(op.payload ?? {}) })
      : await remote.remove(op.table, op.rowId);
    if (!err) { pushed++; continue; }
    if (isRejected(err)) { rejected.push(op); continue; } // el servidor (RLS/constraints) dijo no: descartar y avisar
    remaining.push({ ...op, attempts: op.attempts + 1 });
    stop = err.message;
    if (!isTransient(err)) stop = err.message;
  }
  ops = remaining;
  await store.saveOutbox(uid, ops);
  if (stop) return { status: 'error', message: stop, pushed };

  // 3) Traer estado del servidor (lo borrado/cambiado desde otros dispositivos)
  let cache = await store.loadCache(uid);
  for (const t of TABLES) {
    const { rows, error } = await remote.fetchAll(t);
    if (error) return { status: 'error', message: error.message, pushed };
    cache = mergeServer(cache, t, rows, ops);
  }
  await store.saveCache(uid, cache);
  return { status: 'synced', pushed, rejected, cache, uid };
}
