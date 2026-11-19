/**
 * Configuracion de Supabase. SOLO URL + clave publica (anon/publishable) viajan en la app.
 * Para apuntar a la nube basta cambiar estas 2 variables (ver .env.example).
 */
export interface SupabaseConfig { url: string; anonKey: string }

function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch { return null; }
}

/** Lanza si la clave es de servidor: una clave secreta en el cliente es una fuga garantizada (se extrae del APK). */
export function assertPublicKey(key: string): void {
  if (!key) throw new Error('Falta EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (key.startsWith('sb_' + 'secret_')) throw new Error('Clave secreta de Supabase en el cliente: usa solo la publishable/anon');
  const role = jwtRole(key);
  if (role && role !== 'anon') throw new Error(`La clave tiene rol "${role}": solo se permite anon`);
}

export function readConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const anonKey = (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!/^https?:\/\//.test(url)) throw new Error('Falta EXPO_PUBLIC_SUPABASE_URL (https://<proyecto>.supabase.co)');
  assertPublicKey(anonKey);
  return { url, anonKey };
}

const raw = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export const configError = (): string | null => {
  try { readConfig(raw); return null; } catch (e) { return (e as Error).message; }
};
export const config: SupabaseConfig | null = configError() ? null : readConfig(raw);
