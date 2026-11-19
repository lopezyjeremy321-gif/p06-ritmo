import { describe, expect, it } from 'vitest';
import { assertPublicKey, readConfig } from '../../src/lib/env';
import { buildRedirect, parseCallback, randomState } from '../../src/auth/deeplink';

describe('deep link con state + PKCE', () => {
  const state = randomState(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  it('acepta code con el state correcto', () => {
    expect(parseCallback(`ritmo://auth/callback?code=abc&state=${state}`, state)).toEqual({ ok: true, code: 'abc' });
  });
  it('rechaza state erroneo, ausente o sin flujo pendiente', () => {
    expect(parseCallback('ritmo://auth/callback?code=abc&state=otro', state)).toMatchObject({ ok: false, reason: 'state' });
    expect(parseCallback('ritmo://auth/callback?code=abc', state)).toMatchObject({ ok: false, reason: 'state' });
    expect(parseCallback(`ritmo://auth/callback?code=abc&state=${state}`, null)).toMatchObject({ ok: false, reason: 'state' });
  });
  it('rechaza esquema o ruta ajenos', () => {
    expect(parseCallback(`evil://auth/callback?code=abc&state=${state}`, state)).toMatchObject({ ok: false, reason: 'esquema' });
    expect(parseCallback(`ritmo://otra/ruta?code=abc&state=${state}`, state)).toMatchObject({ ok: false, reason: 'ruta' });
    expect(parseCallback('https://evil.example/auth/callback?code=abc', state)).toMatchObject({ ok: false, reason: 'esquema' });
  });
  it('rechaza tokens en el fragmento (flujo implicito) aunque el state sea correcto', () => {
    expect(parseCallback(`ritmo://auth/callback?state=${state}#access_token=x&refresh_token=y`, state)).toMatchObject({ ok: false, reason: 'sin_code' });
  });
  it('rechaza sin code y propaga el error del servidor', () => {
    expect(parseCallback(`ritmo://auth/callback?state=${state}`, state)).toMatchObject({ ok: false, reason: 'sin_code' });
    expect(parseCallback(`ritmo://auth/callback?state=${state}&error_description=expirado`, state)).toMatchObject({ ok: false, reason: 'error_servidor', detail: 'expirado' });
  });
  it('buildRedirect usa el esquema unico y codifica el state', () => {
    expect(buildRedirect('a b')).toBe('ritmo://auth/callback?state=a%20b');
  });
});

const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`;
describe('el cliente solo acepta claves publicas', () => {
  it('acepta anon y publishable', () => {
    expect(() => assertPublicKey(jwt('anon'))).not.toThrow();
    expect(() => assertPublicKey('sb_publishable_abc123')).not.toThrow();
  });
  it('rechaza service_role, sb_secret_ y vacia', () => {
    expect(() => assertPublicKey(jwt('service_role'))).toThrow(/service_role/);
    expect(() => assertPublicKey('sb_secret_abc')).toThrow();
    expect(() => assertPublicKey('')).toThrow();
  });
  it('readConfig exige URL http(s)', () => {
    expect(() => readConfig({ EXPO_PUBLIC_SUPABASE_URL: 'x', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_a' })).toThrow();
    expect(readConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://a.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_a' }).url).toBe('https://a.supabase.co');
  });
});
