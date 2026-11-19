import { beforeAll, describe, expect, it } from 'vitest';
import { newClient, signUpUser, uuid, waitFor, type TestUser } from './helpers';

const TABLES = ['p06_habits', 'p06_entries'] as const;
let A: TestUser;
let B: TestUser;
let habitA: string;
let entryA: string;
let logA: string;

beforeAll(async () => {
  A = await signUpUser('a');
  B = await signUpUser('b');
  habitA = uuid(); entryA = uuid(); logA = uuid();
  const h = await A.client.from('p06_habits').insert({ id: habitA, name: 'Caminar 20 min' });
  expect(h.error).toBeNull();
  const e = await A.client.from('p06_entries').insert({ id: entryA, kind: 'gasto', amount_cents: 1250, category: 'Comida' });
  expect(e.error).toBeNull();
  const l = await A.client.from('p06_habit_logs').insert({ id: logA, habit_id: habitA, log_date: '2026-11-17' });
  expect(l.error).toBeNull();
});

describe('A puede usar lo suyo (control positivo)', () => {
  it('A ve sus 3 filas y user_id lo puso el servidor', async () => {
    const h = await A.client.from('p06_habits').select('id,user_id').eq('id', habitA);
    expect(h.data).toHaveLength(1);
    expect(h.data![0].user_id).toBe(A.id);
    expect((await A.client.from('p06_entries').select('id')).data).toHaveLength(1);
    expect((await A.client.from('p06_habit_logs').select('id')).data).toHaveLength(1);
  });
});

describe('B no ve ni toca nada de A (REST)', () => {
  it('select: 0 filas en las 3 tablas', async () => {
    for (const t of [...TABLES, 'p06_habit_logs'] as const) {
      const r = await B.client.from(t).select('*');
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
    }
  });
  it('select dirigido por id de A: 0 filas', async () => {
    const r = await B.client.from('p06_habits').select('*').eq('id', habitA);
    expect(r.data).toEqual([]);
  });
  it('insert con user_id de A: denegado', async () => {
    const rows: [string, Record<string, unknown>][] = [
      ['p06_habits', { name: 'Intruso', user_id: A.id }],
      ['p06_entries', { kind: 'gasto', amount_cents: 1, category: 'x', user_id: A.id }],
    ];
    for (const row of rows) {
      const r = await B.client.from(row[0]).insert(row[1]);
      expect(r.error, row[0]).not.toBeNull();
      expect(r.error!.code).toBe('42501');
    }
  });
  it('insert de un log colgado de un habito de A: denegado', async () => {
    const r = await B.client.from('p06_habit_logs').insert({ habit_id: habitA, log_date: '2026-11-16' });
    expect(r.error).not.toBeNull();
  });
  it('update de filas de A: 0 filas afectadas y A no ve cambios', async () => {
    const r = await B.client.from('p06_habits').update({ name: 'Hackeado' }).eq('id', habitA).select();
    expect(r.data ?? []).toEqual([]);
    const r2 = await B.client.from('p06_entries').update({ amount_cents: 9 }).eq('id', entryA).select();
    expect(r2.data ?? []).toEqual([]);
    const own = await A.client.from('p06_habits').select('name').eq('id', habitA).single();
    expect(own.data!.name).toBe('Caminar 20 min');
  });
  it('update que intenta mover una fila propia al user_id de A: denegado', async () => {
    const mine = uuid();
    expect((await B.client.from('p06_habits').insert({ id: mine, name: 'Mio' })).error).toBeNull();
    const r = await B.client.from('p06_habits').update({ user_id: A.id }).eq('id', mine).select();
    // el trigger fija user_id al dueno original: la fila sigue siendo de B
    const a = await A.client.from('p06_habits').select('id').eq('id', mine);
    expect(a.data ?? []).toEqual([]);
    expect(r.error === null || r.error.code === '42501').toBe(true);
  });
  it('delete de filas de A: 0 filas y siguen existiendo', async () => {
    for (const [t, id] of [['p06_habits', habitA], ['p06_entries', entryA], ['p06_habit_logs', logA]] as const) {
      const r = await B.client.from(t).delete().eq('id', id).select();
      expect(r.data ?? []).toEqual([]);
    }
    expect((await A.client.from('p06_habits').select('id').eq('id', habitA)).data).toHaveLength(1);
    expect((await A.client.from('p06_entries').select('id').eq('id', entryA)).data).toHaveLength(1);
    expect((await A.client.from('p06_habit_logs').select('id').eq('id', logA)).data).toHaveLength(1);
  });
  it('constraints del servidor: importe 0, nombre vacio y kind invalido se rechazan', async () => {
    expect((await A.client.from('p06_entries').insert({ kind: 'gasto', amount_cents: 0, category: 'x' })).error).not.toBeNull();
    expect((await A.client.from('p06_entries').insert({ kind: 'robo', amount_cents: 5, category: 'x' })).error).not.toBeNull();
    expect((await A.client.from('p06_habits').insert({ name: '' })).error).not.toBeNull();
  });
});

describe('anon (sin sesion) no obtiene nada', () => {
  it('select e insert: vacio o denegado', async () => {
    const anon = newClient();
    for (const t of [...TABLES, 'p06_habit_logs'] as const) {
      const s = await anon.from(t).select('*');
      expect(s.data ?? []).toEqual([]);
      const i = await anon.from(t).insert({ name: 'x', kind: 'gasto', amount_cents: 1, category: 'x' });
      expect(i.error).not.toBeNull();
    }
  });
  it('anon no puede ejecutar p06_delete_my_data', async () => {
    const r = await newClient().rpc('p06_delete_my_data');
    expect(r.error).not.toBeNull();
  });
});

describe('realtime respeta RLS', () => {
  it('B no recibe eventos de A y A si recibe los suyos', async () => {
    const gotA: unknown[] = [];
    const gotB: unknown[] = [];
    const chA = A.client.channel('rls-a').on('postgres_changes', { event: '*', schema: 'public', table: 'p06_entries' }, (p) => gotA.push(p));
    const chB = B.client.channel('rls-b').on('postgres_changes', { event: '*', schema: 'public', table: 'p06_entries' }, (p) => gotB.push(p));
    const subscribed = (ch: typeof chA) => new Promise<string>((res) => ch.subscribe((s) => { if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(s)) res(s); }));
    expect(await subscribed(chA)).toBe('SUBSCRIBED');
    expect(await subscribed(chB)).toBe('SUBSCRIBED');
    await new Promise((r) => setTimeout(r, 3000));

    const id = uuid();
    expect((await A.client.from('p06_entries').insert({ id, kind: 'ingreso', amount_cents: 5000, category: 'Sueldo' })).error).toBeNull();
    expect((await A.client.from('p06_entries').update({ amount_cents: 5100 }).eq('id', id)).error).toBeNull();

    const seenByA = await waitFor(() => gotA.length >= 2 && gotA);
    expect(seenByA, 'A debe recibir sus propios eventos (control positivo)').toBeTruthy();
    await new Promise((r) => setTimeout(r, 1500)); // margen para que B recibiera algo si hubiera fuga
    expect(gotB).toEqual([]);
    await A.client.removeChannel(chA);
    await B.client.removeChannel(chB);
  }, 30000);
});

describe('ciclo de vida: p06_delete_my_data', () => {
  it('borra solo los datos del usuario que llama', async () => {
    const C = await signUpUser('c');
    expect((await C.client.from('p06_habits').insert({ name: 'Temporal' })).error).toBeNull();
    expect((await C.client.rpc('p06_delete_my_data')).error).toBeNull();
    expect((await C.client.from('p06_habits').select('id')).data).toEqual([]);
    expect((await A.client.from('p06_habits').select('id').eq('id', habitA)).data).toHaveLength(1);
  });
});
