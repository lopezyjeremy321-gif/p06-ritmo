import { beforeEach, describe, expect, it } from 'vitest';
import { applyLocal, enqueue, KEY_PREFIX, LocalStore, mergeServer, syncOnce, type KV, type Remote, type RemoteError } from '../../src/data/sync';
import { emptyCache, type Op, type TableName } from '../../src/data/types';

class MemKV implements KV {
  m = new Map<string, string>();
  async getItem(k: string) { return this.m.get(k) ?? null; }
  async setItem(k: string, v: string) { this.m.set(k, v); }
  async removeItem(k: string) { this.m.delete(k); }
  async getAllKeys() { return [...this.m.keys()]; }
}

class FakeRemote implements Remote {
  uid: string | null = 'user-a';
  rows: Record<TableName, Record<string, unknown>[]> = { p06_habits: [], p06_habit_logs: [], p06_entries: [] };
  calls: string[] = [];
  failWith: RemoteError | null = null;
  rejectIds = new Set<string>();
  async whoAmI() { return this.uid; }
  async upsert(t: TableName, row: Record<string, unknown>) {
    this.calls.push(`upsert:${t}:${row.id}`);
    if (this.failWith) return this.failWith;
    if (this.rejectIds.has(row.id as string)) return { code: '42501', message: 'rls', status: 403 };
    this.rows[t] = [...this.rows[t].filter((r) => r.id !== row.id), { ...row, user_id: this.uid, updated_at: 'srv' }];
    return null;
  }
  async remove(t: TableName, id: string) {
    this.calls.push(`remove:${t}:${id}`);
    if (this.failWith) return this.failWith;
    this.rows[t] = this.rows[t].filter((r) => r.id !== id);
    return null;
  }
  async fetchAll(t: TableName) { return { rows: this.rows[t], error: null }; }
}

const op = (table: TableName, rowId: string, type: Op['type'], payload?: Record<string, unknown>): Op => ({ opId: rowId + type, table, type, rowId, payload, queuedAt: 1, attempts: 0 });

let kv: MemKV; let store: LocalStore; let remote: FakeRemote; let online = true;
const deps = () => ({ store, remote, isOnline: async () => online });
beforeEach(() => { kv = new MemKV(); store = new LocalStore(kv); remote = new FakeRemote(); online = true; });

describe('outbox', () => {
  it('funde ediciones de la misma fila y delete reemplaza todo', () => {
    let q: Op[] = [];
    q = enqueue(q, op('p06_habits', 'h1', 'upsert', { name: 'A' }));
    q = enqueue(q, op('p06_habits', 'h1', 'upsert', { weekly_target: 3 }));
    expect(q).toHaveLength(1);
    expect(q[0].payload).toEqual({ name: 'A', weekly_target: 3 });
    q = enqueue(q, op('p06_habits', 'h1', 'delete'));
    expect(q).toHaveLength(1);
    expect(q[0].type).toBe('delete');
  });
  it('borrar un habito local quita sus registros del cache', () => {
    let c = applyLocal(emptyCache(), 'p06_habits', 'upsert', { id: 'h1', name: 'x' });
    c = applyLocal(c, 'p06_habit_logs', 'upsert', { id: 'l1', habit_id: 'h1', log_date: '2026-11-18' });
    c = applyLocal(c, 'p06_habits', 'delete', { id: 'h1' });
    expect(c.p06_habits).toHaveLength(0);
    expect(c.p06_habit_logs).toHaveLength(0);
  });
});

describe('syncOnce', () => {
  it('sin red: no toca nada y conserva el outbox', async () => {
    online = false;
    await store.saveOutbox('user-a', [op('p06_entries', 'e1', 'upsert', { kind: 'gasto', amount_cents: 100, category: 'x' })]);
    expect((await syncOnce(deps())).status).toBe('offline');
    expect(remote.calls).toEqual([]);
    expect(await store.loadOutbox('user-a')).toHaveLength(1);
  });

  it('con red: envia el outbox en orden, lo vacia y trae el estado del servidor SIN user_id', async () => {
    await store.saveOutbox('user-a', [
      op('p06_habits', 'h1', 'upsert', { name: 'Leer', icon: 'book', weekly_target: 5, archived: false }),
      op('p06_habit_logs', 'l1', 'upsert', { habit_id: 'h1', log_date: '2026-11-18' }),
    ]);
    const r = await syncOnce(deps());
    expect(r.status).toBe('synced');
    expect(remote.calls).toEqual(['upsert:p06_habits:h1', 'upsert:p06_habit_logs:l1']);
    expect(await store.loadOutbox('user-a')).toEqual([]);
    const cache = await store.loadCache('user-a');
    expect(cache.p06_habits[0]).not.toHaveProperty('user_id');
  });

  it('nunca envia user_id desde el cliente', async () => {
    const seen: Record<string, unknown>[] = [];
    remote.upsert = async (_t, row) => { seen.push(row); return null; };
    await store.saveOutbox('user-a', [op('p06_entries', 'e1', 'upsert', { kind: 'gasto', amount_cents: 5, category: 'x' })]);
    await syncOnce(deps());
    expect(seen[0]).not.toHaveProperty('user_id');
  });

  it('error transitorio (red/5xx): conserva la cola y reporta error', async () => {
    await store.saveOutbox('user-a', [op('p06_entries', 'e1', 'upsert', { kind: 'gasto', amount_cents: 5, category: 'x' })]);
    remote.failWith = { message: 'fetch failed', status: 0 };
    const r = await syncOnce(deps());
    expect(r.status).toBe('error');
    const q = await store.loadOutbox('user-a');
    expect(q).toHaveLength(1);
    expect(q[0].attempts).toBe(1);
  });

  it('re-autorizacion: una operacion que el servidor rechaza por permisos se descarta y se reporta', async () => {
    remote.rejectIds.add('e-ajena');
    await store.saveOutbox('user-a', [
      op('p06_entries', 'e-ajena', 'upsert', { kind: 'gasto', amount_cents: 5, category: 'x' }),
      op('p06_entries', 'e-ok', 'upsert', { kind: 'gasto', amount_cents: 7, category: 'y' }),
    ]);
    const r = await syncOnce(deps());
    expect(r.status).toBe('synced');
    if (r.status === 'synced') expect(r.rejected.map((o) => o.rowId)).toEqual(['e-ajena']);
    expect(await store.loadOutbox('user-a')).toEqual([]);
    expect(remote.rows.p06_entries.map((x) => x.id)).toEqual(['e-ok']);
  });

  it('sesion invalida en el servidor: borra TODO lo local y no envia nada', async () => {
    await store.setOwner('user-a');
    await store.saveCache('user-a', { ...emptyCache(), p06_entries: [{ id: 'e1', kind: 'gasto', amount_cents: 1, category: 'x', note: '', occurred_on: '2026-11-18', updated_at: '' }] });
    await store.saveOutbox('user-a', [op('p06_entries', 'e2', 'upsert', {})]);
    remote.uid = null;
    const r = await syncOnce(deps());
    expect(r.status).toBe('signed_out');
    expect(remote.calls).toEqual([]);
    expect([...kv.m.keys()].filter((k) => k.startsWith(KEY_PREFIX))).toEqual([]);
  });

  it('otra cuenta inicia sesion en el mismo dispositivo: no hereda cache ni outbox del anterior', async () => {
    await store.setOwner('user-a');
    await store.saveCache('user-a', { ...emptyCache(), p06_habits: [{ id: 'h-de-a', name: 'secreto', icon: 'x', weekly_target: 1, archived: false, updated_at: '' }] });
    await store.saveOutbox('user-a', [op('p06_habits', 'h-de-a', 'upsert', { name: 'secreto' })]);
    remote.uid = 'user-b';
    const r = await syncOnce(deps());
    expect(r.status).toBe('synced');
    expect(remote.calls).toEqual([]); // el outbox de A NO se envio como B
    expect(await store.loadCache('user-a')).toEqual(emptyCache());
    expect((await store.loadCache('user-b')).p06_habits).toEqual([]);
  });

  it('lo borrado en el servidor desaparece del cache, salvo lo pendiente de enviar', () => {
    const cache = { ...emptyCache(), p06_entries: [
      { id: 'viejo', kind: 'gasto' as const, amount_cents: 1, category: 'x', note: '', occurred_on: '2026-11-01', updated_at: '' },
      { id: 'pendiente', kind: 'gasto' as const, amount_cents: 2, category: 'x', note: '', occurred_on: '2026-11-02', updated_at: '' },
    ] };
    const merged = mergeServer(cache, 'p06_entries', [], [op('p06_entries', 'pendiente', 'upsert')]);
    expect(merged.p06_entries.map((e) => e.id)).toEqual(['pendiente']);
  });
});

describe('logout', () => {
  it('wipeAll borra cache, outbox y dueno de todas las cuentas', async () => {
    await store.setOwner('user-a');
    await store.saveCache('user-a', emptyCache());
    await store.saveOutbox('user-b', []);
    await kv.setItem('otra-app:clave', 'x');
    expect(await store.wipeAll()).toBe(3);
    expect(await kv.getItem('otra-app:clave')).toBe('x'); // no toca lo ajeno
    expect(await store.owner()).toBeNull();
  });
});
