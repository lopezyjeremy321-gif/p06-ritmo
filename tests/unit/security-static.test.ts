import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const SKIP = new Set(['node_modules', '.git', 'android', 'ios', 'dist', '.expo', 'keystore-local', 'tests', 'design-system', 'docs']);

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (!/\.(png|ttf|apk|jks|keystore|lock)$/i.test(f) && f !== 'package-lock.json') out.push(p);
  }
  return out;
}

describe('secretos: el repo no contiene claves de servidor', () => {
  const files = walk(ROOT).filter((f) => !f.endsWith(`${join('scripts', 'scan-artifacts.cjs')}`));
  it('hay archivos que revisar', () => expect(files.length).toBeGreaterThan(20));
  it('grep service_role en el repo (codigo, config, scripts, docs) = 0', () => {
    const hits = files.filter((f) => /service_role|SERVICE_ROLE|sb_secret_/.test(readFileSync(f, 'utf8')));
    expect(hits.map((h) => relative(ROOT, h))).toEqual([]);
  });
  it('.env esta ignorado por git y .env.example no trae valores reales', () => {
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\.env$/m);
    expect(readFileSync(join(ROOT, '.env.example'), 'utf8')).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
  it('ningun EXPO_PUBLIC_* es una clave de servidor', () => {
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(t, relative(ROOT, f)).not.toMatch(/EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE)/);
    }
  });
});

describe('Android / Expo: configuracion segura', () => {
  const cfg = require(join(ROOT, 'app.config.js')).expo;
  it('allowBackup=false', () => expect(cfg.android.allowBackup).toBe(false));
  it('esquema de deep link unico: ritmo', () => expect(cfg.scheme).toBe('ritmo'));
  it('release sin cleartext (HTTPS-only)', () => {
    const bp = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties');
    expect(bp[1].android.usesCleartextTraffic).toBe(false);
    expect(cfg.plugins).not.toContain('./plugins/with-local-http'); // solo con RITMO_LOCAL_HTTP=1
  });
  it('sin permisos de almacenamiento/overlay/microfono', () => {
    expect(cfg.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO']));
  });
  it('si existe el manifiesto generado: allowBackup=false y componentes exportados solo el launcher', () => {
    const mf = join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    if (!existsSync(mf)) return;
    const xml = readFileSync(mf, 'utf8');
    expect(xml).toContain('android:allowBackup="false"');
    const exported = [...xml.matchAll(/<(activity|service|receiver|provider)\b[^>]*android:exported="true"/g)];
    expect(exported.length).toBeLessThanOrEqual(1);
  });
});

describe('tokens de sesion y logout', () => {
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
  it('el cliente Supabase guarda la sesion en SecureStore (no AsyncStorage) y usa PKCE', () => {
    const s = read('src/lib/supabase.ts');
    expect(s).toContain('storage: secureStorage');
    expect(s).toContain("flowType: 'pkce'");
    expect(s).not.toMatch(/AsyncStorage/);
    expect(read('src/lib/secureStorage.ts')).toContain('expo-secure-store');
  });
  it('los datos locales usan AsyncStorage pero NUNCA guardan tokens', () => {
    const st = read('src/data/store.tsx');
    expect(st).not.toMatch(/access_token|refresh_token/);
  });
  it('el logout borra datos locales, cierra canales realtime y borra el state pendiente', () => {
    const st = read('src/data/store.tsx');
    expect(st).toMatch(/wipeAll\(\)/);
    expect(st).toMatch(/stopRealtime\(\)/);
    expect(st).toMatch(/STATE_KEY/);
  });
  it('sin console.log de tokens/sesion en la app', () => {
    for (const f of walk(join(ROOT, 'src'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/console\.(log|debug)\([^)]*(session|token|password)/i);
  });
});
