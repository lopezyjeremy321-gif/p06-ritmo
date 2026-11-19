import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

const SB = 'D:\\ClaudeBrain\\apps\\supabase-cli\\supabase.exe';
const ROOT = 'D:\\ClaudeBrain\\proyectos\\P06';

function localEnv(): Record<string, string> {
  if (process.env.RLS_API_URL && process.env.RLS_ANON_KEY && process.env.RLS_DB_URL) {
    return { API_URL: process.env.RLS_API_URL, ANON_KEY: process.env.RLS_ANON_KEY, DB_URL: process.env.RLS_DB_URL };
  }
  const out = execFileSync(SB, ['status', '-o', 'env', '--workdir', ROOT], { encoding: 'utf8' });
  const env: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = localEnv();
// SOLO anon: el service_role jamas se lee ni se usa en estas pruebas.
export const API_URL = env.API_URL;
export const ANON_KEY = env.ANON_KEY;
export const DB_URL = env.DB_URL;

export function newClient(): SupabaseClient {
  return createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

export interface TestUser { client: SupabaseClient; id: string; email: string }

export async function signUpUser(tag: string): Promise<TestUser> {
  const client = newClient();
  const email = `p06-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'Prueba-Segura-123' });
  if (error || !data.user || !data.session) throw new Error(`signUp fallo: ${error?.message ?? 'sin sesion'}`);
  await client.realtime.setAuth(data.session.access_token);
  return { client, id: data.user.id, email };
}

export async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: DB_URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

export const uuid = () => globalThis.crypto.randomUUID();

export async function waitFor<T>(fn: () => T | undefined | false, ms = 8000): Promise<T | undefined> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v as T;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}
