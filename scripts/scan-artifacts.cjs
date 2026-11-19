// Busca claves de servidor en el bundle web (dist/) y/o en un APK. Uso: node scripts/scan-artifacts.cjs [dist] [archivo.apk ...]
// Salida: recuento por patron. Codigo de salida 1 si hay algun hallazgo.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PATTERNS = [
  ['service_role (texto)', /service_role/i],
  ['clave secreta sb_secret_', /sb_secret_(?=[A-Za-z0-9_-]{0,23}\d)[A-Za-z0-9_-]{24,}/],
  ['JWT con rol distinto de anon', null],
];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function scanFiles(files) {
  const res = { 'service_role (texto)': 0, 'clave secreta sb_secret_': 0, 'JWT con rol distinto de anon': 0, 'JWT anon (esperado)': 0, archivos: files.length };
  for (const f of files) {
    const txt = fs.readFileSync(f).toString('latin1');
    if (/service_role/i.test(txt)) res['service_role (texto)']++;
    if (/sb_secret_(?=[A-Za-z0-9_-]{0,23}\d)[A-Za-z0-9_-]{24,}/.test(txt)) res['clave secreta sb_secret_']++;
    for (const m of txt.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
      try {
        const role = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role;
        if (role === 'anon') res['JWT anon (esperado)']++; else if (role) res['JWT con rol distinto de anon']++;
      } catch { /* no era un JWT */ }
    }
  }
  return res;
}

let bad = 0;
for (const target of process.argv.slice(2)) {
  let files;
  let label = target;
  if (target.toLowerCase().endsWith('.apk')) {
    const tmp = fs.mkdtempSync(path.join('D:\\ClaudeBrain\\tmp', 'p06-apk-'));
    execFileSync('powershell', ['-NoProfile', '-Command', `Copy-Item -LiteralPath '${target}' -Destination '${tmp}\\a.zip'; Expand-Archive -LiteralPath '${tmp}\\a.zip' -DestinationPath '${tmp}\\x' -Force`]);
    files = walk(path.join(tmp, 'x'));
    label = `${target} (${files.length} archivos dentro)`;
  } else files = walk(target);
  const r = scanFiles(files);
  console.log(label, JSON.stringify(r));
  if (r['service_role (texto)'] || r['clave secreta sb_secret_'] || r['JWT con rol distinto de anon']) bad = 1;
}
process.exit(bad);
void PATTERNS;
