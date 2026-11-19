import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withDb } from './helpers';

/** Devuelve los problemas de RLS del esquema public (vacio = todo bien). Solo mira objetos p06_*. */
export async function rlsProblems(c: import('pg').Client): Promise<string[]> {
  const out: string[] = [];
  const tables = (await c.query(
    `select c.relname, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and c.relname like 'p06\\_%' escape '\\'`)).rows;
  if (tables.length === 0) out.push('no hay tablas p06_ (migracion no aplicada)');
  for (const t of tables) {
    if (!t.rls) out.push(`${t.relname}: RLS desactivado`);
    const pol = (await c.query(
      `select cmd, qual, with_check, roles from pg_policies where schemaname='public' and tablename=$1`, [t.relname])).rows;
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      if (!pol.some((p) => p.cmd === cmd)) out.push(`${t.relname}: falta politica ${cmd}`);
    }
    for (const p of pol) {
      const expr = `${p.qual ?? ''} ${p.with_check ?? ''}`;
      if (/^\s*true\s*$/i.test(p.qual ?? '') || /^\s*true\s*$/i.test(p.with_check ?? '')) out.push(`${t.relname}: politica ${p.cmd} con using(true)`);
      if (!/select auth\.uid\(\)/i.test(expr) && !/auth\.uid\(\)/i.test(expr)) out.push(`${t.relname}: politica ${p.cmd} sin auth.uid()`);
      if (p.roles.includes('anon') || p.roles.includes('public')) out.push(`${t.relname}: politica ${p.cmd} abierta a anon/public`);
    }
    const anon = (await c.query(`select has_table_privilege('anon', $1, 'select,insert,update,delete') as g`, [`public.${t.relname}`])).rows[0].g;
    if (anon) out.push(`${t.relname}: anon tiene privilegios`);
  }
  const views = (await c.query(
    `select c.relname, coalesce(c.reloptions::text,'') as o from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='v' and c.relname like 'p06\\_%' escape '\\'`)).rows;
  for (const v of views) if (!/security_invoker=(true|on)/.test(v.o)) out.push(`${v.relname}: vista sin security_invoker`);
  const defs = (await c.query(
    `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'p06\\_%' escape '\\' and p.prosecdef
       and (has_function_privilege('anon', p.oid, 'execute'))`)).rows;
  for (const f of defs) out.push(`${f.proname}: security definer ejecutable por anon`);
  return out;
}

describe('cobertura RLS del esquema', () => {
  it('todas las tablas p06_ tienen RLS, 4 politicas por operacion y anon sin privilegios', async () => {
    const problems = await withDb(rlsProblems);
    expect(problems).toEqual([]);
  });

  it('FALLA si una tabla nueva queda sin RLS (meta-prueba, se revierte)', async () => {
    const problems = await withDb(async (c) => {
      await c.query('begin');
      try {
        await c.query('create table public.p06_tabla_sin_rls (id int, user_id uuid)');
        return await rlsProblems(c);
      } finally {
        await c.query('rollback');
      }
    });
    expect(problems.some((p) => p.includes('p06_tabla_sin_rls: RLS desactivado'))).toBe(true);
    expect(problems.some((p) => p.includes('p06_tabla_sin_rls: falta politica'))).toBe(true);
  });

  it('FALLA si una politica es using(true) (meta-prueba, se revierte)', async () => {
    const problems = await withDb(async (c) => {
      await c.query('begin');
      try {
        await c.query('create policy p06_mala on public.p06_entries for select to authenticated using (true)');
        return await rlsProblems(c);
      } finally {
        await c.query('rollback');
      }
    });
    expect(problems.some((p) => p.includes('using(true)'))).toBe(true);
  });
});

describe('higiene de la migracion (proyecto compartido)', () => {
  const dir = join(__dirname, '..', '..', 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.startsWith('p06_') && f.endsWith('.sql'));
  it('hay migraciones p06_*.sql', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const code = sql.replace(/--.*$/gm, '');
    it(`${f}: sin drop/truncate/delete masivo`, () => {
      expect(code).not.toMatch(/\b(drop|truncate)\b/i);
    });
    it(`${f}: no toca auth.*, storage.* ni usa service_role`, () => {
      expect(code).not.toMatch(/\bauth\.(?!uid\(\)|users \(id\))/i);
      expect(code).not.toMatch(/\bstorage\./i);
      expect(code).not.toMatch(/service_role/i);
    });
    it(`${f}: todo create table/function/index/policy/trigger lleva prefijo p06_`, () => {
      const names = [...code.matchAll(/create\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:table|function|index|trigger)\s+(?:if not exists\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]);
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((n) => !n.startsWith('p06_'))).toEqual([]);
    });
    it(`${f}: es idempotente (se aplica dos veces sin error)`, async () => {
      await withDb(async (c) => { await c.query(sql); await c.query(sql); });
    });
  }
});
