// Mide los objetivos tactiles reales de una pantalla del emulador: node scripts/measure-targets.cjs <uiautomator.xml> <densidad dpi>
// Lista cada elemento clicable y su tamano en dp (px * 160 / dpi). Sale con 1 si alguno mide < 48 dp en alguna dimension.
const fs = require('fs');
const xml = fs.readFileSync(process.argv[2], 'utf8');
const dpi = Number(process.argv[3] || 420);
let small = 0;
const rows = [];
for (const m of xml.matchAll(/<node [^>]*?clickable="true"[^>]*?>/g)) {
  const t = m[0];
  const b = t.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!b) continue;
  const w = ((+b[3] - +b[1]) * 160) / dpi, h = ((+b[4] - +b[2]) * 160) / dpi;
  const label = (t.match(/content-desc="([^"]*)"/)?.[1] || t.match(/text="([^"]*)"/)?.[1] || t.match(/class="([^"]*)"/)?.[1] || '?').slice(0, 40);
  const ok = w >= 47.5 && h >= 47.5;
  if (!ok) small++;
  rows.push(`${ok ? 'OK ' : 'MIN'} ${w.toFixed(0)}x${h.toFixed(0)} dp  ${label}`);
}
console.log(rows.join('\n'));
console.log(`clicables: ${rows.length}, por debajo de 48 dp: ${small}`);
process.exit(small ? 1 : 0);
