// Verifica que el <script type="module"> de index.html y el resto de los .js de la app compilen.
// Correr: node scripts/check-sintaxis.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../public/public/', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brote-'));
let fallas = 0;
const revisar = (nombre, ruta) => {
  try { execFileSync(process.execPath, ['--check', ruta], { stdio: 'pipe' }); console.log('  ok   ' + nombre); }
  catch (e) { fallas++; console.error('  FAIL ' + nombre + '\n' + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')); }
};

const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
[...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  const f = path.join(tmp, `index-${i}.mjs`);
  fs.writeFileSync(f, m[1]);
  revisar(`index.html (script ${i + 1})`, f);
});
for (const f of fs.readdirSync(raiz).filter(n => n.endsWith('.js'))) {
  const copia = path.join(tmp, f.replace(/\.js$/, '.mjs'));
  fs.copyFileSync(path.join(raiz, f), copia);
  revisar(f, copia);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (fallas) process.exit(1);
