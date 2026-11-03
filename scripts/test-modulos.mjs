// Prueba los módulos puros de la app: util, fitosanitario, heatmap, analisis y graficos.
// Correr: node scripts/test-modulos.mjs
import assert from 'node:assert/strict';
import { fISO, pISO, dd, n1, n0, esc, fmt } from '../public/public/util.js';
import { fichaFito, nivelVigilancia, diasVigilancia, FITOSANITARIO, NIVEL_DIAS } from '../public/public/fitosanitario.js';
import { interp, luma, PAL, heatCell } from '../public/public/heatmap.js';
import { analisisClima } from '../public/public/analisis.js';
import { donutSVG, ringSVG, hbarSVG, climaSparkSVG } from '../public/public/graficos.js';
import { SEED_PLA, SEED_SIS, SEED_REGPLA } from '../public/public/semillas.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

console.log('util');
t('esc neutraliza HTML y comillas, y tolera null/undefined', () => {
  assert.equal(esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(esc("it's & co"), 'it&#39;s &amp; co');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
});
t('n1 y n0 formatean números y devuelven — si no hay valor', () => {
  assert.equal(n1(3.456), '3.5');
  assert.equal(n1('2'), '2.0');
  assert.equal(n1(''), '—');
  assert.equal(n1(null), '—');
  assert.equal(n1('x'), '—');
  assert.equal(n0(2.6), 3);
  assert.equal(n0(undefined), '—');
});
t('pISO y fISO: fecha local a medianoche y vuelta a texto', () => {
  const d = pISO('2026-11-03');
  assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 10); assert.equal(d.getDate(), 3); assert.equal(d.getHours(), 0);
  assert.equal(pISO(''), null);
  assert.equal(fISO('2026-11-03'), '2026-11-03');
  assert.equal(fISO(null), '');
});
t('dd cuenta días enteros entre dos fechas', () => {
  assert.equal(dd(pISO('2026-11-01'), pISO('2026-11-08')), 7);
  assert.equal(dd(pISO('2026-11-08'), pISO('2026-11-01')), -7);
});
t('fmt da dd/mm/aa y — si no hay fecha', () => {
  assert.equal(fmt(''), '—');
  assert.match(fmt('2026-11-03'), /^03\/11\/26$/);
});

console.log('fitosanitario');
t('la ficha se busca por nombre, sin distinguir mayúsculas', () => {
  assert.ok(fichaFito('Durazno amarillo'));
  assert.equal(fichaFito('DURAZNO').match, 'durazno');
  assert.equal(fichaFito('Ciruela Reina Claudia').match, 'ciruela');
  assert.equal(fichaFito('Tomate'), null);
  assert.equal(fichaFito(''), null);
});
t('cada ficha tiene problemas, monitoreo y un nivel por mes de vigilancia', () => {
  FITOSANITARIO.forEach(f => {
    assert.ok(f.problemas.length > 0, f.match);
    assert.ok(f.monitoreo, f.match);
    Object.values(f.calendarioVigilancia).forEach(n => assert.ok(n in NIVEL_DIAS, f.match + ' ' + n));
  });
});
t('el nivel de un mes sin dato es bajo (🟢) y se traduce a días de revisión', () => {
  const f = fichaFito('Durazno');
  assert.equal(nivelVigilancia(f, 7), '🟢');
  assert.equal(nivelVigilancia(null, 11), '🟢');
  assert.equal(diasVigilancia(f, 7), 14);
  assert.equal(diasVigilancia(f, 10), NIVEL_DIAS[f.calendarioVigilancia[10]]);
});
t('más vigilancia = revisiones más seguidas', () => {
  assert.ok(NIVEL_DIAS['🔴🔴'] < NIVEL_DIAS['🔴'] && NIVEL_DIAS['🔴'] < NIVEL_DIAS['🟠'] && NIVEL_DIAS['🟠'] < NIVEL_DIAS['🟢']);
});

console.log('heatmap');
t('interp: por debajo y por encima del rango devuelve los extremos', () => {
  assert.equal(interp(PAL.temp, -50), PAL.temp[0]);
  assert.equal(interp(PAL.temp, 99), PAL.temp[PAL.temp.length - 1]);
  assert.equal(interp(PAL.temp, null), null);
  assert.equal(interp(PAL.temp, ''), null);
  assert.equal(interp(PAL.temp, 'x'), null);
});
t('interp: en el medio mezcla los colores', () => {
  const pal = [{ v: 0, r: 0, g: 0, b: 0 }, { v: 10, r: 100, g: 200, b: 50 }];
  assert.deepEqual(interp(pal, 5), { r: 50, g: 100, b: 25 });
});
t('luma: blanco ~1, negro 0', () => {
  assert.ok(luma({ r: 255, g: 255, b: 255 }) > 0.99);
  assert.equal(luma({ r: 0, g: 0, b: 0 }), 0);
});
t('heatCell: sin valor es una celda neutra y con valor lleva degradé y número', () => {
  assert.match(heatCell(null, 'temp'), /var\(--paper2\)/);
  const c = heatCell(20, 'temp');
  assert.match(c, /linear-gradient/);
  assert.match(c, />20\.0</);
});

console.log('análisis de clima');
const dia = (n) => { const d = new Date(2026, 10, 3); d.setDate(d.getDate() - n); return fISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
const HOY = new Date(2026, 10, 3);
t('sin clima no rompe y no recomienda nada raro', () => {
  const a = analisisClima([], HOY);
  assert.equal(a.ll7, 0);
  assert.equal(a.tp7, null);
  assert.equal(a.cr, true);
  assert.equal(a.nr, false);
});
t('suma la lluvia de los últimos 3, 7 y 30 días', () => {
  const clima = [
    { fecha: dia(1), mm: 5, temp: 20, hum: 60 }, { fecha: dia(5), mm: 10, temp: 20, hum: 60 },
    { fecha: dia(20), mm: 8, temp: 20, hum: 60 }, { fecha: dia(60), mm: 99, temp: 20, hum: 60 },
  ];
  const a = analisisClima(clima, HOY);
  assert.equal(a.ll3, 5);
  assert.equal(a.ll7, 15);
  assert.equal(a.ll30, 23);
});
t('días seguidos sin lluvia y necesidad de riego con ambiente seco', () => {
  const clima = [0, 1, 2, 3, 4].map(n => ({ fecha: dia(n), mm: 0, temp: 25, hum: 30, lluvia: 'no' }));
  const a = analisisClima(clima, HOY);
  assert.equal(a.sl, 5);
  assert.equal(a.nr, true);
  assert.equal(analisisClima([{ fecha: dia(0), mm: 12, temp: 25, hum: 30 }, ...clima.slice(1)], HOY).sl, 0);
});

console.log('gráficos');
t('donut: sin datos dibuja solo la base; con datos muestra el total', () => {
  assert.doesNotMatch(donutSVG([{ value: 0, color: 'red' }]), /<text/);
  const d = donutSVG([{ value: 3, color: 'red' }, { value: 1, color: 'blue' }], 100, 10, 'plantas');
  assert.match(d, />4</);
  assert.match(d, />plantas</);
  assert.equal((d.match(/stroke-dasharray/g) || []).length, 2);
});
t('anillo: limita el porcentaje a 0–100 y muestra — si no hay dato', () => {
  assert.match(ringSVG(null, 'red'), />—</);
  assert.match(ringSVG(150, 'red'), />100%</);
  assert.match(ringSVG(40, 'red'), />40%</);
});
t('barras: la más alta ocupa el 100% y ninguna baja de 3%', () => {
  const h = hbarSVG([{ label: 'A', value: 10, color: 'red' }, { label: 'B', value: 0, color: 'blue' }]);
  assert.match(h, /width:100%/);
  assert.match(h, /width:3%/);
});
t('gráfico de clima: sin suficientes datos avisa; con datos dibuja', () => {
  assert.match(climaSparkSVG([], HOY), /Sin suficientes datos/);
  const clima = [3, 2, 1, 0].map(n => ({ fecha: dia(n), temp: 15 + n, mm: n }));
  assert.match(climaSparkSVG(clima, HOY, 21), /<svg/);
});

console.log('semillas');
t('los datos iniciales son los 4 frutales con su plantación registrada', () => {
  assert.equal(SEED_PLA.length, 4);
  assert.deepEqual(SEED_PLA.map(p => p.id), [1, 2, 3, 4]);
  assert.equal(SEED_REGPLA.filter(r => r.tipo.includes('Plantación')).length, 4);
  assert.ok(Array.isArray(SEED_SIS));
});

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
