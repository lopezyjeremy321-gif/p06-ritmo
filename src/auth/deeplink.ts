/**
 * Deep links de Auth (confirmacion de correo, recuperar contrasena).
 *  - Esquema unico: ritmo://auth/callback
 *  - Cada enlace saliente lleva un `state` aleatorio guardado; al volver se exige que coincida.
 *  - El canje del `code` usa PKCE (el code_verifier vive en el cliente de Supabase).
 */
export const REDIRECT_SCHEME = 'ritmo';
export const REDIRECT_PATH = 'auth/callback';
export const REDIRECT_BASE = `${REDIRECT_SCHEME}://${REDIRECT_PATH}`;

export type CallbackResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'esquema' | 'ruta' | 'state' | 'sin_code' | 'error_servidor'; detail?: string };

export function randomState(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildRedirect(state: string): string {
  return `${REDIRECT_BASE}?state=${encodeURIComponent(state)}`;
}

/** Valida un enlace entrante contra el state esperado. `expectedState` null = no habia flujo pendiente. */
export function parseCallback(url: string, expectedState: string | null): CallbackResult {
  const m = url.match(/^([a-z][a-z0-9+.-]*):\/\/([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i);
  if (!m) return { ok: false, reason: 'esquema' };
  if (m[1].toLowerCase() !== REDIRECT_SCHEME) return { ok: false, reason: 'esquema' };
  if (m[2].replace(/\/+$/, '') !== REDIRECT_PATH) return { ok: false, reason: 'ruta' };
  const params = new URLSearchParams(m[3] ?? '');
  const frag = new URLSearchParams(m[4] ?? '');
  if (frag.get('access_token') || frag.get('refresh_token')) {
    return { ok: false, reason: 'sin_code', detail: 'tokens en el fragmento no se aceptan (solo PKCE)' };
  }
  if (!expectedState || params.get('state') !== expectedState) return { ok: false, reason: 'state' };
  const err = params.get('error_description') ?? params.get('error');
  if (err) return { ok: false, reason: 'error_servidor', detail: err };
  const code = params.get('code');
  if (!code) return { ok: false, reason: 'sin_code' };
  return { ok: true, code };
}
