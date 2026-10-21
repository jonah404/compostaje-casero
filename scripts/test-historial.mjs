// Prueba el módulo puro public/public/historial.js. Correr: node scripts/test-historial.mjs
import assert from 'node:assert/strict';
import {
  CORREOS_AUTORIZADOS, esAutorizado, nombreCorto, refDe, camposCambiados,
  resumir, armarEntrada, agruparEntradas, filtrarEntradas, htmlGrupo, claveGrupo
} from '../public/public/historial.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

const ctx = { plantaNombre: id => ({ 3: 'Limonero' })[id] || 'Planta ' + id, sistemaLabel: id => 'Sistema ' + id };
const maria = { uid: 'u1', email: 'mavidiaz092@gmail.com', nombre: 'Maria Diaz' };

t('lista de correos autorizados', () => {
  assert.deepEqual(CORREOS_AUTORIZADOS, ['jonahlalvarez@gmail.com', 'mavidiaz092@gmail.com']);
});
t('esAutorizado ignora mayúsculas y rechaza otros', () => {
  assert.equal(esAutorizado('JonahLAlvarez@gmail.com'), true);
  assert.equal(esAutorizado('otro@gmail.com'), false);
  assert.equal(esAutorizado(''), false);
  assert.equal(esAutorizado(undefined), false);
});
t('nombreCorto', () => {
  assert.equal(nombreCorto({ nombre: 'Maria Diaz', email: 'x@y.z' }), 'Maria');
  assert.equal(nombreCorto({ email: 'jonah@y.z' }), 'jonah');
});
t('refDe por colección', () => {
  assert.equal(refDe('registroPlantas', { planta: 7 }).id, 7);
  assert.equal(refDe('registroPlantas', { planta: 7 }).tipo, 'planta');
  assert.equal(refDe('revolcadas', { sistema: 2 }).tipo, 'sistema');
  assert.equal(refDe('plantas', { id: 4 }).tipo, 'planta');
  assert.equal(refDe('sistemas', { id: 1 }).id, 1);
  assert.deepEqual(refDe('registroPecera', {}), { tipo: 'pecera', id: 'main' });
  assert.equal(refDe('clima', {}), null);
});
t('camposCambiados ignora metadatos', () => {
  assert.deepEqual(camposCambiados({ a: 1, _ts: 1 }, { a: 1, _ts: 2, _by: {}, _pend: true }), []);
  assert.deepEqual(camposCambiados({ a: 1 }, { a: 2, b: 3 }), ['a', 'b']);
  assert.deepEqual(camposCambiados(null, { a: 1, _ts: 1 }), ['a']);
});
t('resumir', () => {
  assert.equal(resumir({ accion: 'alta', col: 'registroPlantas', datos: { tipo: 'Riego', planta: 3 }, usuario: maria }, ctx), 'Maria registró «Riego» en Limonero');
  assert.equal(resumir({ accion: 'baja', col: 'plantas', datos: { id: 3 }, previo: { id: 3 }, usuario: maria }, ctx), 'Maria eliminó Limonero');
  assert.equal(resumir({ accion: 'edicion', col: 'sistemas', datos: { id: 2, notas: 'x' }, previo: { id: 2, notas: '' }, usuario: maria }, ctx), 'Maria editó Sistema 2 (notas)');
  assert.equal(resumir({ accion: 'restauracion', col: 'plantas', datos: { id: 3 }, usuario: maria }, ctx), 'Maria restauró Limonero');
});
t('armarEntrada de edición', () => {
  const ahora = new Date('2026-10-21T10:00:00Z');
  const e = armarEntrada({ accion: 'edicion', col: 'sistemas', docId: '2', datos: { id: 2, notas: 'x' }, previo: { id: 2, notas: '', _ts: 5 }, usuario: maria, ahora }, ctx);
  assert.equal(e.previo._ts, undefined);
  assert.deepEqual(e.campos, ['notas']);
  assert.equal(e.fechaLocal, ahora.toISOString());
  assert.equal(e.grupo, null);
  assert.deepEqual(e.ref, { tipo: 'sistema', id: 2 });
  assert.equal(e.by.uid, 'u1');
});
t('agruparEntradas junta por grupo', () => {
  const g = agruparEntradas([{ grupo: 'g1', n: 1 }, { grupo: null, n: 2 }, { grupo: 'g1', n: 3 }]);
  assert.equal(g.length, 2);
  assert.equal(g[0].length, 2);
});
t('filtrarEntradas', () => {
  const es = [{ by: { email: 'a' }, accion: 'baja', ref: { tipo: 'planta', id: 1 } }, { by: { email: 'b' }, accion: 'alta', ref: { tipo: 'sistema', id: 1 } }];
  assert.equal(filtrarEntradas(es, { persona: 'a' }).length, 1);
  assert.equal(filtrarEntradas(es, { accion: 'alta' }).length, 1);
  assert.equal(filtrarEntradas(es, { ref: { tipo: 'planta', id: 1 } }).length, 1);
  assert.equal(filtrarEntradas(es, {}).length, 2);
});
t('htmlGrupo escapa y controla Restaurar', () => {
  const base = { accion: 'baja', resumen: '<img onerror=x>', previo: { id: 1 }, fechaLocal: '2026-10-21T10:00:00Z', by: maria };
  assert.ok(!htmlGrupo([base], { puedeRestaurar: false }).includes('<img'));
  assert.ok(!htmlGrupo([base], { puedeRestaurar: false }).includes('data-restaurar'));
  assert.ok(htmlGrupo([base], { puedeRestaurar: true }).includes('data-restaurar'));
  assert.ok(!htmlGrupo([{ ...base, previo: null }], { puedeRestaurar: true }).includes('data-restaurar'));
  assert.ok(!htmlGrupo([{ ...base, accion: 'alta' }], { puedeRestaurar: true }).includes('data-restaurar'));
});
t('Restaurar de ediciones sucesivas del mismo documento apunta a cada entrada (por _id)', () => {
  const mk = (_id, notas) => ({ accion: 'edicion', col: 'sistemas', docId: '2', previo: { id: 2, notas }, _id, resumen: 'x', fechaLocal: '2026-10-21T10:00:00Z', by: maria, grupo: null });
  const [g1, g2] = agruparEntradas([mk('h2', 'b'), mk('h1', 'a')]);
  assert.notEqual(claveGrupo(g1), claveGrupo(g2));
  assert.notEqual(htmlGrupo(g1, { puedeRestaurar: true }), htmlGrupo(g2, { puedeRestaurar: true }));
});
console.log(`${ok} ok`);
