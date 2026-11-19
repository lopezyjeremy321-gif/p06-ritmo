import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkRoles, lightRoles, type ColorRoles } from '../../src/theme/tokens';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

describe('tokens: cero hex crudos fuera de la capa de tokens', () => {
  const files = [...walk(join(ROOT, 'src')), join(ROOT, 'App.tsx')].filter((f) => !f.endsWith(join('theme', 'tokens.ts')));
  it('hay archivos que revisar', () => expect(files.length).toBeGreaterThan(10));
  for (const f of files) {
    it(`${relative(ROOT, f)} sin #hex ni rgb() crudos`, () => {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
      expect(code.match(/rgba?\(/g) ?? []).toEqual([]);
    });
  }
});

// ---- contraste WCAG medido
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXT: [keyof ColorRoles, keyof ColorRoles][] = [
  ['onSurface', 'surface'], ['onBackground', 'background'], ['onSurfaceVariant', 'surface'], ['onSurfaceVariant', 'surfaceVariant'],
  ['onPrimary', 'primary'], ['onPrimaryContainer', 'primaryContainer'], ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiaryContainer', 'tertiaryContainer'], ['onError', 'error'], ['onErrorContainer', 'errorContainer'],
  ['primary', 'background'], ['error', 'background'], ['income', 'background'], ['expense', 'background'],
  ['onIncomeContainer', 'incomeContainer'], ['onExpenseContainer', 'expenseContainer'], ['inverseOnSurface', 'inverseSurface'],
  ['secondary', 'background'],
];
const UI: [keyof ColorRoles, keyof ColorRoles][] = [['outline', 'background'], ['chartBar', 'background'], ['chartBarAlt', 'background']];

for (const [name, roles] of [['claro', lightRoles], ['oscuro', darkRoles]] as const) {
  describe(`contraste tema ${name}`, () => {
    for (const [fg, bg] of TEXT) {
      it(`${String(fg)} sobre ${String(bg)} >= 4.5:1`, () => {
        expect(ratio(roles[fg] as string, roles[bg] as string)).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const [fg, bg] of UI) {
      it(`${String(fg)} sobre ${String(bg)} >= 3:1 (UI)`, () => {
        expect(ratio(roles[fg] as string, roles[bg] as string)).toBeGreaterThanOrEqual(3);
      });
    }
    it('ingreso y gasto no dependen solo del color: la marca no reutiliza sus tonos', () => {
      expect(roles.primary).not.toBe(roles.income);
      expect(roles.primary).not.toBe(roles.expense);
      expect(roles.income).not.toBe(roles.expense);
    });
  });
}

describe('paleta propia', () => {
  it('no usa el azul/violeta generico de plantilla', () => {
    const banned = ['#2563EB', '#8B5CF6', '#6750A4', '#1E40AF', '#3B82F6'];
    const all = JSON.stringify([lightRoles, darkRoles]).toUpperCase();
    for (const b of banned) expect(all).not.toContain(b);
  });
});
